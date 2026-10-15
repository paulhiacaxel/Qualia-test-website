-- New requests need a payable window. Stripe Checkout creation needs 31 minutes
-- in the gateway; a 32-minute floor leaves a small handoff margin. This is a
-- validity minimum, not a selected commercial deadline (the owner still chooses).
-- Existing policy/booking rows and captured deadlines are never rewritten.
-- A historical sub-32-minute policy reads as closed to NEW requests; its raw
-- values remain visible so the owner can deliberately replace it. Legacy pending
-- requests with too-short captured settings can be declined, not silently extended.
begin;

create or replace function private.get_booking_policy()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('enabled', enabled and payment_deadline_minutes >= 32,
    'request_expiry_minutes', request_expiry_minutes, 'payment_deadline_minutes', payment_deadline_minutes)
    from private.booking_policy where singleton),
    jsonb_build_object('enabled', false, 'request_expiry_minutes', null, 'payment_deadline_minutes', null));
$$;

create or replace function private.admin_set_booking_policy(p_request_expiry_minutes integer,
  p_payment_deadline_minutes integer, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_admin();
begin
  if p_enabled is null or (p_enabled and (p_request_expiry_minutes is null or p_payment_deadline_minutes is null))
    or (p_request_expiry_minutes is not null and p_request_expiry_minutes not between 1 and 10080)
    or (p_payment_deadline_minutes is not null and p_payment_deadline_minutes not between 32 and 10080) then
    raise exception 'Choose a host response deadline of 1–10080 minutes and a payment deadline of 32–10080 minutes.' using errcode = '22023';
  end if;
  insert into private.booking_policy(singleton, request_expiry_minutes, payment_deadline_minutes, enabled, approved_by)
    values (true, p_request_expiry_minutes, p_payment_deadline_minutes, p_enabled, actor_id)
    on conflict (singleton) do update set request_expiry_minutes = excluded.request_expiry_minutes,
      payment_deadline_minutes = excluded.payment_deadline_minutes, enabled = excluded.enabled,
      approved_by = actor_id, approved_at = now();
  insert into private.booking_policy_history(actor_id, settings) values (actor_id, private.get_booking_policy());
end;
$$;

create or replace function private.request_booking(p_listing_id uuid, p_starts_at timestamptz, p_guest_message text)
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
  select * into policy from private.booking_policy where singleton and enabled and payment_deadline_minutes >= 32 for share;
  if not found then raise exception 'Booking requests are not open yet.' using errcode = '55000'; end if;
  if p_starts_at <= clock_timestamp() + interval '32 minutes' then
    raise exception 'Choose a time more than 32 minutes away so your host can respond and you can start payment.' using errcode = 'QL001';
  end if;
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
    btrim(coalesce(p_guest_message, '')), least(p_starts_at - interval '32 minutes', now() + policy.request_expiry_minutes * interval '1 minute'),
    item.title, item.category, item.city, item.neighborhood, item.duration_minutes,
    policy.request_expiry_minutes, policy.payment_deadline_minutes) returning id into new_id;
  insert into private.booking_meeting_locations(booking_id, address_line1, address_line2, postal_code, meeting_instructions)
    select new_id, address_line1, address_line2, postal_code, meeting_instructions
    from private.listing_locations where listing_id = item.id;
  insert into private.booking_events(booking_id, actor_id, event) values (new_id, actor_id, 'requested');
  return new_id;
end;
$$;

create or replace function private.respond_booking(p_booking_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.bookings%rowtype := private.lock_participant_booking(p_booking_id);
begin
  if auth.uid() <> item.host_id then raise exception 'Only the host can respond.' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('accept', 'decline') then
    raise exception 'Choose accept or decline.' using errcode = '22023';
  end if;
  if item.status <> 'requested' then raise exception 'This request is no longer awaiting a host response.' using errcode = '55000'; end if;
  if p_decision = 'accept' then
    if item.policy_payment_deadline_minutes is null or item.policy_payment_deadline_minutes < 32
      or item.starts_at <= clock_timestamp() + interval '32 minutes' then
      raise exception 'This request no longer leaves enough time to start payment. Decline it or ask the guest to request a later time.' using errcode = 'QL001';
    end if;
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

create or replace function private.list_booking_slots(p_listing_id uuid, p_from timestamptz, p_until timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz, price_cents integer, currency text)
language plpgsql stable security definer set search_path = '' as $$
declare item public.listings%rowtype;
begin
  if p_from is null or p_until is null or p_until <= p_from or p_until - p_from > interval '31 days' then
    raise exception 'Choose a calendar range of at most 31 days.' using errcode = '22023';
  end if;
  if not exists (select 1 from private.booking_policy where singleton and enabled and payment_deadline_minutes >= 32) then return; end if;
  select * into item from public.listings where id = p_listing_id and status = 'published';
  if not found then return; end if;
  return query select s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', item.price_cents, item.currency
  from public.availability_windows a
  cross join lateral generate_series(a.starts_at, a.ends_at - item.duration_minutes * interval '1 minute',
    item.duration_minutes * interval '1 minute') s(slot_start)
  where a.listing_id = item.id and a.ends_at > p_from and a.starts_at < p_until
    and s.slot_start >= p_from and s.slot_start < p_until and s.slot_start > now() + interval '32 minutes'
    and not exists (select 1 from public.bookings b where b.host_id = item.host_id
      and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id)
        in ('requested', 'awaiting_payment', 'confirmed')
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
  order by s.slot_start limit 2000;
end;
$$;

create or replace function private.pay_checkout_terms(p_actor_id uuid,p_booking_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; a private.payment_attempts%rowtype; policy uuid; result jsonb;
begin
  perform private.financial_actor(p_actor_id);
  select * into b from public.bookings where id=p_booking_id and guest_id=p_actor_id;
  if not found then raise exception 'Booking unavailable.' using errcode='42501'; end if;
  select * into a from private.payment_attempts where booking_id=b.id and environment=p_environment and state in ('preparing','open','processing','paid','quarantined') limit 1;
  policy := a.policy_id;
  if policy is null then select policy_id into policy from private.commercial_settings where environment=p_environment and enabled; end if;
  if policy is null then raise exception 'Payments are not enabled.' using errcode='55000'; end if;
  select jsonb_build_object('policy_id',id,'amount_cents',b.amount_cents,'currency',b.currency,
    'terms_version',terms_version,'cancellation_terms',cancellation_terms,
    'booking_status',b.status,'starts_at',b.starts_at,'payment_deadline_at',b.payment_deadline_at,
    'checkout_state',a.state,'checkout_session_exists',a.session_id is not null,'checkout_expires_at',a.expires_at,
    'host_account_id',(select account_id from private.stripe_accounts where host_id=b.host_id and environment=p_environment))
    into result from private.commercial_policies where id=policy;
  return result;
end $$;

commit;
