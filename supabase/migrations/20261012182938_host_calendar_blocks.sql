-- Host-wide busy time is independent of a listing's offered availability.
-- Commands, booking admission and payment already share host lock 72461.
-- Ranges are half open, so a session ending at a block's start remains valid.
begin;

create table public.host_calendar_imports (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  imported_at timestamptz not null default now(),
  range_starts_at timestamptz not null,
  range_ends_at timestamptz not null,
  event_count integer not null check (event_count between 0 and 2000),
  unique(id, host_id),
  check (isfinite(range_starts_at) and isfinite(range_ends_at) and range_ends_at > range_starts_at
    and range_ends_at - range_starts_at <= interval '367 days')
);
create index host_calendar_imports_host_idx on public.host_calendar_imports(host_id);

create table public.host_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default '' check (char_length(label) <= 120),
  source text not null check (source in ('manual', 'ical')),
  import_id uuid,
  created_at timestamptz not null default now(),
  foreign key (import_id, host_id) references public.host_calendar_imports(id, host_id) on delete cascade,
  check ((source = 'manual' and import_id is null) or (source = 'ical' and import_id is not null)),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
    and ends_at - starts_at <= interval '366 days')
);
create index host_calendar_blocks_host_time_idx on public.host_calendar_blocks(host_id, starts_at, ends_at);
create index host_calendar_blocks_import_idx on public.host_calendar_blocks(import_id, host_id);
alter table public.host_calendar_imports enable row level security;
alter table public.host_calendar_blocks enable row level security;
revoke all on public.host_calendar_imports, public.host_calendar_blocks from public, anon, authenticated;
grant select on public.host_calendar_imports, public.host_calendar_blocks to authenticated;
grant all on public.host_calendar_imports, public.host_calendar_blocks to service_role;
create policy calendar_imports_read_owner on public.host_calendar_imports for select to authenticated
  using (host_id = (select auth.uid()));
create policy calendar_blocks_read_owner on public.host_calendar_blocks for select to authenticated
  using (host_id = (select auth.uid()));

-- The inverse guards serialize either ordering: block first rejects request;
-- request first rejects block. Existing requests are never silently cancelled.
create function private.guard_host_calendar_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(new.host_id::text));
  if exists (select 1 from public.bookings b where b.host_id = new.host_id
    and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id)
      in ('requested', 'awaiting_payment', 'confirmed')
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')) then
    raise exception 'This time overlaps an active Qualia request or booking. Resolve it before blocking this time.' using errcode = 'QL002';
  end if;
  return new;
end;
$$;
create trigger host_calendar_blocks_guard before insert or update on public.host_calendar_blocks
  for each row execute function private.guard_host_calendar_block();

create function private.guard_booking_calendar_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('requested', 'awaiting_payment', 'confirmed') then
    perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(new.host_id::text));
    if exists (select 1 from public.host_calendar_blocks b where b.host_id = new.host_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')) then
      raise exception 'This host is no longer available at that time.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_calendar_block_guard before insert or update of host_id, starts_at, ends_at, status
  on public.bookings for each row execute function private.guard_booking_calendar_block();

create function private.add_host_calendar_block(p_starts_at timestamptz, p_ends_at timestamptz, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); new_id uuid;
begin
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at <= now() or p_starts_at < now() - interval '366 days' or p_ends_at <= p_starts_at
    or p_ends_at - p_starts_at > interval '366 days' or char_length(coalesce(p_label, '')) > 120 then
    raise exception 'Choose a busy range of up to one year that ends in the future and a label under 120 characters.' using errcode = '22023';
  end if;
  if (select count(*) from public.host_calendar_blocks where host_id = actor_id and source = 'manual' and ends_at > now()) >= 500 then
    raise exception 'Remove an unused block before adding another.' using errcode = '54000';
  end if;
  insert into public.host_calendar_blocks(host_id, starts_at, ends_at, label, source)
    values (actor_id, p_starts_at, p_ends_at, btrim(coalesce(p_label, '')), 'manual') returning id into new_id;
  return new_id;
end;
$$;

create function private.remove_host_calendar_block(p_block_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host();
begin
  delete from public.host_calendar_blocks where id = p_block_id and host_id = actor_id and source = 'manual';
  if not found then raise exception 'Block unavailable. Imported times must be replaced or removed as one calendar.' using errcode = '42501'; end if;
end;
$$;

-- Store only busy intervals. Raw files, external UIDs, event descriptions,
-- locations and invitees never enter the database. Replacing is atomic.
create function private.save_host_calendar_import(p_import_id uuid, p_label text,
  p_range_starts_at timestamptz, p_range_ends_at timestamptz, p_blocks jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); import_key uuid := coalesce(p_import_id, gen_random_uuid());
  block jsonb; start_value timestamptz; end_value timestamptz;
begin
  if p_label is null or char_length(btrim(p_label)) not between 1 and 120
    or p_range_starts_at is null or p_range_ends_at is null or not isfinite(p_range_starts_at) or not isfinite(p_range_ends_at)
    or p_range_starts_at < now() - interval '1 day' or p_range_starts_at > now() + interval '1 hour'
    or p_range_ends_at <= p_range_starts_at or p_range_ends_at - p_range_starts_at > interval '367 days'
    or p_blocks is null or jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 2000 then
    raise exception 'Choose a calendar with at most 2000 busy ranges within the next year.' using errcode = '22023';
  end if;
  if p_import_id is not null then
    perform 1 from public.host_calendar_imports where id = p_import_id and host_id = actor_id for update;
    if not found then raise exception 'Calendar import unavailable.' using errcode = '42501'; end if;
  elsif (select count(*) from public.host_calendar_imports where host_id = actor_id) >= 5 then
    raise exception 'You can keep up to five calendar imports. Replace an existing import to refresh it.' using errcode = '54000';
  end if;
  for block in select value from jsonb_array_elements(p_blocks) loop
    if jsonb_typeof(block) <> 'object' or block->>'starts_at' is null or block->>'ends_at' is null then
      raise exception 'Invalid calendar interval.' using errcode = '22023';
    end if;
    start_value := (block->>'starts_at')::timestamptz;
    end_value := (block->>'ends_at')::timestamptz;
    if not isfinite(start_value) or not isfinite(end_value) or end_value <= start_value
      or start_value < p_range_starts_at or end_value > p_range_ends_at
      or end_value - start_value > interval '366 days' then
      raise exception 'A calendar interval falls outside the import range.' using errcode = '22023';
    end if;
  end loop;
  insert into public.host_calendar_imports(id, host_id, label, range_starts_at, range_ends_at, event_count)
    values (import_key, actor_id, btrim(p_label), p_range_starts_at, p_range_ends_at, jsonb_array_length(p_blocks))
    on conflict (id) do update set label = excluded.label, imported_at = now(),
      range_starts_at = excluded.range_starts_at, range_ends_at = excluded.range_ends_at, event_count = excluded.event_count;
  delete from public.host_calendar_blocks where import_id = import_key and host_id = actor_id;
  insert into public.host_calendar_blocks(host_id, starts_at, ends_at, label, source, import_id)
    select actor_id, (value->>'starts_at')::timestamptz, (value->>'ends_at')::timestamptz,
      'Imported busy time', 'ical', import_key from jsonb_array_elements(p_blocks);
  return import_key;
end;
$$;

create function private.remove_host_calendar_import(p_import_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host();
begin
  delete from public.host_calendar_imports where id = p_import_id and host_id = actor_id;
  if not found then raise exception 'Calendar import unavailable.' using errcode = '42501'; end if;
end;
$$;

create function private.add_availability_windows(p_listing_id uuid, p_windows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); item jsonb; count_value integer := 0;
begin
  if p_windows is null or jsonb_typeof(p_windows) <> 'array' or jsonb_array_length(p_windows) not between 1 and 40 then
    raise exception 'Choose between one and forty availability windows.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_windows) loop
    perform private.add_availability_window(p_listing_id, (item->>'starts_at')::timestamptz, (item->>'ends_at')::timestamptz);
    count_value := count_value + 1;
  end loop;
  return count_value;
end;
$$;

create function private.edit_availability_window(p_window_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); item public.availability_windows%rowtype;
begin
  select * into item from public.availability_windows where id = p_window_id and host_id = actor_id;
  if not found then raise exception 'Availability unavailable.' using errcode = '42501'; end if;
  -- Reuse the existing review/booking protections. If adding fails, the original
  -- window is restored by the transaction, including its original identifier.
  perform private.remove_availability_window(item.id);
  perform private.add_availability_window(item.listing_id, p_starts_at, p_ends_at);
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
    and not exists (select 1 from public.host_calendar_blocks b where b.host_id = item.host_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
  order by s.slot_start limit 2000;
end;
$$;

create function public.add_host_calendar_block(p_starts_at timestamptz, p_ends_at timestamptz, p_label text)
returns uuid language sql security invoker set search_path = '' as $$ select private.add_host_calendar_block(p_starts_at, p_ends_at, p_label); $$;
create function public.remove_host_calendar_block(p_block_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.remove_host_calendar_block(p_block_id); $$;
create function public.save_host_calendar_import(p_import_id uuid, p_label text, p_range_starts_at timestamptz, p_range_ends_at timestamptz, p_blocks jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select private.save_host_calendar_import(p_import_id, p_label, p_range_starts_at, p_range_ends_at, p_blocks); $$;
create function public.remove_host_calendar_import(p_import_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.remove_host_calendar_import(p_import_id); $$;
create function public.add_availability_windows(p_listing_id uuid, p_windows jsonb)
returns integer language sql security invoker set search_path = '' as $$ select private.add_availability_windows(p_listing_id, p_windows); $$;
create function public.edit_availability_window(p_window_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns void language sql security invoker set search_path = '' as $$ select private.edit_availability_window(p_window_id, p_starts_at, p_ends_at); $$;

revoke all on function private.guard_host_calendar_block(), private.guard_booking_calendar_block() from public, anon, authenticated;
revoke all on function private.add_host_calendar_block(timestamptz, timestamptz, text),
  private.remove_host_calendar_block(uuid), private.save_host_calendar_import(uuid, text, timestamptz, timestamptz, jsonb),
  private.remove_host_calendar_import(uuid), private.add_availability_windows(uuid, jsonb),
  private.edit_availability_window(uuid, timestamptz, timestamptz),
  public.add_host_calendar_block(timestamptz, timestamptz, text), public.remove_host_calendar_block(uuid),
  public.save_host_calendar_import(uuid, text, timestamptz, timestamptz, jsonb), public.remove_host_calendar_import(uuid),
  public.add_availability_windows(uuid, jsonb), public.edit_availability_window(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function private.add_host_calendar_block(timestamptz, timestamptz, text),
  private.remove_host_calendar_block(uuid), private.save_host_calendar_import(uuid, text, timestamptz, timestamptz, jsonb),
  private.remove_host_calendar_import(uuid), private.add_availability_windows(uuid, jsonb),
  private.edit_availability_window(uuid, timestamptz, timestamptz),
  public.add_host_calendar_block(timestamptz, timestamptz, text), public.remove_host_calendar_block(uuid),
  public.save_host_calendar_import(uuid, text, timestamptz, timestamptz, jsonb), public.remove_host_calendar_import(uuid),
  public.add_availability_windows(uuid, jsonb), public.edit_availability_window(uuid, timestamptz, timestamptz)
  to authenticated;

-- Late successful payment after an expired hold must be quarantined for refund
-- review, not retry forever against the booking trigger or confirm a blocked time.
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
    elsif exists(select 1 from private.payment_attempts where booking_id=b.id and id<>a.id and state in ('preparing','open','processing','paid','quarantined')) then
      problem:='Another payment attempt or exception exists for this booking.';
    elsif exists(select 1 from public.host_calendar_blocks busy where busy.host_id=b.host_id
      and tstzrange(busy.starts_at,busy.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then
      problem:='The host blocked this time after the booking expired; manual refund review required.';
    elsif exists(select 1 from public.bookings other where other.host_id=b.host_id and other.id<>b.id
      and other.status in ('requested','awaiting_payment','confirmed','completed')
      and tstzrange(other.starts_at,other.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then
      problem:='The host time is no longer available; manual refund review required.';
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

commit;
