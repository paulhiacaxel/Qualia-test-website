-- Versioned, explicit acceptance of the owner-approved launch documents.
-- No existing account, host, booking or payment is accepted on anybody's behalf.
begin;

create table private.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null check (scope in ('guest','host')),
  version text not null,
  document_versions jsonb not null check (jsonb_typeof(document_versions)='object'),
  accepted_at timestamptz not null default now(),
  unique(user_id,scope,version)
);
alter table private.legal_acceptances enable row level security;
revoke all on private.legal_acceptances from public,anon,authenticated;
grant select on private.legal_acceptances to service_role;

create function private.current_legal_acceptance(p_user_id uuid,p_scope text)
returns uuid language sql stable security definer set search_path='' as $$
  select id from private.legal_acceptances where user_id=p_user_id and scope=p_scope and
    version=case p_scope when 'guest' then 'qualia_guest_2026_10_13_v1'
      when 'host' then 'qualia_host_2026_10_13_v1' end;
$$;
create function private.require_legal_acceptance(p_user_id uuid,p_scope text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
  result:=private.current_legal_acceptance(p_user_id,p_scope);
  if result is null or (p_scope='host' and private.current_legal_acceptance(p_user_id,'guest') is null) then
    raise exception 'Review and explicitly accept the current Qualia agreements before continuing.' using errcode='42501';
  end if;
  return result;
end $$;
create function private.accept_legal_terms(p_scope text,p_guest_version text,p_host_version text,p_terms_accepted boolean,p_privacy_acknowledged boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_adult_user(); manifest jsonb;
begin
  if p_scope is null or p_scope not in ('guest','host') or p_guest_version is distinct from 'qualia_guest_2026_10_13_v1'
    or (p_scope='host' and p_host_version is distinct from 'qualia_host_2026_10_13_v1')
    or (p_scope='guest' and p_host_version is not null)
    or p_terms_accepted is distinct from true or p_privacy_acknowledged is distinct from true then
    raise exception 'Review the current terms, cancellation policy and privacy notice, then explicitly confirm.' using errcode='22023';
  end if;
  manifest:=jsonb_build_object('/terms','qualia_guest_2026_10_13_v1',
    '/cancellation-policy','qualia_cancellation_2026_10_13_v1','/privacy','qualia_privacy_2026_10_13_v1');
  -- The actor, versions, document manifest and time come from trusted database code.
  -- Repeat confirmation is idempotent and never changes the original acceptance time.
  insert into private.legal_acceptances(user_id,scope,version,document_versions)
    values(actor,'guest','qualia_guest_2026_10_13_v1',manifest) on conflict(user_id,scope,version) do nothing;
  if p_scope='host' then
    insert into private.legal_acceptances(user_id,scope,version,document_versions)
      values(actor,'host','qualia_host_2026_10_13_v1',manifest||jsonb_build_object('/host-terms','qualia_host_2026_10_13_v1'))
      on conflict(user_id,scope,version) do nothing;
  end if;
end $$;
create function private.get_legal_acceptance()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user();
begin
 return jsonb_build_object(
   'guest_accepted',private.current_legal_acceptance(actor,'guest') is not null,
   'host_accepted',private.current_legal_acceptance(actor,'host') is not null and private.current_legal_acceptance(actor,'guest') is not null,
   'guest_version','qualia_guest_2026_10_13_v1','host_version','qualia_host_2026_10_13_v1',
   'records',coalesce((select jsonb_agg(jsonb_build_object('scope',scope,'version',version,
     'document_versions',document_versions,'accepted_at',accepted_at) order by accepted_at)
     from private.legal_acceptances where user_id=actor),'[]'::jsonb));
end $$;
create function private.guard_legal_acceptance_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'Legal acceptance history cannot be rewritten.' using errcode='42501'; end $$;
create trigger legal_acceptances_immutable before update or delete on private.legal_acceptances
 for each row execute function private.guard_legal_acceptance_history();

-- New host work is gated; existing records, cancellations and payment recovery
-- keep their existing identity-based access rules.
create or replace function private.enable_host_mode()
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_adult_user();
begin
 perform private.require_legal_acceptance(actor,'host');
 update public.profiles set is_host=true where id=actor;
end $$;
create or replace function private.require_verified_host()
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_adult_user();
begin
 if not exists(select 1 from public.profiles where id=actor and is_host) then
   raise exception 'A verified host account is required.' using errcode='42501'; end if;
 perform private.require_legal_acceptance(actor,'host');
 perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(actor::text));
 return actor;
end $$;
create function private.guard_listing_legal_acceptance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('submitted','published') and (tg_op='INSERT' or new.status is distinct from old.status) then
   perform private.require_legal_acceptance(new.host_id,'host');
 end if;
 return new;
end $$;
create trigger listings_legal_acceptance_guard before insert or update of status on public.listings
 for each row execute function private.guard_listing_legal_acceptance();

-- Immutable references identify exactly what each party had accepted when the
-- booking was requested. Legacy bookings deliberately retain NULL references.
alter table public.bookings add column guest_legal_acceptance_id uuid references private.legal_acceptances(id) on delete restrict;
alter table public.bookings add column host_legal_acceptance_id uuid references private.legal_acceptances(id) on delete restrict;
create index bookings_guest_legal_idx on public.bookings(guest_legal_acceptance_id);
create index bookings_host_legal_idx on public.bookings(host_legal_acceptance_id);
create function private.guard_booking_legal_acceptance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   new.guest_legal_acceptance_id:=private.require_legal_acceptance(new.guest_id,'guest');
   new.host_legal_acceptance_id:=private.require_legal_acceptance(new.host_id,'host');
 elsif new.guest_legal_acceptance_id is distinct from old.guest_legal_acceptance_id
   or new.host_legal_acceptance_id is distinct from old.host_legal_acceptance_id then
   raise exception 'Booking agreement records cannot be rewritten.' using errcode='42501';
 elsif new.status='awaiting_payment' and old.status is distinct from 'awaiting_payment' then
   perform private.require_legal_acceptance(new.guest_id,'guest');
   perform private.require_legal_acceptance(new.host_id,'host');
 end if;
 return new;
end $$;
create trigger bookings_legal_acceptance_guard before insert or update on public.bookings
 for each row execute function private.guard_booking_legal_acceptance();

-- Checkout captures its own references too, so a later terms revision never
-- makes a historical charge's agreement record ambiguous.
alter table private.payment_attempts add column guest_legal_acceptance_id uuid references private.legal_acceptances(id) on delete restrict;
alter table private.payment_attempts add column host_legal_acceptance_id uuid references private.legal_acceptances(id) on delete restrict;
create index payment_attempts_guest_legal_idx on private.payment_attempts(guest_legal_acceptance_id);
create index payment_attempts_host_legal_idx on private.payment_attempts(host_legal_acceptance_id);
create function private.guard_payment_legal_acceptance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   new.guest_legal_acceptance_id:=private.require_legal_acceptance(new.guest_id,'guest');
   new.host_legal_acceptance_id:=private.require_legal_acceptance(new.host_id,'host');
 elsif new.guest_legal_acceptance_id is distinct from old.guest_legal_acceptance_id
   or new.host_legal_acceptance_id is distinct from old.host_legal_acceptance_id then
   raise exception 'Payment agreement records cannot be rewritten.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger payment_attempts_legal_acceptance_guard before insert or update on private.payment_attempts
 for each row execute function private.guard_payment_legal_acceptance();

-- Retain the proven reservation transaction intact, adding an explicit legal gate
-- before new Checkout work. Already settled attempts still reconcile and refund.
alter function private.pay_reserve_checkout(uuid,uuid,text,uuid,boolean) rename to pay_reserve_checkout_before_legal;
create function private.pay_reserve_checkout(p_actor_id uuid,p_booking_id uuid,p_environment text,p_policy_id uuid,p_terms_accepted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 perform private.financial_actor(p_actor_id);
 select * into b from public.bookings where id=p_booking_id;
 if not found or b.guest_id<>p_actor_id then raise exception 'Booking unavailable.' using errcode='42501'; end if;
 if not exists(select 1 from private.payment_attempts where booking_id=b.id and state in ('paid','quarantined')) then
   perform private.require_legal_acceptance(b.guest_id,'guest');
   perform private.require_legal_acceptance(b.host_id,'host');
 end if;
 return private.pay_reserve_checkout_before_legal(p_actor_id,p_booking_id,p_environment,p_policy_id,p_terms_accepted);
end $$;
-- Rebind the public service-only entry point after renaming the implementation.
create or replace function public.pay_reserve_checkout(p_actor_id uuid,p_booking_id uuid,p_environment text,p_policy_id uuid,p_terms_accepted boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select private.pay_reserve_checkout(p_actor_id,p_booking_id,p_environment,p_policy_id,p_terms_accepted);
$$;

create or replace function private.pay_prepare_account(p_host_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.financial_actor(p_host_id);
 if not exists(select 1 from public.profiles where id=p_host_id and is_host) then
   raise exception 'Host account required.' using errcode='42501'; end if;
 select to_jsonb(a) into result from private.stripe_accounts a
   where host_id=p_host_id and environment=p_environment and account_id is not null;
 if result is not null then return result; end if;
 if not private.adult_account_is_eligible(p_host_id) then
   raise exception 'Confirm that you are at least 18 before creating a host payment account.' using errcode='42501'; end if;
 perform private.require_legal_acceptance(p_host_id,'host');
 insert into private.stripe_accounts(host_id,environment) values(p_host_id,p_environment) on conflict(host_id,environment) do nothing;
 select to_jsonb(a) into result from private.stripe_accounts a where host_id=p_host_id and environment=p_environment;
 return result;
end $$;

create function public.accept_legal_terms(p_scope text,p_guest_version text,p_host_version text,p_terms_accepted boolean,p_privacy_acknowledged boolean)
returns void language sql security invoker set search_path='' as $$
 select private.accept_legal_terms(p_scope,p_guest_version,p_host_version,p_terms_accepted,p_privacy_acknowledged);
$$;
create function public.get_legal_acceptance()
returns jsonb language sql security invoker set search_path='' as $$ select private.get_legal_acceptance(); $$;
revoke all on function private.current_legal_acceptance(uuid,text),private.require_legal_acceptance(uuid,text),
 private.accept_legal_terms(text,text,text,boolean,boolean),private.get_legal_acceptance(),private.guard_legal_acceptance_history(),
 private.guard_listing_legal_acceptance(),private.guard_booking_legal_acceptance(),private.guard_payment_legal_acceptance(),
 private.pay_reserve_checkout_before_legal(uuid,uuid,text,uuid,boolean),private.pay_reserve_checkout(uuid,uuid,text,uuid,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.accept_legal_terms(text,text,text,boolean,boolean),public.get_legal_acceptance()
 from public,anon,authenticated,service_role;
grant execute on function private.accept_legal_terms(text,text,text,boolean,boolean),private.get_legal_acceptance(),
 public.accept_legal_terms(text,text,text,boolean,boolean),public.get_legal_acceptance() to authenticated;
grant execute on function private.pay_reserve_checkout(uuid,uuid,text,uuid,boolean) to service_role;
commit;
