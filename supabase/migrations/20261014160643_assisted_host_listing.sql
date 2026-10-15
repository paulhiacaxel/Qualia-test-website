-- Operator-prepared drafts stay private until the invited host claims them.
-- Account eligibility, legal acceptance, activity review and publication gates
-- remain unchanged. No operator may attest or accept terms for the host.
begin;

create table private.assisted_host_listings (
  source_key text primary key check (source_key ~ '^[a-z0-9-]{3,100}$'),
  recipient_email text not null unique check (recipient_email = lower(recipient_email) and length(recipient_email) between 3 and 254),
  host_id uuid unique references public.profiles(id) on delete restrict,
  listing_id uuid unique references public.listings(id) on delete restrict,
  prepared_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  invite_state text not null default 'reserved' check (invite_state in ('reserved','prepared','accepted','needs_attention')),
  provider_message_id text,
  sent_at timestamptz,
  confirmed_at timestamptz
);
alter table private.assisted_host_listings enable row level security;
revoke all on private.assisted_host_listings from public, anon, authenticated;
grant select on private.assisted_host_listings to service_role;
create index assisted_host_listings_prepared_by_idx on private.assisted_host_listings(prepared_by);

create function private.admin_get_assisted_host(p_source_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.require_verified_admin();
  return (select to_jsonb(a) from private.assisted_host_listings a where source_key=p_source_key);
end $$;

-- The unique reservation happens before Auth generates a token: a double click
-- cannot invalidate a first link or create a second invitation automatically.
create function private.admin_reserve_assisted_host(p_source_key text,p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); inserted integer;
begin
  if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Use a verified recipient email.' using errcode='22023';
  end if;
  if exists(select 1 from auth.users where lower(email)=lower(btrim(p_email))) then
    raise exception 'This host already has an account. Use their existing workspace.' using errcode='55000';
  end if;
  insert into private.assisted_host_listings(source_key,recipient_email,prepared_by)
    values(p_source_key,lower(btrim(p_email)),actor) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted=1;
end $$;

create function private.admin_prepare_assisted_listing(p_source_key text,p_host_id uuid,p_profile jsonb,p_listing jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); setup private.assisted_host_listings%rowtype; result uuid;
begin
  select * into setup from private.assisted_host_listings where source_key=p_source_key for update;
  if not found or setup.prepared_by<>actor or setup.invite_state<>'reserved' or setup.listing_id is not null then
    raise exception 'This invitation is already prepared or needs review.' using errcode='55000';
  end if;
  if not exists(select 1 from auth.users where id=p_host_id and lower(email)=setup.recipient_email and not coalesce(is_anonymous,false)) then
    raise exception 'The invited account does not match this recipient.' using errcode='42501';
  end if;
  if exists(select 1 from public.host_profiles where user_id=p_host_id) then
    raise exception 'An existing host profile must not be overwritten.' using errcode='55000';
  end if;
  insert into public.host_profiles(user_id,display_name,bio,city,portfolio_url)
  values(p_host_id,p_profile->>'display_name',p_profile->>'bio',p_profile->>'city',p_profile->>'portfolio_url');
  -- Required legacy booking fields are provisional storage defaults, hidden
  -- behind the host-confirmation form and the publication trigger below.
  insert into public.listings(host_id,title,description,category,price_cents,duration_minutes,city,neighborhood)
  values(p_host_id,p_listing->>'title',p_listing->>'description',(p_listing->>'category')::public.experience_category,
    (p_listing->>'price_cents')::integer,(p_listing->>'duration_minutes')::integer,p_listing->>'city',p_listing->>'neighborhood')
  returning id into result;
  update private.assisted_host_listings set host_id=p_host_id,listing_id=result,invite_state='prepared' where source_key=p_source_key;
  return result;
end $$;

create function private.admin_finish_assisted_invite(p_source_key text,p_state text,p_provider_id text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin();
begin
  if p_state is null or p_state not in ('accepted','needs_attention') or
    (p_state='accepted' and nullif(btrim(p_provider_id),'') is null) then
    raise exception 'A valid send result is required.' using errcode='22023';
  end if;
  update private.assisted_host_listings set invite_state=p_state,provider_message_id=p_provider_id,
    sent_at=case when p_state='accepted' then now() else null end
  where source_key=p_source_key and prepared_by=actor and invite_state in ('reserved','prepared');
  if not found then raise exception 'The invitation result is already recorded.' using errcode='55000'; end if;
end $$;

create function private.get_assisted_host_listing()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'Verify your account first.' using errcode='42501';
  end if;
  return (select jsonb_build_object('source_key',a.source_key,'listing_id',a.listing_id,
    'confirmed_at',a.confirmed_at,'listing',to_jsonb(l))
    from private.assisted_host_listings a join public.listings l on l.id=a.listing_id
    where a.host_id=auth.uid() and l.host_id=auth.uid());
end $$;

create function private.confirm_assisted_host_listing(p_price_cents integer,p_pricing_mode text,p_max_guests integer,p_copy_approved boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; setup private.assisted_host_listings%rowtype;
begin
  perform private.enable_host_mode(); -- Real host's adult + legal attestations are required.
  actor:=private.require_verified_host();
  select * into setup from private.assisted_host_listings where host_id=actor for update;
  if not found or setup.listing_id is null then raise exception 'Prepared listing unavailable.' using errcode='42501'; end if;
  perform private.require_editable_listing(setup.listing_id);
  if setup.confirmed_at is not null then return setup.listing_id; end if;
  if p_copy_approved is distinct from true or p_price_cents is null or p_price_cents not between 1 and 10000000
    or p_pricing_mode is null or p_pricing_mode not in ('private_group','private_per_guest','shared_per_guest')
    or p_max_guests is null or p_max_guests not between 1 and 50 then
    raise exception 'Confirm your price, booking format, guest limit and page content.' using errcode='22023';
  end if;
  perform private.save_listing_booking_options(setup.listing_id,
    case when p_pricing_mode='shared_per_guest' then 'shared' else 'private' end,p_max_guests,
    case when p_pricing_mode='private_per_guest' then 'per_guest' else 'group' end,
    case when p_pricing_mode='shared_per_guest' then p_price_cents else null end,'{}'::uuid[]);
  update public.listings set price_cents=p_price_cents where id=setup.listing_id and host_id=actor;
  update private.assisted_host_listings set confirmed_at=now() where source_key=setup.source_key;
  return setup.listing_id;
end $$;

create function private.guard_assisted_listing_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('submitted','approved','published') and exists(
    select 1 from private.assisted_host_listings where listing_id=new.id and confirmed_at is null
  ) then raise exception 'The host must confirm the prepared listing before review or publication.' using errcode='55000'; end if;
  return new;
end $$;
create trigger assisted_listing_confirmation_guard before update of status on public.listings
for each row execute function private.guard_assisted_listing_confirmation();

-- Public wrappers keep privileged implementation in the private schema.
create function public.admin_get_assisted_host(p_source_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_get_assisted_host(p_source_key) $$;
create function public.admin_reserve_assisted_host(p_source_key text,p_email text) returns boolean language sql security invoker set search_path='' as $$ select private.admin_reserve_assisted_host(p_source_key,p_email) $$;
create function public.admin_prepare_assisted_listing(p_source_key text,p_host_id uuid,p_profile jsonb,p_listing jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.admin_prepare_assisted_listing(p_source_key,p_host_id,p_profile,p_listing) $$;
create function public.admin_finish_assisted_invite(p_source_key text,p_state text,p_provider_id text) returns void language sql security invoker set search_path='' as $$ select private.admin_finish_assisted_invite(p_source_key,p_state,p_provider_id) $$;
create function public.get_assisted_host_listing() returns jsonb language sql security invoker set search_path='' as $$ select private.get_assisted_host_listing() $$;
create function public.confirm_assisted_host_listing(p_price_cents integer,p_pricing_mode text,p_max_guests integer,p_copy_approved boolean) returns uuid language sql security invoker set search_path='' as $$ select private.confirm_assisted_host_listing(p_price_cents,p_pricing_mode,p_max_guests,p_copy_approved) $$;

revoke all on function private.guard_assisted_listing_confirmation() from public,anon,authenticated;
revoke all on function private.admin_get_assisted_host(text),public.admin_get_assisted_host(text),
 private.admin_reserve_assisted_host(text,text),public.admin_reserve_assisted_host(text,text),
 private.admin_prepare_assisted_listing(text,uuid,jsonb,jsonb),public.admin_prepare_assisted_listing(text,uuid,jsonb,jsonb),
 private.admin_finish_assisted_invite(text,text,text),public.admin_finish_assisted_invite(text,text,text),
 private.get_assisted_host_listing(),public.get_assisted_host_listing(),
 private.confirm_assisted_host_listing(integer,text,integer,boolean),public.confirm_assisted_host_listing(integer,text,integer,boolean)
 from public,anon,authenticated;
grant execute on function private.admin_get_assisted_host(text),public.admin_get_assisted_host(text),
 private.admin_reserve_assisted_host(text,text),public.admin_reserve_assisted_host(text,text),
 private.admin_prepare_assisted_listing(text,uuid,jsonb,jsonb),public.admin_prepare_assisted_listing(text,uuid,jsonb,jsonb),
 private.admin_finish_assisted_invite(text,text,text),public.admin_finish_assisted_invite(text,text,text),
 private.get_assisted_host_listing(),public.get_assisted_host_listing(),
 private.confirm_assisted_host_listing(integer,text,integer,boolean),public.confirm_assisted_host_listing(integer,text,integer,boolean)
 to authenticated;
commit;
