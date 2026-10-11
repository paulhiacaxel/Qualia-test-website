-- Phase 4: private, request-first bookings and authenticated concierge support.
-- This migration never confirms a booking or charges money. Payment confirmation
-- will require a verified Stripe event in phase 5, using the same host lock.
begin;

create table private.booking_policy (
  singleton boolean primary key default true check (singleton),
  request_expiry_minutes integer check (request_expiry_minutes between 1 and 10080),
  payment_deadline_minutes integer check (payment_deadline_minutes between 1 and 10080),
  enabled boolean not null default false,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  check (not enabled or (request_expiry_minutes is not null and payment_deadline_minutes is not null))
);
create index booking_policy_approved_by_idx on private.booking_policy(approved_by);
create table private.booking_policy_history (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  settings jsonb not null,
  created_at timestamptz not null default now()
);
create index booking_policy_history_actor_idx on private.booking_policy_history(actor_id);
-- No policy row is inserted: owner decisions are required before booking opens.

alter table public.bookings add column request_expires_at timestamptz;
alter table public.bookings add column payment_deadline_at timestamptz;
alter table public.bookings add column listing_title_snapshot text not null default '';
alter table public.bookings add column listing_category_snapshot public.experience_category;
alter table public.bookings add column listing_city_snapshot text;
alter table public.bookings add column listing_neighborhood_snapshot text;
alter table public.bookings add column duration_minutes_snapshot integer;
alter table public.bookings add column policy_request_expiry_minutes integer;
alter table public.bookings add column policy_payment_deadline_minutes integer;

create table private.booking_meeting_locations (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  address_line1 text not null,
  address_line2 text not null default '',
  postal_code text not null,
  meeting_instructions text not null default ''
);
create table private.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  event text not null check (event in ('requested', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on private.booking_events(booking_id, created_at);
create index booking_events_actor_idx on private.booking_events(actor_id);

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index booking_messages_booking_idx on public.booking_messages(booking_id, created_at);
create index booking_messages_sender_idx on public.booking_messages(sender_id, created_at);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'closed')),
  response text check (response is null or char_length(btrim(response)) between 1 and 5000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_user_idx on public.support_requests(user_id, created_at);
create index support_requests_queue_idx on public.support_requests(status, created_at);
create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function private.set_updated_at();
create table private.support_response_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete restrict,
  responder_id uuid not null references auth.users(id) on delete restrict,
  response text not null,
  closed boolean not null,
  created_at timestamptz not null default now()
);
create index support_history_request_idx on private.support_response_history(request_id, created_at);
create index support_history_responder_idx on private.support_response_history(responder_id);

alter table private.booking_policy enable row level security;
alter table private.booking_policy_history enable row level security;
alter table private.booking_meeting_locations enable row level security;
alter table private.booking_events enable row level security;
alter table private.support_response_history enable row level security;
alter table public.booking_messages enable row level security;
alter table public.support_requests enable row level security;
revoke all on private.booking_policy, private.booking_policy_history, private.booking_meeting_locations,
  private.booking_events, private.support_response_history, public.booking_messages, public.support_requests
  from public, anon, authenticated;
grant all on private.booking_policy, private.booking_policy_history, private.booking_meeting_locations,
  private.booking_events, private.support_response_history, public.booking_messages, public.support_requests to service_role;
grant select on public.booking_messages, public.support_requests to authenticated;
create policy booking_messages_read_participant_or_admin on public.booking_messages for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
    and (b.guest_id = (select auth.uid()) or b.host_id = (select auth.uid()) or (select public.is_admin()))));
create policy support_requests_read_self_or_admin on public.support_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create function private.require_verified_user()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = actor_id and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null) then
    raise exception 'A verified account is required.' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;

create function private.get_booking_policy()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('enabled', enabled,
    'request_expiry_minutes', request_expiry_minutes, 'payment_deadline_minutes', payment_deadline_minutes)
    from private.booking_policy where singleton),
    jsonb_build_object('enabled', false, 'request_expiry_minutes', null, 'payment_deadline_minutes', null));
$$;
create function private.admin_set_booking_policy(p_request_expiry_minutes integer,
  p_payment_deadline_minutes integer, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_admin();
begin
  if p_enabled is null or (p_enabled and (p_request_expiry_minutes is null or p_payment_deadline_minutes is null))
    or (p_request_expiry_minutes is not null and p_request_expiry_minutes not between 1 and 10080)
    or (p_payment_deadline_minutes is not null and p_payment_deadline_minutes not between 1 and 10080) then
    raise exception 'Choose both booking deadlines (1–10080 minutes) before enabling requests.' using errcode = '22023';
  end if;
  insert into private.booking_policy(singleton, request_expiry_minutes, payment_deadline_minutes, enabled, approved_by)
    values (true, p_request_expiry_minutes, p_payment_deadline_minutes, p_enabled, actor_id)
    on conflict (singleton) do update set request_expiry_minutes = excluded.request_expiry_minutes,
      payment_deadline_minutes = excluded.payment_deadline_minutes, enabled = excluded.enabled,
      approved_by = actor_id, approved_at = now();
  insert into private.booking_policy_history(actor_id, settings) values (actor_id, private.get_booking_policy());
end;
$$;

-- Public assets remain in a PRIVATE bucket. Only registered images belonging to
-- a currently published listing can be signed/read by public discovery clients.
create function private.public_can_read_listing_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listing_photos p join public.listings l on l.id = p.listing_id
    where p.storage_path = p_name and l.status = 'published');
$$;
create policy qualia_photos_read_published on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos' and private.public_can_read_listing_object(name));

create function private.effective_booking_status(p_status public.booking_status,
  p_request_expires_at timestamptz, p_payment_deadline_at timestamptz, p_starts_at timestamptz)
returns public.booking_status language sql stable security invoker set search_path = '' as $$
  select case when p_status in ('requested', 'awaiting_payment') and p_starts_at <= now() then 'expired'::public.booking_status
    when p_status = 'requested' and p_request_expires_at <= now() then 'expired'::public.booking_status
    when p_status = 'awaiting_payment' and p_payment_deadline_at <= now() then 'expired'::public.booking_status
    else p_status end;
$$;

-- Caller MUST hold the host advisory lock. This helper is never client-callable.
create function private.expire_host_bookings(p_host_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  with expired as (
    update public.bookings set status = 'expired' where host_id = p_host_id
      and status in ('requested', 'awaiting_payment')
      and private.effective_booking_status(status, request_expires_at, payment_deadline_at, starts_at) = 'expired'
    returning id
  ) insert into private.booking_events(booking_id, event) select id, 'expired' from expired;
end;
$$;

-- Public RPC returns only computed times and price, never reservation identities.
-- A duration-based grid avoids imposing an unapproved minimum experience length.
create function private.list_booking_slots(p_listing_id uuid, p_from timestamptz, p_until timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz, price_cents integer, currency text)
language plpgsql stable security definer set search_path = '' as $$
declare item public.listings%rowtype;
begin
  if p_from is null or p_until is null or p_until <= p_from or p_until - p_from > interval '31 days' then
    raise exception 'Choose a calendar range of at most 31 days.' using errcode = '22023';
  end if;
  if not exists (select 1 from private.booking_policy where singleton and enabled) then return; end if;
  select * into item from public.listings where id = p_listing_id and status = 'published';
  if not found then return; end if;
  return query select s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', item.price_cents, item.currency
  from public.availability_windows a
  cross join lateral generate_series(a.starts_at, a.ends_at - item.duration_minutes * interval '1 minute',
    item.duration_minutes * interval '1 minute') s(slot_start)
  where a.listing_id = item.id and a.ends_at > p_from and a.starts_at < p_until
    and s.slot_start >= p_from and s.slot_start < p_until and s.slot_start > now()
    and not exists (select 1 from public.bookings b where b.host_id = item.host_id
      and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at)
        in ('requested', 'awaiting_payment', 'confirmed')
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
  order by s.slot_start limit 2000;
end;
$$;

create function private.request_booking(p_listing_id uuid, p_starts_at timestamptz, p_guest_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_verified_user(); listing_host_id uuid;
  item public.listings%rowtype; policy private.booking_policy%rowtype;
  new_id uuid; ends_at_value timestamptz;
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
  select * into policy from private.booking_policy where singleton and enabled for share;
  if not found then raise exception 'Booking requests are not open yet.' using errcode = '55000'; end if;
  if (select count(*) from public.bookings where guest_id = actor_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have reached the daily booking request limit.' using errcode = '54000';
  end if;
  ends_at_value := p_starts_at + item.duration_minutes * interval '1 minute';
  if not exists (select 1 from public.availability_windows a where a.listing_id = item.id
    and a.starts_at <= p_starts_at and a.ends_at >= ends_at_value
    and mod(extract(epoch from (p_starts_at - a.starts_at)), (item.duration_minutes * 60)::numeric) = 0) then
    raise exception 'Choose one of the available times on the calendar.' using errcode = '22023';
  end if;
  perform private.expire_host_bookings(listing_host_id);
  if exists (select 1 from public.bookings b where b.host_id = listing_host_id
    and b.status in ('requested', 'awaiting_payment', 'confirmed')
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, ends_at_value, '[)')) then
    raise exception 'This host is no longer available at that time.' using errcode = '23P01';
  end if;
  if not exists (select 1 from private.listing_locations where listing_id = item.id) then
    raise exception 'This experience is missing its meeting details.' using errcode = '55000';
  end if;
  insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, amount_cents, currency,
    guest_message, request_expires_at, listing_title_snapshot, listing_category_snapshot,
    listing_city_snapshot, listing_neighborhood_snapshot, duration_minutes_snapshot,
    policy_request_expiry_minutes, policy_payment_deadline_minutes)
  values (item.id, item.host_id, actor_id, p_starts_at, ends_at_value, item.price_cents, item.currency,
    btrim(coalesce(p_guest_message, '')), least(p_starts_at, now() + policy.request_expiry_minutes * interval '1 minute'),
    item.title, item.category, item.city, item.neighborhood, item.duration_minutes,
    policy.request_expiry_minutes, policy.payment_deadline_minutes) returning id into new_id;
  insert into private.booking_meeting_locations(booking_id, address_line1, address_line2, postal_code, meeting_instructions)
    select new_id, address_line1, address_line2, postal_code, meeting_instructions
    from private.listing_locations where listing_id = item.id;
  insert into private.booking_events(booking_id, actor_id, event) values (new_id, actor_id, 'requested');
  return new_id;
end;
$$;

create function private.lock_participant_booking(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user(); booking_host_id uuid; item public.bookings%rowtype;
begin
  select host_id into booking_host_id from public.bookings where id = p_booking_id
    and actor_id in (host_id, guest_id);
  if booking_host_id is null then raise exception 'Booking unavailable.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(booking_host_id::text));
  perform private.expire_host_bookings(booking_host_id);
  select * into item from public.bookings where id = p_booking_id for update;
  return item;
end;
$$;

create function private.respond_booking(p_booking_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.bookings%rowtype := private.lock_participant_booking(p_booking_id);
begin
  if auth.uid() <> item.host_id then raise exception 'Only the host can respond.' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('accept', 'decline') then
    raise exception 'Choose accept or decline.' using errcode = '22023';
  end if;
  if item.status <> 'requested' then raise exception 'This request is no longer awaiting a host response.' using errcode = '55000'; end if;
  if p_decision = 'accept' then
    if item.policy_payment_deadline_minutes is null or not exists (
      select 1 from public.listings where id = item.listing_id and status = 'published'
    ) then raise exception 'This experience cannot currently accept requests.' using errcode = '55000'; end if;
    update public.bookings set status = 'awaiting_payment',
      payment_deadline_at = least(starts_at, now() + policy_payment_deadline_minutes * interval '1 minute')
      where id = p_booking_id;
    insert into private.booking_events(booking_id, actor_id, event) values (p_booking_id, auth.uid(), 'accepted');
  else
    update public.bookings set status = 'declined' where id = p_booking_id;
    insert into private.booking_events(booking_id, actor_id, event) values (p_booking_id, auth.uid(), 'declined');
  end if;
end;
$$;

create function private.cancel_unpaid_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.bookings%rowtype := private.lock_participant_booking(p_booking_id);
begin
  if item.status not in ('requested', 'awaiting_payment') then
    raise exception 'Only an unpaid request can be cancelled here. Contact support for a paid booking.' using errcode = '55000';
  end if;
  -- Phase 5 must also inspect/expire any in-flight Stripe checkout before this
  -- transition. A verified payment event must never lose its conflict lock.
  update public.bookings set status = 'cancelled' where id = p_booking_id;
  insert into private.booking_events(booking_id, actor_id, event) values (p_booking_id, auth.uid(), 'cancelled');
end;
$$;

create function private.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz,
  ends_at timestamptz, status public.booking_status, amount_cents integer, currency text,
  guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz,
  created_at timestamptz, updated_at timestamptz, listing_title text,
  listing_category public.experience_category, listing_city text, host_name text, guest_name text)
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user();
begin
  if p_role is null or p_role not in ('guest', 'host') then
    raise exception 'Choose guest or host bookings.' using errcode = '22023';
  end if;
  return query select b.id, b.listing_id, b.host_id, b.guest_id, b.starts_at, b.ends_at,
    private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at),
    b.amount_cents, b.currency, b.guest_message, b.request_expires_at, b.payment_deadline_at, b.created_at, b.updated_at,
    coalesce(nullif(b.listing_title_snapshot, ''), l.title), coalesce(b.listing_category_snapshot, l.category),
    coalesce(b.listing_city_snapshot, l.city), h.display_name, coalesce(nullif(g.full_name, ''), 'Guest')
  from public.bookings b join public.listings l on l.id = b.listing_id
    join public.host_profiles h on h.user_id = b.host_id join public.profiles g on g.id = b.guest_id
  where (p_role = 'guest' and b.guest_id = actor_id) or (p_role = 'host' and b.host_id = actor_id)
  order by b.created_at desc limit 500;
end;
$$;

create function private.get_booking_details(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user(); item public.bookings%rowtype; result jsonb;
begin
  select * into item from public.bookings where id = p_booking_id
    and (actor_id in (host_id, guest_id) or exists (select 1 from private.admin_memberships where user_id = actor_id));
  if not found then raise exception 'Booking unavailable.' using errcode = '42501'; end if;
  item.status := private.effective_booking_status(item.status, item.request_expires_at, item.payment_deadline_at, item.starts_at);
  select jsonb_build_object(
    'booking', to_jsonb(item),
    'listing', jsonb_build_object('title', coalesce(nullif(item.listing_title_snapshot, ''), l.title),
      'category', coalesce(item.listing_category_snapshot, l.category), 'city', coalesce(item.listing_city_snapshot, l.city),
      'neighborhood', coalesce(item.listing_neighborhood_snapshot, l.neighborhood), 'time_zone', l.time_zone,
      'duration_minutes', coalesce(item.duration_minutes_snapshot, l.duration_minutes)),
    'host', jsonb_build_object('user_id', h.user_id, 'display_name', h.display_name, 'bio', h.bio),
    'guest_name', coalesce(nullif(g.full_name, ''), 'Guest'),
    'meeting_location', case when item.status = 'confirmed' and actor_id in (item.host_id, item.guest_id)
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

create function private.send_booking_message(p_booking_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user(); new_id uuid;
begin
  if p_body is null or char_length(btrim(p_body)) not between 1 and 3000 then
    raise exception 'Messages must contain 1–3000 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bookings where id = p_booking_id and actor_id in (host_id, guest_id)) then
    raise exception 'Booking unavailable.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72462, pg_catalog.hashtext(actor_id::text));
  if (select count(*) from public.booking_messages where sender_id = actor_id and created_at > now() - interval '24 hours') >= 100 then
    raise exception 'You have reached the daily message limit.' using errcode = '54000';
  end if;
  insert into public.booking_messages(booking_id, sender_id, body) values (p_booking_id, actor_id, btrim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

-- Availability is operational calendar data, not a change to reviewed content.
-- Published hosts may add windows, or remove only windows without active holds
-- or confirmed bookings for ANY experience belonging to that host.
create function private.require_availability_listing(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); state public.listing_status;
begin
  select status into state from public.listings where id = p_listing_id and host_id = actor_id for update;
  if not found then raise exception 'Listing unavailable.' using errcode = '42501'; end if;
  if state not in ('draft', 'rejected', 'published') then
    raise exception 'Availability is locked while this listing is under review or paused.' using errcode = '55000';
  end if;
  return actor_id;
end;
$$;
create or replace function private.add_availability_window(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_availability_listing(p_listing_id); new_id uuid;
begin
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at
    or p_ends_at - p_starts_at > interval '24 hours' then
    raise exception 'Choose a valid future availability window of at most 24 hours.' using errcode = '22023';
  end if;
  if p_ends_at - p_starts_at < (select duration_minutes * interval '1 minute' from public.listings where id = p_listing_id) then
    raise exception 'Availability must be long enough for the experience.' using errcode = '22023';
  end if;
  if exists (select 1 from public.availability_windows a where a.listing_id = p_listing_id
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then
    raise exception 'This availability overlaps an existing window.' using errcode = '23P01';
  end if;
  insert into public.availability_windows(listing_id, host_id, starts_at, ends_at)
    values (p_listing_id, actor_id, p_starts_at, p_ends_at) returning id into new_id;
  return new_id;
end;
$$;
create or replace function private.remove_availability_window(p_window_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare window_row public.availability_windows%rowtype; actor_id uuid := private.require_verified_host();
begin
  select * into window_row from public.availability_windows where id = p_window_id and host_id = actor_id;
  if not found then raise exception 'Availability unavailable.' using errcode = '42501'; end if;
  perform private.require_availability_listing(window_row.listing_id);
  perform private.expire_host_bookings(actor_id);
  if exists (select 1 from public.bookings b where b.host_id = actor_id
    and b.status in ('requested', 'awaiting_payment', 'confirmed')
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(window_row.starts_at, window_row.ends_at, '[)')) then
    raise exception 'This window has an active booking or request and cannot be removed.' using errcode = '55000';
  end if;
  delete from public.availability_windows where id = p_window_id;
end;
$$;

create function private.create_support_request(p_subject text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_user(); new_id uuid;
begin
  if p_subject is null or char_length(btrim(p_subject)) not between 3 and 160
    or p_message is null or char_length(btrim(p_message)) not between 10 and 5000 then
    raise exception 'Add a subject (3–160 characters) and message (10–5000 characters).' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72462, pg_catalog.hashtext(actor_id::text));
  if (select count(*) from public.support_requests where user_id = actor_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have reached the daily support request limit.' using errcode = '54000';
  end if;
  insert into public.support_requests(user_id, subject, message) values (actor_id, btrim(p_subject), btrim(p_message)) returning id into new_id;
  return new_id;
end;
$$;
create function private.respond_support_request(p_request_id uuid, p_response text, p_close boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_admin();
begin
  if p_response is null or char_length(btrim(p_response)) not between 1 and 5000 or p_close is null then
    raise exception 'Add a response of 1–5000 characters and choose whether to close the request.' using errcode = '22023';
  end if;
  perform 1 from public.support_requests where id = p_request_id for update;
  if not found then raise exception 'Support request unavailable.' using errcode = 'P0002'; end if;
  update public.support_requests set response = btrim(p_response), responded_at = now(),
    status = case when p_close then 'closed' else 'open' end where id = p_request_id;
  insert into private.support_response_history(request_id, responder_id, response, closed)
    values (p_request_id, actor_id, btrim(p_response), p_close);
end;
$$;

-- Schema usage permits the invoker wrappers to call only explicitly granted
-- safe helpers. It does not expose the schema through the Data API.
grant usage on schema private to anon;
revoke all on function private.require_verified_user() from public, anon, authenticated;
revoke all on function private.effective_booking_status(public.booking_status, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.expire_host_bookings(uuid) from public, anon, authenticated;
revoke all on function private.lock_participant_booking(uuid) from public, anon, authenticated;
revoke all on function private.require_availability_listing(uuid) from public, anon, authenticated;
revoke all on function private.public_can_read_listing_object(text) from public, anon, authenticated;
grant execute on function private.public_can_read_listing_object(text) to anon, authenticated;

revoke all on function private.get_booking_policy() from public, anon, authenticated;
grant execute on function private.get_booking_policy() to anon, authenticated;
create function public.get_booking_policy()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_booking_policy();
$$;
revoke all on function public.get_booking_policy() from public, anon, authenticated;
grant execute on function public.get_booking_policy() to anon, authenticated;

revoke all on function private.admin_set_booking_policy(integer, integer, boolean) from public, anon, authenticated;
grant execute on function private.admin_set_booking_policy(integer, integer, boolean) to authenticated;
create function public.admin_set_booking_policy(p_request_expiry_minutes integer, p_payment_deadline_minutes integer, p_enabled boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_set_booking_policy(p_request_expiry_minutes, p_payment_deadline_minutes, p_enabled);
$$;
revoke all on function public.admin_set_booking_policy(integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_booking_policy(integer, integer, boolean) to authenticated;

revoke all on function private.list_booking_slots(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.list_booking_slots(uuid, timestamptz, timestamptz) to anon, authenticated;
create function public.list_booking_slots(p_listing_id uuid, p_from timestamptz, p_until timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz, price_cents integer, currency text) language sql security invoker set search_path = '' as $$
  select * from private.list_booking_slots(p_listing_id, p_from, p_until);
$$;
revoke all on function public.list_booking_slots(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.list_booking_slots(uuid, timestamptz, timestamptz) to anon, authenticated;

revoke all on function private.request_booking(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function private.request_booking(uuid, timestamptz, text) to authenticated;
create function public.request_booking(p_listing_id uuid, p_starts_at timestamptz, p_guest_message text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.request_booking(p_listing_id, p_starts_at, p_guest_message);
$$;
revoke all on function public.request_booking(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.request_booking(uuid, timestamptz, text) to authenticated;

revoke all on function private.respond_booking(uuid, text) from public, anon, authenticated;
grant execute on function private.respond_booking(uuid, text) to authenticated;
create function public.respond_booking(p_booking_id uuid, p_decision text)
returns void language sql security invoker set search_path = '' as $$
  select private.respond_booking(p_booking_id, p_decision);
$$;
revoke all on function public.respond_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.respond_booking(uuid, text) to authenticated;

revoke all on function private.cancel_unpaid_booking(uuid) from public, anon, authenticated;
grant execute on function private.cancel_unpaid_booking(uuid) to authenticated;
create function public.cancel_unpaid_booking(p_booking_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.cancel_unpaid_booking(p_booking_id);
$$;
revoke all on function public.cancel_unpaid_booking(uuid) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_booking(uuid) to authenticated;

revoke all on function private.list_my_bookings(text) from public, anon, authenticated;
grant execute on function private.list_my_bookings(text) to authenticated;
create function public.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz, ends_at timestamptz, status public.booking_status, amount_cents integer, currency text, guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz, created_at timestamptz, updated_at timestamptz, listing_title text, listing_category public.experience_category, listing_city text, host_name text, guest_name text) language sql security invoker set search_path = '' as $$
  select * from private.list_my_bookings(p_role);
$$;
revoke all on function public.list_my_bookings(text) from public, anon, authenticated;
grant execute on function public.list_my_bookings(text) to authenticated;

revoke all on function private.get_booking_details(uuid) from public, anon, authenticated;
grant execute on function private.get_booking_details(uuid) to authenticated;
create function public.get_booking_details(p_booking_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_booking_details(p_booking_id);
$$;
revoke all on function public.get_booking_details(uuid) from public, anon, authenticated;
grant execute on function public.get_booking_details(uuid) to authenticated;

revoke all on function private.send_booking_message(uuid, text) from public, anon, authenticated;
grant execute on function private.send_booking_message(uuid, text) to authenticated;
create function public.send_booking_message(p_booking_id uuid, p_body text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.send_booking_message(p_booking_id, p_body);
$$;
revoke all on function public.send_booking_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_booking_message(uuid, text) to authenticated;

revoke all on function private.create_support_request(text, text) from public, anon, authenticated;
grant execute on function private.create_support_request(text, text) to authenticated;
create function public.create_support_request(p_subject text, p_message text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_support_request(p_subject, p_message);
$$;
revoke all on function public.create_support_request(text, text) from public, anon, authenticated;
grant execute on function public.create_support_request(text, text) to authenticated;

revoke all on function private.respond_support_request(uuid, text, boolean) from public, anon, authenticated;
grant execute on function private.respond_support_request(uuid, text, boolean) to authenticated;
create function public.respond_support_request(p_request_id uuid, p_response text, p_close boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.respond_support_request(p_request_id, p_response, p_close);
$$;
revoke all on function public.respond_support_request(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.respond_support_request(uuid, text, boolean) to authenticated;

commit;
