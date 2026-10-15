-- Private groups and shared seats use one inventory transaction. Existing rows
-- remain private, capacity one; no listing is broadened or published by this migration.
begin;

alter table public.listings
  add column booking_format text not null default 'private' check (booking_format in ('private','shared','both')),
  add column max_guests integer not null default 1 check (max_guests between 1 and 50),
  add column private_price_basis text not null default 'group' check (private_price_basis in ('group','per_guest')),
  add column shared_price_cents integer check (shared_price_cents between 1 and 10000000),
  add constraint listing_shared_price_required check (booking_format='private' or shared_price_cents is not null);

create table public.host_resources (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.host_profiles(user_id) on delete restrict,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  kind text not null check (kind in ('boat','captain','instructor','space','equipment','other')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,host_id), unique(host_id,label)
);
create trigger host_resources_updated before update on public.host_resources
  for each row execute function private.set_updated_at();
create table private.listing_resources (
  listing_id uuid not null, host_id uuid not null, resource_id uuid not null,
  primary key(listing_id,resource_id),
  foreign key(listing_id,host_id) references public.listings(id,host_id) on delete cascade,
  foreign key(resource_id,host_id) references public.host_resources(id,host_id) on delete restrict
);
create index listing_resources_resource_idx on private.listing_resources(resource_id);
create index listing_resources_host_idx on private.listing_resources(host_id);
alter table public.host_resources enable row level security;
alter table private.listing_resources enable row level security;
revoke all on public.host_resources,private.listing_resources from public,anon,authenticated;
grant select on public.host_resources to authenticated;
grant all on public.host_resources,private.listing_resources to service_role;
create policy host_resources_read_owner on public.host_resources for select to authenticated
  using(host_id=(select auth.uid()));

alter table public.bookings
  add column booking_mode text not null default 'private' check(booking_mode in ('private','shared')),
  add column party_size integer not null default 1 check(party_size between 1 and 50),
  add column capacity_snapshot integer not null default 1 check(capacity_snapshot between 1 and 50),
  add column price_basis_snapshot text not null default 'group' check(price_basis_snapshot in ('group','per_guest')),
  add column unit_price_cents_snapshot integer,
  add column resource_ids_snapshot uuid[] not null default '{}'::uuid[],
  add constraint booking_party_within_capacity check(party_size<=capacity_snapshot);
update public.bookings set unit_price_cents_snapshot=amount_cents;
alter table public.bookings alter column unit_price_cents_snapshot set not null;
alter table public.bookings add constraint booking_unit_price_positive check(unit_price_cents_snapshot>0);
create index bookings_session_inventory_idx on public.bookings(listing_id,starts_at,ends_at);

-- Ages and booking authority remain private. No names, DOBs or medical details.
create table private.booking_party_participation (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  members jsonb not null check(jsonb_typeof(members)='array'),
  group_authority_confirmed boolean not null,
  accepted_at timestamptz not null default now()
);
alter table private.booking_party_participation enable row level security;
revoke all on private.booking_party_participation from public,anon,authenticated;
grant all on private.booking_party_participation to service_role;

create function private.listing_resource_ids(p_listing_id uuid)
returns uuid[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(resource_id order by resource_id),'{}'::uuid[])
  from private.listing_resources where listing_id=p_listing_id;
$$;
create function private.get_listing_resource_ids(p_listing_id uuid)
returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user();
begin
  if not exists(select 1 from public.listings where id=p_listing_id and
    (host_id=actor or exists(select 1 from private.admin_memberships where user_id=actor))) then
    raise exception 'Listing unavailable.' using errcode='42501'; end if;
  return private.listing_resource_ids(p_listing_id);
end $$;
create function private.save_host_resource(p_resource_id uuid,p_label text,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_host(); result uuid;
begin
  if char_length(btrim(coalesce(p_label,''))) not between 1 and 120 or p_kind is null
    or p_kind not in ('boat','captain','instructor','space','equipment','other') then
    raise exception 'Choose a resource name and type.' using errcode='22023'; end if;
  if p_resource_id is null then
    insert into public.host_resources(host_id,label,kind) values(actor,btrim(p_label),p_kind) returning id into result;
  else
    if not exists(select 1 from public.host_resources where id=p_resource_id and host_id=actor) then
      raise exception 'Resource unavailable.' using errcode='42501'; end if;
    if exists(select 1 from public.bookings b where b.host_id=actor and p_resource_id=any(b.resource_ids_snapshot)
      and private.effective_booking_status(b.status,b.request_expires_at,b.payment_deadline_at,b.starts_at,b.id)
        in ('requested','awaiting_payment','confirmed')) then
      raise exception 'Resolve active reservations before changing their resource.' using errcode='55000'; end if;
    update public.host_resources set label=btrim(p_label),kind=p_kind where id=p_resource_id;
    result:=p_resource_id;
  end if;
  return result;
end $$;
create function private.save_listing_booking_options(p_listing_id uuid,p_booking_format text,p_max_guests integer,
  p_private_price_basis text,p_shared_price_cents integer,p_resource_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_editable_listing(p_listing_id); ids uuid[];
begin
  if p_booking_format is null or p_booking_format not in ('private','shared','both') or p_max_guests is null
    or p_max_guests not between 1 and 50 or p_private_price_basis is null or p_private_price_basis not in ('group','per_guest')
    or (p_booking_format<>'private' and (p_shared_price_cents is null or p_shared_price_cents not between 1 and 10000000))
    or (p_booking_format='private' and p_shared_price_cents is not null) or p_resource_ids is null
    or cardinality(p_resource_ids)>10 or array_position(p_resource_ids,null) is not null then
    raise exception 'Choose a valid format, capacity, prices and up to ten resources.' using errcode='22023'; end if;
  select coalesce(array_agg(distinct r order by r),'{}'::uuid[]) into ids from unnest(p_resource_ids) r;
  if exists(select 1 from unnest(ids) r where not exists(select 1 from public.host_resources h where h.id=r and h.host_id=actor)) then
    raise exception 'Choose only resources belonging to your host account.' using errcode='42501'; end if;
  if exists(select 1 from public.bookings b where b.listing_id=p_listing_id
    and private.effective_booking_status(b.status,b.request_expires_at,b.payment_deadline_at,b.starts_at,b.id)
      in ('requested','awaiting_payment','confirmed')) then
    raise exception 'Resolve active reservations before changing booking options.' using errcode='55000'; end if;
  -- Inventory changes affect the reviewed activity, even when only resources change.
  if exists(select 1 from public.listings l where l.id=p_listing_id and
    (row(l.booking_format,l.max_guests,l.private_price_basis,l.shared_price_cents)
      is distinct from row(p_booking_format,p_max_guests,p_private_price_basis,p_shared_price_cents)
      or private.listing_resource_ids(l.id) is distinct from ids)) then
    perform private.invalidate_safety_revision(p_listing_id);
    update public.listings set booking_format=p_booking_format,max_guests=p_max_guests,
      private_price_basis=p_private_price_basis,shared_price_cents=p_shared_price_cents,
      price_cents=case when p_booking_format='shared' then p_shared_price_cents else price_cents end,
      status='draft',safety_status='pending',consultation_status='not_requested',published_at=null,participation_rules=null
      where id=p_listing_id;
    delete from private.listing_resources where listing_id=p_listing_id;
    insert into private.listing_resources(listing_id,host_id,resource_id) select p_listing_id,actor,r from unnest(ids) r;
  end if;
end $$;

-- An unassigned listing still reserves the host globally. Explicit resources
-- permit independent boats/teachers to run in parallel but never double-book a
-- shared boat/captain/instructor across two different listings.
create function private.resources_overlap(p_left uuid[],p_right uuid[])
returns boolean language sql immutable set search_path='' as $$
  select cardinality(p_left)=0 or cardinality(p_right)=0 or p_left&&p_right;
$$;
create function private.group_inventory(p_listing_id uuid,p_host_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,
  p_mode text,p_party_size integer,p_capacity integer,p_resources uuid[],p_exclude_booking uuid default null)
returns table(available boolean,remaining_seats integer,private_available boolean)
language sql volatile security definer set search_path='' as $$
  with target as (
    -- A status/payment recheck uses its own captured review, while a new request
    -- uses today's reviewed listing. Two versions must not sell the same event.
    select coalesce((select a.rules_snapshot->>'revision' from private.booking_participation a
      where a.booking_id=p_exclude_booking),private.get_listing_participation_rules(p_listing_id)->>'revision') as revision
  ), active as (
    select b.*,a.rules_snapshot->>'revision' as participation_revision from public.bookings b
    left join private.booking_participation a on a.booking_id=b.id
    where b.host_id=p_host_id and b.id is distinct from p_exclude_booking
      and private.effective_booking_status(b.status,b.request_expires_at,b.payment_deadline_at,b.starts_at,b.id)
        in ('requested','awaiting_payment','confirmed','completed')
      and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
      and private.resources_overlap(b.resource_ids_snapshot,p_resources)
  ), summary as (
    select count(*)::integer as total,
      count(*) filter(where not (b.booking_mode='shared' and b.listing_id=p_listing_id
        and b.starts_at=p_starts_at and b.ends_at=p_ends_at and b.resource_ids_snapshot=p_resources
        and b.capacity_snapshot=p_capacity and b.participation_revision is not distinct from (select revision from target)))::integer as incompatible,
      coalesce(sum(b.party_size) filter(where b.booking_mode='shared' and b.listing_id=p_listing_id
        and b.starts_at=p_starts_at and b.ends_at=p_ends_at and b.resource_ids_snapshot=p_resources
        and b.capacity_snapshot=p_capacity and b.participation_revision is not distinct from (select revision from target)),0)::integer as seats
    from active b
  ), inventory as (
    select *, exists(select 1 from public.host_calendar_blocks c where c.host_id=p_host_id
      and tstzrange(c.starts_at,c.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) as blocked from summary
  )
  select not blocked and p_party_size between 1 and p_capacity and
      case when p_mode='private' then total=0 when p_mode='shared' then incompatible=0 and seats+p_party_size<=p_capacity else false end,
    case when blocked or incompatible>0 then 0 else greatest(0,p_capacity-seats) end,
    not blocked and total=0 from inventory;
$$;

create function private.validate_party(p_participants jsonb,p_party_size integer,p_rules jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare member jsonb; member_age integer; key text; minors boolean:=false; attending_adult boolean:=false; guardians boolean:=false;
begin
  if p_participants is null or jsonb_typeof(p_participants)<>'object' or p_party_size is null or p_party_size not between 1 and 50 then
    raise exception 'Provide the participants and booking acknowledgments.' using errcode='22023'; end if;
  for key in select jsonb_object_keys(p_participants) loop
    if key not in ('members','adult_booker_confirmed','rules_accepted','guardian_authority_confirmed',
      'guardian_presence_accepted','rules_revision','group_authority_confirmed') then
      raise exception 'Unexpected participant field.' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(p_participants->'members') is distinct from 'array' then
    raise exception 'Provide every participant.' using errcode='22023'; end if;
  if jsonb_array_length(p_participants->'members')<>p_party_size then
    raise exception 'The participant count must match your party size.' using errcode='22023'; end if;
  if jsonb_typeof(p_participants->'rules_revision') is distinct from 'number'
    or p_participants->'rules_revision' is distinct from p_rules->'revision' then
    raise exception 'The participation rules changed. Refresh and review them.' using errcode='40001'; end if;
  for member in select value from jsonb_array_elements(p_participants->'members') loop
    if jsonb_typeof(member) is distinct from 'object' then
      raise exception 'Choose each participant age and type.' using errcode='22023'; end if;
    for key in select jsonb_object_keys(member) loop
      if key not in ('kind','age_at_experience') then raise exception 'Unexpected participant field.' using errcode='22023'; end if;
    end loop;
    if member->>'kind' is null or member->>'kind' not in ('adult','minor','guardian')
      or jsonb_typeof(member->'age_at_experience') is distinct from 'number'
      or (member->>'age_at_experience')!~'^[0-9]{1,3}$' then
      raise exception 'Choose each participant age and type.' using errcode='22023'; end if;
    member_age:=(member->>'age_at_experience')::integer;
    if member_age not between 0 and 120
      or (member->>'kind'<>'guardian' and member_age not between (p_rules->>'min_age')::integer and (p_rules->>'max_age')::integer)
      or (member->>'kind' in ('adult','guardian') and member_age<18) or (member->>'kind'='minor' and member_age>=18) then
      raise exception 'Every participant must meet the reviewed activity age requirements.' using errcode='22023'; end if;
    minors:=minors or member->>'kind'='minor';
    attending_adult:=attending_adult or member->>'kind' in ('adult','guardian');
    guardians:=guardians or member->>'kind'='guardian';
  end loop;
  if guardians and (not minors or p_rules->>'guardian_presence'<>'required') then
    raise exception 'An accompanying guardian seat is only for an activity requiring a guardian with a minor.' using errcode='22023'; end if;
  if minors and p_rules->>'guardian_presence'='required' and not attending_adult then
    raise exception 'Include the accompanying guardian in your guest count. The host may need to review a larger capacity.' using errcode='22023'; end if;
  if p_participants->'adult_booker_confirmed' is distinct from 'true'::jsonb
    or p_participants->'rules_accepted' is distinct from 'true'::jsonb
    or jsonb_typeof(p_participants->'group_authority_confirmed') is distinct from 'boolean'
    or (p_party_size>1 and p_participants->'group_authority_confirmed' is distinct from 'true'::jsonb)
    or jsonb_typeof(p_participants->'guardian_authority_confirmed') is distinct from 'boolean'
    or jsonb_typeof(p_participants->'guardian_presence_accepted') is distinct from 'boolean'
    or (minors and (p_participants->'guardian_authority_confirmed' is distinct from 'true'::jsonb
      or p_participants->'guardian_presence_accepted' is distinct from 'true'::jsonb)) then
    raise exception 'Confirm booking authority and the applicable participant and guardian requirements.' using errcode='22023'; end if;
end $$;

create function private.guard_booking_party_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; ack private.booking_participation%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'Captured party acknowledgments cannot be changed or deleted.' using errcode='55000'; end if;
  select * into b from public.bookings where id=new.booking_id;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
  select * into ack from private.booking_participation where booking_id=b.id;
  if not found then raise exception 'Capture participation acknowledgments first.' using errcode='22023'; end if;
  perform private.validate_party(jsonb_build_object('members',new.members,
    'adult_booker_confirmed',ack.adult_booker_confirmed,'rules_accepted',ack.rules_accepted,
    'guardian_authority_confirmed',ack.guardian_authority_confirmed,'guardian_presence_accepted',ack.guardian_presence_accepted,
    'rules_revision',ack.rules_snapshot->'revision','group_authority_confirmed',new.group_authority_confirmed),b.party_size,ack.rules_snapshot);
  new.accepted_at:=now();
  return new;
end $$;
create trigger booking_party_snapshot_guard before insert or update or delete on private.booking_party_participation
  for each row execute function private.guard_booking_party_snapshot();
create function private.get_booking_party_participation(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user(); result jsonb;
begin
  if not exists(select 1 from public.bookings where id=p_booking_id and (actor in (host_id,guest_id)
    or exists(select 1 from private.admin_memberships where user_id=actor))) then
    raise exception 'Booking unavailable.' using errcode='42501'; end if;
  select to_jsonb(p)-'booking_id' into result from private.booking_party_participation p where booking_id=p_booking_id;
  return result;
end $$;


create function private.request_group_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text,
  p_participants jsonb,p_booking_mode text,p_party_size integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_adult_user(); listing_host_id uuid;
  item public.listings%rowtype; policy private.booking_policy%rowtype;
  new_id uuid; ends_at_value timestamptz; rules jsonb; lead jsonb; resources uuid[]; unit_price integer; total bigint; basis text;
begin
  if char_length(coalesce(p_guest_message, '')) > 3000 or p_starts_at is null or p_starts_at <= now() then
    raise exception 'Choose a future time and a message under 3000 characters.' using errcode = '22023';
  end if;
  -- A separate user-lock namespace makes guest rate limits atomic without
  -- reversing the host-lock order used by review, availability and payments.
  perform pg_catalog.pg_advisory_xact_lock(72462, pg_catalog.hashtext(actor_id::text));
  select host_id into listing_host_id from public.listings where id = p_listing_id and status = 'published';
  if listing_host_id is null then raise exception 'This experience is not available.' using errcode = '55000'; end if;
  if listing_host_id = actor_id then raise exception 'You cannot book your own experience.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(listing_host_id::text));
  select * into item from public.listings where id = p_listing_id and status = 'published' for update;
  if not found then raise exception 'This experience is no longer available.' using errcode = '55000'; end if;
  if not exists (select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = item.host_id and p.is_host and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null) then
    raise exception 'This host is not currently accepting requests.' using errcode = '55000';
  end if;
  select * into policy from private.booking_policy where singleton and enabled and payment_deadline_minutes >= 32 for share;
  if not found then raise exception 'Booking requests are not open yet.' using errcode = '55000'; end if;
  if p_starts_at <= clock_timestamp() + interval '32 minutes' then
    raise exception 'Choose a time more than 32 minutes away so your host can respond and you can start payment.' using errcode = 'QL001';
  end if;
  if (select count(*) from public.bookings where guest_id = actor_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have reached the daily booking request limit.' using errcode = '54000';
  end if;
  ends_at_value := p_starts_at + item.duration_minutes * interval '1 minute';
  rules:=private.get_listing_participation_rules(item.id);
  if rules is null or (rules->>'valid_until')::timestamptz<ends_at_value then
    raise exception 'Current activity approval must cover the whole experience.' using errcode='55000'; end if;
  perform private.validate_party(p_participants,p_party_size,rules);
  if p_booking_mode is null or p_booking_mode not in ('private','shared') or
    (item.booking_format<>'both' and item.booking_format<>p_booking_mode) or p_party_size>item.max_guests then
    raise exception 'Choose an offered booking format and valid party size.' using errcode='22023'; end if;
  resources:=private.listing_resource_ids(item.id);
  basis:=case when p_booking_mode='shared' then 'per_guest' else item.private_price_basis end;
  unit_price:=case when p_booking_mode='shared' then item.shared_price_cents else item.price_cents end;
  total:=unit_price::bigint*case when basis='per_guest' then p_party_size else 1 end;
  if total is null or total not between 1 and 10000000 then
    raise exception 'This group total is outside the supported booking amount.' using errcode='22023'; end if;
  select value into lead from jsonb_array_elements(p_participants->'members') where value->>'kind'<>'guardian' limit 1;

  if not exists (select 1 from public.availability_windows a where a.listing_id = item.id
    and a.starts_at <= p_starts_at and a.ends_at >= ends_at_value
    and mod(extract(epoch from (p_starts_at - a.starts_at)), (item.duration_minutes * 60)::numeric) = 0) then
    raise exception 'Choose one of the available times on the calendar.' using errcode = '22023';
  end if;
  perform private.expire_host_bookings(listing_host_id);
  if not (select available from private.group_inventory(item.id,item.host_id,p_starts_at,ends_at_value,
    p_booking_mode,p_party_size,item.max_guests,resources)) then
    raise exception 'This session or its remaining seats are no longer available.' using errcode='23P01'; end if;
  if not exists (select 1 from private.listing_locations where listing_id = item.id) then
    raise exception 'This experience is missing its meeting details.' using errcode = '55000';
  end if;
  insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, amount_cents, currency,
    guest_message, request_expires_at, listing_title_snapshot, listing_category_snapshot,
    listing_city_snapshot, listing_neighborhood_snapshot, duration_minutes_snapshot,
    policy_request_expiry_minutes, policy_payment_deadline_minutes,booking_mode,party_size,capacity_snapshot,
    price_basis_snapshot,unit_price_cents_snapshot,resource_ids_snapshot)
  values (item.id, item.host_id, actor_id, p_starts_at, ends_at_value, total::integer, item.currency,
    btrim(coalesce(p_guest_message, '')), least(p_starts_at - interval '32 minutes', now() + policy.request_expiry_minutes * interval '1 minute'),
    item.title, item.category, item.city, item.neighborhood, item.duration_minutes,
    policy.request_expiry_minutes, policy.payment_deadline_minutes,p_booking_mode,p_party_size,item.max_guests,
    basis,unit_price,resources) returning id into new_id;
  insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
    adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,account_attestation_version)
  values(new_id,case when lead->>'kind'='minor' then 'minor' else 'self' end,(lead->>'age_at_experience')::integer,rules,true,true,
    (p_participants->>'guardian_authority_confirmed')::boolean,
    (p_participants->>'guardian_presence_accepted')::boolean,'adult_account_v1');
  insert into private.booking_party_participation(booking_id,members,group_authority_confirmed)
    values(new_id,p_participants->'members',coalesce((p_participants->>'group_authority_confirmed')::boolean,false));
  insert into private.booking_meeting_locations(booking_id, address_line1, address_line2, postal_code, meeting_instructions)
    select new_id, address_line1, address_line2, postal_code, meeting_instructions
    from private.listing_locations where listing_id = item.id;
  insert into private.booking_events(booking_id, actor_id, event) values (new_id, actor_id, 'requested');
  return new_id;
end;
$$;

-- The legacy four-argument request remains a private booking for one person.
-- It delegates to the same inventory/pricing transaction and cannot bypass it.
create or replace function private.request_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text,p_participant jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare key text;
begin
  if p_participant is null or jsonb_typeof(p_participant)<>'object' or
    p_participant->>'kind' is null or p_participant->>'kind' not in ('self','minor') then
    raise exception 'Choose who is participating.' using errcode='22023'; end if;
  for key in select jsonb_object_keys(p_participant) loop
    if key not in ('kind','age_at_experience','adult_booker_confirmed','rules_accepted',
      'guardian_authority_confirmed','guardian_presence_accepted','rules_revision') then
      raise exception 'Unexpected participant field.' using errcode='22023'; end if;
  end loop;
  return private.request_group_booking(p_listing_id,p_starts_at,p_guest_message,
    (p_participant-'kind'-'age_at_experience')||jsonb_build_object('group_authority_confirmed',false,
      'members',jsonb_build_array(jsonb_build_object('kind',case when p_participant->>'kind'='minor' then 'minor' else 'adult' end,
        'age_at_experience',p_participant->'age_at_experience'))),'private',1);
end $$;

-- Rows created by trusted internal paths receive conservative legacy defaults.
-- New group reservations are immutable, and every active status transition
-- rechecks shared inventory under the same lock as requests and payments.
create function private.guard_group_booking_inventory()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.unit_price_cents_snapshot:=coalesce(new.unit_price_cents_snapshot,new.amount_cents);
  elsif row(new.booking_mode,new.party_size,new.capacity_snapshot,new.price_basis_snapshot,
    new.unit_price_cents_snapshot,new.resource_ids_snapshot,new.amount_cents,new.currency)
    is distinct from row(old.booking_mode,old.party_size,old.capacity_snapshot,old.price_basis_snapshot,
    old.unit_price_cents_snapshot,old.resource_ids_snapshot,old.amount_cents,old.currency) then
    raise exception 'A captured reservation cannot be changed. Cancel and make a new request.' using errcode='55000';
  end if;
  -- The existing participation identity guard separately protects the activity,
  -- booker, host and service dates of every acknowledged booking, including all
  -- requests created here. Historical rows keep that guard's migration semantics.
  if new.status in ('requested','awaiting_payment','confirmed') then
    perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(new.host_id::text));
    if not (select available from private.group_inventory(new.listing_id,new.host_id,new.starts_at,new.ends_at,
      new.booking_mode,new.party_size,new.capacity_snapshot,new.resource_ids_snapshot,new.id)) then
      raise exception 'This session or its remaining seats are no longer available.' using errcode='23P01'; end if;
  end if;
  return new;
end $$;
create trigger bookings_group_inventory_guard before insert or update on public.bookings
  for each row execute function private.guard_group_booking_inventory();

create function private.require_booking_party_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.party_size>1 or new.booking_mode='shared')
    and not exists(select 1 from private.booking_party_participation where booking_id=new.id) then
    raise exception 'Group bookings require all participant acknowledgments.' using errcode='22023'; end if;
  return new;
end $$;
create constraint trigger bookings_party_required after insert on public.bookings
  deferrable initially deferred for each row execute function private.require_booking_party_snapshot();

create function private.list_group_booking_slots(p_listing_id uuid,p_from timestamptz,p_until timestamptz,
  p_booking_mode text,p_party_size integer)
returns table(starts_at timestamptz,ends_at timestamptz,price_cents integer,currency text,
  remaining_seats integer,private_available boolean,booking_mode text,party_size integer)
language plpgsql stable security definer set search_path='' as $$
declare item public.listings%rowtype; rules jsonb; resources uuid[]; total bigint;
begin
  if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>interval '31 days' then
    raise exception 'Choose a calendar range of at most 31 days.' using errcode='22023'; end if;
  if p_booking_mode is null or p_booking_mode not in ('private','shared') or p_party_size is null or p_party_size not between 1 and 50 then
    raise exception 'Choose a booking format and party size.' using errcode='22023'; end if;
  if not exists(select 1 from private.booking_policy where singleton and enabled and payment_deadline_minutes>=32) then return; end if;
  select * into item from public.listings where id=p_listing_id and status='published';
  if not found or p_party_size>item.max_guests or (item.booking_format<>'both' and item.booking_format<>p_booking_mode) then return; end if;
  rules:=private.get_listing_participation_rules(item.id);
  if rules is null then return; end if;
  resources:=private.listing_resource_ids(item.id);
  total:=(case when p_booking_mode='shared' then item.shared_price_cents else item.price_cents end)::bigint*
    case when p_booking_mode='shared' or item.private_price_basis='per_guest' then p_party_size else 1 end;
  if total is null or total not between 1 and 10000000 then return; end if;
  return query select distinct s.slot_start,s.slot_start+item.duration_minutes*interval '1 minute',total::integer,item.currency,
    i.remaining_seats,i.private_available,p_booking_mode,p_party_size
  from public.availability_windows a
  cross join lateral generate_series(a.starts_at,a.ends_at-item.duration_minutes*interval '1 minute',
    item.duration_minutes*interval '1 minute') s(slot_start)
  cross join lateral private.group_inventory(item.id,item.host_id,s.slot_start,s.slot_start+item.duration_minutes*interval '1 minute',
    p_booking_mode,p_party_size,item.max_guests,resources) i
  where a.listing_id=item.id and a.ends_at>p_from and a.starts_at<p_until
    and s.slot_start+item.duration_minutes*interval '1 minute'<=(rules->>'valid_until')::timestamptz
    and s.slot_start>=p_from and s.slot_start<p_until and s.slot_start>now()+interval '32 minutes' and i.available
  order by s.slot_start limit 2000;
end $$;
create or replace function private.list_booking_slots(p_listing_id uuid,p_from timestamptz,p_until timestamptz)
returns table(starts_at timestamptz,ends_at timestamptz,price_cents integer,currency text)
language sql stable security definer set search_path='' as $$
  select s.starts_at,s.ends_at,s.price_cents,s.currency
  from private.list_group_booking_slots(p_listing_id,p_from,p_until,'private',1) s;
$$;

create function public.save_host_resource(p_resource_id uuid,p_label text,p_kind text)
returns uuid language sql security invoker set search_path='' as $$ select private.save_host_resource(p_resource_id,p_label,p_kind); $$;
create function public.get_listing_resource_ids(p_listing_id uuid)
returns uuid[] language sql stable security invoker set search_path='' as $$ select private.get_listing_resource_ids(p_listing_id); $$;
create function public.save_listing_booking_options(p_listing_id uuid,p_booking_format text,p_max_guests integer,
  p_private_price_basis text,p_shared_price_cents integer,p_resource_ids uuid[])
returns void language sql security invoker set search_path='' as $$
  select private.save_listing_booking_options(p_listing_id,p_booking_format,p_max_guests,p_private_price_basis,p_shared_price_cents,p_resource_ids);
$$;
create function public.request_group_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text,
  p_participants jsonb,p_booking_mode text,p_party_size integer)
returns uuid language sql security invoker set search_path='' as $$
  select private.request_group_booking(p_listing_id,p_starts_at,p_guest_message,p_participants,p_booking_mode,p_party_size);
$$;
create function public.list_group_booking_slots(p_listing_id uuid,p_from timestamptz,p_until timestamptz,p_booking_mode text,p_party_size integer)
returns table(starts_at timestamptz,ends_at timestamptz,price_cents integer,currency text,
  remaining_seats integer,private_available boolean,booking_mode text,party_size integer)
language sql stable security invoker set search_path='' as $$
  select * from private.list_group_booking_slots(p_listing_id,p_from,p_until,p_booking_mode,p_party_size);
$$;
create function public.get_booking_party_participation(p_booking_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_booking_party_participation(p_booking_id); $$;

-- Revoke Supabase legacy default function grants before granting only intended
-- wrappers/private delegates. Internal validators/inventory stay uncallable.
revoke all on function private.listing_resource_ids(uuid),private.resources_overlap(uuid[],uuid[]),
  private.group_inventory(uuid,uuid,timestamptz,timestamptz,text,integer,integer,uuid[],uuid),
  private.validate_party(jsonb,integer,jsonb),private.guard_booking_party_snapshot(),
  private.guard_group_booking_inventory(),private.require_booking_party_snapshot()
  from public,anon,authenticated;
revoke all on function private.save_host_resource(uuid,text,text),private.get_listing_resource_ids(uuid),
  private.save_listing_booking_options(uuid,text,integer,text,integer,uuid[]),
  private.request_group_booking(uuid,timestamptz,text,jsonb,text,integer),private.get_booking_party_participation(uuid),
  public.save_host_resource(uuid,text,text),public.get_listing_resource_ids(uuid),
  public.save_listing_booking_options(uuid,text,integer,text,integer,uuid[]),
  public.request_group_booking(uuid,timestamptz,text,jsonb,text,integer),public.get_booking_party_participation(uuid)
  from public,anon,authenticated;
grant execute on function private.save_host_resource(uuid,text,text),private.get_listing_resource_ids(uuid),
  private.save_listing_booking_options(uuid,text,integer,text,integer,uuid[]),
  private.request_group_booking(uuid,timestamptz,text,jsonb,text,integer),private.get_booking_party_participation(uuid),
  public.save_host_resource(uuid,text,text),public.get_listing_resource_ids(uuid),
  public.save_listing_booking_options(uuid,text,integer,text,integer,uuid[]),
  public.request_group_booking(uuid,timestamptz,text,jsonb,text,integer),public.get_booking_party_participation(uuid)
  to authenticated;
revoke all on function private.list_group_booking_slots(uuid,timestamptz,timestamptz,text,integer),
  public.list_group_booking_slots(uuid,timestamptz,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function private.list_group_booking_slots(uuid,timestamptz,timestamptz,text,integer),
  public.list_group_booking_slots(uuid,timestamptz,timestamptz,text,integer) to anon,authenticated;


create or replace function private.guard_listing_participation()
returns trigger language plpgsql security definer set search_path='' as $$
declare approved jsonb;
begin
 if tg_op='INSERT' then
  if new.status<>'draft' or new.safety_status<>'pending' or new.participation_rules is not null then
   raise exception 'New listings must start as drafts before activity review.' using errcode='55000'; end if;
  return new;
 end if;
 if row(new.title,new.description,new.category,new.price_cents,new.duration_minutes,new.city,new.neighborhood,new.time_zone,new.booking_format,new.max_guests,new.private_price_basis,new.shared_price_cents)
   is distinct from row(old.title,old.description,old.category,old.price_cents,old.duration_minutes,old.city,old.neighborhood,old.time_zone,old.booking_format,old.max_guests,old.private_price_basis,old.shared_price_cents) then
  perform private.invalidate_safety_revision(new.id);
  new.participation_rules:=null; new.safety_status:='pending'; new.consultation_status:='not_requested';
  new.status:='draft'; new.published_at:=null;
 end if;
 if new.status='submitted' and old.status is distinct from 'submitted' then
  if not private.safety_submission_complete(new.id) then
   raise exception 'Complete the activity, age, supervision, evidence and emergency fields before submitting.' using errcode='22023'; end if;
 end if;
 if (new.safety_status='approved' and old.safety_status is distinct from 'approved') or
    (new.status in ('approved','published') and old.status is distinct from new.status) then
  approved:=private.approved_participation_rules(new.id);
  if approved is null then raise exception 'Approve the current activity submission before safety approval or publication.' using errcode='55000'; end if;
  new.participation_rules:=approved;
 end if;
 if new.status='rejected' and old.status is distinct from 'rejected' then
  perform private.invalidate_safety_revision(new.id); new.participation_rules:=null;
 end if;
 -- Never copy host-private evidence or an unreviewed arbitrary JSON document
 -- into the public listing column, even through a trusted service write.
 new.participation_rules:=private.approved_participation_rules(new.id);
 return new;
end $$;

create or replace function private.pay_apply_payment(p_event_key uuid,p_attempt_id uuid,p_session_id text,p_payment_intent_id text,
  p_charge_id text,p_amount_cents integer,p_currency text,p_state text,p_processor_fee_cents integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts%rowtype; b public.bookings%rowtype; problem text;
begin
  select * into a from private.payment_attempts where id=p_attempt_id;
  if not found then raise exception 'Unknown payment attempt.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  select * into b from public.bookings where id=a.booking_id for update;
  select * into a from private.payment_attempts where id=p_attempt_id for update;
  if p_state is null or p_state not in ('processing','paid','failed','expired') or p_session_id is null
    or not exists(select 1 from private.stripe_event_inbox where id=p_event_key and environment=a.environment)
    or (a.session_id is not null and a.session_id<>p_session_id)
    or (a.payment_intent_id is not null and p_payment_intent_id is not null and a.payment_intent_id<>p_payment_intent_id) then
    raise exception 'Payment evidence does not match the reserved attempt.' using errcode='22023'; end if;
  if a.state='paid' then
    -- A delayed failure/expiry event cannot undo a verified successful charge.
    if p_state='paid' and a.charge_id=p_charge_id and p_processor_fee_cents is not null and a.processor_fee_cents is null then
      update private.payment_attempts set processor_fee_cents=p_processor_fee_cents where id=a.id;
    end if;
    return jsonb_build_object('state',a.state,'booking_status',b.status);
  end if;
  if a.state='quarantined' then return jsonb_build_object('state',a.state,'booking_status',b.status); end if;
  if p_state='paid' then
    if p_payment_intent_id is null or p_charge_id is null or p_amount_cents is null or p_amount_cents<0 or p_currency is null then
      raise exception 'A successful canonical payment needs intent, charge, amount, and currency.' using errcode='22023'; end if;
    if p_amount_cents<>a.amount_cents or p_currency<>a.currency then problem:='Canonical amount or currency differs from the quote.';
    elsif b.status<>'awaiting_payment' or b.starts_at<=now() then problem:='Payment arrived after the booking ceased to be payable.';
    elsif not private.booking_participation_current(b.id) then
      problem:='The reviewed activity or participant rules changed after checkout; manual refund review required.';
    elsif exists(select 1 from private.payment_attempts where booking_id=b.id and id<>a.id and state in ('preparing','open','processing','paid','quarantined')) then
      problem:='Another payment attempt or exception exists for this booking.';
    elsif exists(select 1 from public.host_calendar_blocks busy where busy.host_id=b.host_id
      and tstzrange(busy.starts_at,busy.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then
      problem:='The host blocked this time after the booking expired; manual refund review required.';
    elsif not (select available from private.group_inventory(b.listing_id,b.host_id,b.starts_at,b.ends_at,
      b.booking_mode,b.party_size,b.capacity_snapshot,b.resource_ids_snapshot,b.id)) then
      problem:='The session seats or resources are no longer available; manual refund review required.';
    end if;
    update private.payment_attempts set state=case when problem is null then 'paid' else 'quarantined' end,
      session_id=p_session_id,payment_intent_id=p_payment_intent_id,charge_id=p_charge_id,
      received_amount_cents=p_amount_cents,received_currency=p_currency,processor_fee_cents=p_processor_fee_cents,
      quarantine_reason=problem,paid_at=now(),updated_at=now() where id=a.id;
    if problem is null then
      update private.incentive_reservations set state='consumed' where attempt_id=a.id and state='reserved';
      update public.bookings set status='confirmed' where id=b.id;
    end if;
  elsif p_state='processing' then
    if a.state in ('preparing','open','processing') then
      update private.payment_attempts set state='processing',session_id=p_session_id,
        payment_intent_id=coalesce(payment_intent_id,p_payment_intent_id),updated_at=now() where id=a.id;
    end if;
  else
    -- Only a canonical terminal Session/Intent may reach this branch. A card
    -- decline while Checkout remains open is not terminal and must be retried.
    update private.payment_attempts set state=p_state,session_id=p_session_id,
      payment_intent_id=coalesce(payment_intent_id,p_payment_intent_id),updated_at=now() where id=a.id;
    update private.incentive_reservations set state='released' where attempt_id=a.id and state='reserved';
    if b.payment_deadline_at<=now() or b.starts_at<=now() then update public.bookings set status='expired' where id=b.id and status='awaiting_payment'; end if;
  end if;
  select state into p_state from private.payment_attempts where id=a.id;
  select status into b.status from public.bookings where id=b.id;
  return jsonb_build_object('state',p_state,'booking_status',b.status);
end $$;

-- Keep legacy Checkout idempotency payloads unchanged, including rolling-deploy one-person requests.
create or replace function private.financial_attempt_json(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('attempt_id',a.id,'operation_id',a.id,'booking_id',a.booking_id,'guest_id',a.guest_id,'host_id',a.host_id,
    'listing_title',b.listing_title_snapshot,'amount_cents',a.amount_cents,'currency',a.currency,'host_account_id',a.account_id,
    'commission_cents',a.commission_cents,'policy_version',a.policy_id,'expires_at',a.expires_at,'attempt_state',a.state,
    'session_id',a.session_id,'url',a.checkout_url,'environment',a.environment,'kind','checkout','created_at',a.created_at)
    ||case when (b.booking_mode='shared' or b.party_size>1) and exists(select 1 from private.booking_party_participation p where p.booking_id=b.id)
      then jsonb_build_object('booking_mode',b.booking_mode,'party_size',b.party_size,
        'price_basis_snapshot',b.price_basis_snapshot,'unit_price_cents_snapshot',b.unit_price_cents_snapshot)
      else '{}'::jsonb end
  from private.payment_attempts a join public.bookings b on b.id=a.booking_id where a.id=p_id;
$$;

create or replace function public.email_job_context(p_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare job private.email_outbox%rowtype; b public.bookings%rowtype; eligible boolean := false;
begin
  select * into job from private.email_outbox where id=p_id and lease_token=p_lease_token
    and status='processing' and lease_until>now() for update;
  if not found then return null; end if;
  select * into b from public.bookings where id=job.booking_id;
  if found and job.recipient_id in (b.guest_id,b.host_id) then
    eligible := case job.kind
      when 'new_request' then b.status='requested' and b.starts_at>now() and b.request_expires_at>now()
      when 'accepted' then b.status='awaiting_payment' and b.starts_at>now() and b.payment_deadline_at>now()
      when 'confirmed' then b.status in ('confirmed','completed')
        and exists(select 1 from private.payment_attempts where booking_id=b.id and state='paid')
      when 'cancelled' then b.status='cancelled'
      when 'request_closed' then b.status in ('declined','expired')
      when 'reminder_24h' then b.status='confirmed'
        and exists(select 1 from private.payment_attempts where booking_id=b.id and state='paid')
        and b.starts_at=job.scheduled_starts_at
        and b.starts_at>now() and b.starts_at<=now()+interval '24 hours'
      else false end;
  end if;
  if not coalesce(eligible,false) then
    update private.email_outbox set status='skipped',last_error_code='stale_booking_state',lease_token=null,lease_until=null where id=p_id;
    return null;
  end if;
  -- Never return guest notes, names, or private meeting locations to templates.
  return jsonb_build_object('id',job.id,'booking_id',b.id,'recipient_id',job.recipient_id,
    'kind',job.kind,'starts_at',b.starts_at,'title',b.listing_title_snapshot,
    'payment_deadline_at',b.payment_deadline_at,'provider_payload',job.provider_payload,
    'first_send_at',job.first_send_at,'booking_mode',b.booking_mode,'party_size',b.party_size,
    'price_basis_snapshot',b.price_basis_snapshot,'unit_price_cents_snapshot',b.unit_price_cents_snapshot,
    'amount_cents',b.amount_cents,'currency',b.currency);
end;
$$;

create or replace function private.get_booking_details(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user(); item public.bookings%rowtype; result jsonb;
begin
  select * into item from public.bookings where id = p_booking_id
    and (actor_id in (host_id, guest_id) or exists (select 1 from private.admin_memberships where user_id = actor_id));
  if not found then raise exception 'Booking unavailable.' using errcode = '42501'; end if;
  item.status := private.effective_booking_status(item.status, item.request_expires_at, item.payment_deadline_at, item.starts_at, item.id);
  select jsonb_build_object(
    'booking', to_jsonb(item)||jsonb_build_object('payment_hold_active',private.financial_hold_active(item.id)),
    'listing', jsonb_build_object('title', coalesce(nullif(item.listing_title_snapshot, ''), l.title),
      'category', coalesce(item.listing_category_snapshot, l.category), 'city', coalesce(item.listing_city_snapshot, l.city),
      'neighborhood', coalesce(item.listing_neighborhood_snapshot, l.neighborhood), 'time_zone', l.time_zone,
      'duration_minutes', coalesce(item.duration_minutes_snapshot, l.duration_minutes)),
    'host', jsonb_build_object('user_id', h.user_id, 'display_name', h.display_name, 'bio', h.bio),
    'party_participation',private.get_booking_party_participation(item.id),
    'guest_name', coalesce(nullif(g.full_name, ''), 'Guest'),
    'meeting_location', case when item.status in ('confirmed','completed') and actor_id in (item.host_id, item.guest_id)
      then (select to_jsonb(a) - 'booking_id' from private.booking_meeting_locations a where a.booking_id = item.id) else null end,
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from (
      select id, booking_id, sender_id, body, created_at from public.booking_messages
      where booking_id = item.id order by created_at desc limit 500
    ) m), '[]'::jsonb)
  ) into result from public.listings l join public.host_profiles h on h.user_id = item.host_id
    join public.profiles g on g.id = item.guest_id where l.id = item.listing_id;
  return result;
end;
$$;

drop function public.list_my_bookings(text);
drop function private.list_my_bookings(text);

create function private.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz,
  ends_at timestamptz, status public.booking_status, amount_cents integer, currency text,
  guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz,
  created_at timestamptz, updated_at timestamptz, listing_title text,
  listing_category public.experience_category, listing_city text, host_name text, guest_name text, payment_hold_active boolean,booking_mode text,party_size integer,price_basis_snapshot text,unit_price_cents_snapshot integer)
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user();
begin
  if p_role is null or p_role not in ('guest', 'host') then
    raise exception 'Choose guest or host bookings.' using errcode = '22023';
  end if;
  return query select b.id, b.listing_id, b.host_id, b.guest_id, b.starts_at, b.ends_at,
    private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id),
    b.amount_cents, b.currency, b.guest_message, b.request_expires_at, b.payment_deadline_at, b.created_at, b.updated_at,
    coalesce(nullif(b.listing_title_snapshot, ''), l.title), coalesce(b.listing_category_snapshot, l.category),
    coalesce(b.listing_city_snapshot, l.city), h.display_name, coalesce(nullif(g.full_name, ''), 'Guest'), private.financial_hold_active(b.id),b.booking_mode,b.party_size,b.price_basis_snapshot,b.unit_price_cents_snapshot
  from public.bookings b join public.listings l on l.id = b.listing_id
    join public.host_profiles h on h.user_id = b.host_id join public.profiles g on g.id = b.guest_id
  where (p_role = 'guest' and b.guest_id = actor_id) or (p_role = 'host' and b.host_id = actor_id)
  order by b.created_at desc limit 500;
end;
$$;

create function public.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz, ends_at timestamptz, status public.booking_status, amount_cents integer, currency text, guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz, created_at timestamptz, updated_at timestamptz, listing_title text, listing_category public.experience_category, listing_city text, host_name text, guest_name text, payment_hold_active boolean,booking_mode text,party_size integer,price_basis_snapshot text,unit_price_cents_snapshot integer) language sql security invoker set search_path = '' as $$
  select * from private.list_my_bookings(p_role);
$$;

revoke all on function private.list_my_bookings(text),public.list_my_bookings(text) from public,anon,authenticated;
grant execute on function private.list_my_bookings(text),public.list_my_bookings(text) to authenticated;

-- Host saves are atomic: if options or resource ownership are invalid, neither
-- the base listing changes nor its price changes can persist on their own.
create function private.create_listing_with_booking_options(
  p_title text, p_description text, p_category public.experience_category,
  p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text,
  p_booking_format text, p_max_guests integer, p_private_price_basis text,
  p_shared_price_cents integer, p_resource_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  perform private.require_verified_host();
  new_id := private.create_listing(p_title, p_description, p_category,
    case when p_booking_format = 'shared' then p_shared_price_cents else p_price_cents end,
    p_duration_minutes, p_city, p_neighborhood);
  perform private.save_listing_booking_options(new_id, p_booking_format, p_max_guests,
    p_private_price_basis, p_shared_price_cents, p_resource_ids);
  return new_id;
end;
$$;

create function private.save_listing_with_booking_options(
  p_listing_id uuid, p_title text, p_description text, p_category public.experience_category,
  p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text,
  p_booking_format text, p_max_guests integer, p_private_price_basis text,
  p_shared_price_cents integer, p_resource_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_editable_listing(p_listing_id);
  perform private.save_listing(p_listing_id, p_title, p_description, p_category,
    case when p_booking_format = 'shared' then p_shared_price_cents else p_price_cents end,
    p_duration_minutes, p_city, p_neighborhood);
  perform private.save_listing_booking_options(p_listing_id, p_booking_format, p_max_guests,
    p_private_price_basis, p_shared_price_cents, p_resource_ids);
end;
$$;

create function public.create_listing_with_booking_options(
  p_title text, p_description text, p_category public.experience_category,
  p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text,
  p_booking_format text, p_max_guests integer, p_private_price_basis text,
  p_shared_price_cents integer, p_resource_ids uuid[]
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_listing_with_booking_options(p_title, p_description, p_category,
    p_price_cents, p_duration_minutes, p_city, p_neighborhood, p_booking_format,
    p_max_guests, p_private_price_basis, p_shared_price_cents, p_resource_ids);
$$;

create function public.save_listing_with_booking_options(
  p_listing_id uuid, p_title text, p_description text, p_category public.experience_category,
  p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text,
  p_booking_format text, p_max_guests integer, p_private_price_basis text,
  p_shared_price_cents integer, p_resource_ids uuid[]
)
returns void language sql security invoker set search_path = '' as $$
  select private.save_listing_with_booking_options(p_listing_id, p_title, p_description,
    p_category, p_price_cents, p_duration_minutes, p_city, p_neighborhood, p_booking_format,
    p_max_guests, p_private_price_basis, p_shared_price_cents, p_resource_ids);
$$;

revoke all on function
  private.create_listing_with_booking_options(text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  private.save_listing_with_booking_options(uuid,text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  public.create_listing_with_booking_options(text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  public.save_listing_with_booking_options(uuid,text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[])
  from public, anon, authenticated;
grant execute on function
  private.create_listing_with_booking_options(text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  private.save_listing_with_booking_options(uuid,text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  public.create_listing_with_booking_options(text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[]),
  public.save_listing_with_booking_options(uuid,text,text,public.experience_category,integer,integer,text,text,text,integer,text,integer,uuid[])
  to authenticated;


commit;
