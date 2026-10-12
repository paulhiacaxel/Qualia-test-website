-- Persist elapsed unpaid deadlines even when no participant revisits the app.
-- The resulting status transition queues the existing request-closed email.
begin;

create index bookings_unpaid_deadline_idx on public.bookings (
  least(starts_at, case when status = 'requested' then request_expires_at else payment_deadline_at end), id
) where status in ('requested', 'awaiting_payment');

create function private.expire_due_bookings(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare candidate record; expired_id uuid; expired_count integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Choose an expiry batch size between 1 and 100.' using errcode = '22023';
  end if;
  for candidate in
    select b.id, b.host_id from public.bookings b
    where b.status in ('requested', 'awaiting_payment')
      and least(b.starts_at, case when b.status = 'requested' then b.request_expires_at else b.payment_deadline_at end) <= now()
      and not private.financial_hold_active(b.id)
    order by least(b.starts_at, case when b.status = 'requested' then b.request_expires_at else b.payment_deadline_at end), b.id
    limit p_limit
  loop
    -- Match request/accept/payment reconciliation lock order. A busy host is
    -- retried on a later scheduler run; do not block an in-flight payment.
    if not pg_catalog.pg_try_advisory_xact_lock(72461, pg_catalog.hashtext(candidate.host_id::text)) then
      continue;
    end if;
    expired_id := null;
    update public.bookings b set status = 'expired'
      where b.id = candidate.id and b.status in ('requested', 'awaiting_payment')
        and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id) = 'expired'
      returning b.id into expired_id;
    if expired_id is not null then
      insert into private.booking_events(booking_id, event) values (expired_id, 'expired');
      expired_count := expired_count + 1;
    end if;
  end loop;
  return expired_count;
end;
$$;
revoke all on function private.expire_due_bookings(integer) from public, anon, authenticated;
grant execute on function private.expire_due_bookings(integer) to service_role;

-- The exposed entry point has no definer privileges. Browser roles cannot call
-- either entry point; the authenticated server worker is the only app caller.
create function public.expire_due_bookings(p_limit integer default 100)
returns integer language sql security invoker set search_path = '' as $$
  select private.expire_due_bookings(p_limit);
$$;
revoke all on function public.expire_due_bookings(integer) from public, anon, authenticated;
grant execute on function public.expire_due_bookings(integer) to service_role;

commit;
