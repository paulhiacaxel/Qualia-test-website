-- Phase 6: transactional emails are queued in the booking transaction. No SMTP
-- calls occur inside PostgreSQL and no untrusted client can enqueue a message.
begin;
create table private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('new_request','accepted','confirmed','cancelled','request_closed','reminder_24h')),
  event_key text not null default '',
  scheduled_starts_at timestamptz not null,
  available_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','accepted','skipped','failed','review')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  first_send_at timestamptz,
  -- Frozen before the first API call so retries use exactly the same payload.
  provider_payload jsonb,
  provider_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (booking_id, kind, recipient_id, event_key)
);
create index email_outbox_due_idx on private.email_outbox(available_at, created_at)
  where status in ('pending','processing');
create index email_outbox_recipient_idx on private.email_outbox(recipient_id);
alter table private.email_outbox enable row level security;
revoke all on private.email_outbox from public, anon, authenticated;
grant all on private.email_outbox to service_role;

create function private.enqueue_booking_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare email_kind text; recipients uuid[]; recipient uuid;
begin
  if TG_OP = 'INSERT' then
    if new.status = 'requested' then email_kind := 'new_request'; recipients := array[new.host_id]; end if;
  elsif new.status is distinct from old.status then
    case new.status
      when 'awaiting_payment' then email_kind := 'accepted'; recipients := array[new.guest_id];
      -- Phase 5 restricts this transition to verified canonical Stripe payment.
      when 'confirmed' then
        if exists(select 1 from private.payment_attempts where booking_id=new.id and state='paid') then
          email_kind := 'confirmed'; recipients := array[new.guest_id, new.host_id];
        end if;
      when 'cancelled' then email_kind := 'cancelled'; recipients := array[new.guest_id, new.host_id];
      when 'declined' then email_kind := 'request_closed'; recipients := array[new.guest_id];
      when 'expired' then email_kind := 'request_closed'; recipients := array[new.guest_id];
      else null;
    end case;
  end if;
  if email_kind is not null then
    foreach recipient in array recipients loop
      insert into private.email_outbox(booking_id,recipient_id,kind,scheduled_starts_at)
        values (new.id,recipient,email_kind,new.starts_at) on conflict do nothing;
    end loop;
  end if;
  -- Schedule the reminder only when there is a full 24-hour lead time. A booking
  -- confirmed later receives its confirmation, not an immediate duplicate reminder.
  if new.status = 'confirmed' and new.starts_at > now() + interval '24 hours'
    and exists(select 1 from private.payment_attempts where booking_id=new.id and state='paid')
    and (TG_OP = 'INSERT' or old.status is distinct from new.status or old.starts_at is distinct from new.starts_at) then
    foreach recipient in array array[new.guest_id,new.host_id] loop
      insert into private.email_outbox(booking_id,recipient_id,kind,event_key,scheduled_starts_at,available_at)
        values (new.id,recipient,'reminder_24h',extract(epoch from new.starts_at)::text,new.starts_at,new.starts_at - interval '24 hours')
        on conflict do nothing;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_booking_email() from public, anon, authenticated;
create trigger bookings_enqueue_email after insert or update of status, starts_at on public.bookings
  for each row execute function private.enqueue_booking_email();

-- Service-role RPCs intentionally use INVOKER rights. Grants, not a JWT claim
-- supplied as a parameter, authorize the worker. RLS blocks client table access.
create function public.email_claim_jobs(p_limit integer default 5)
returns table(id uuid,lease_token uuid,recipient_id uuid,attempts integer)
language plpgsql security invoker set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 5 then raise exception 'Invalid batch size.'; end if;
  -- Resend's deduplication window is 24h. Never automatically resend an ambiguous
  -- attempt outside that window; require reconciliation in the provider dashboard.
  update private.email_outbox o set status='review',last_error_code='idempotency_window_elapsed',lease_token=null,lease_until=null
    where o.status in ('pending','processing') and o.first_send_at <= now() - interval '23 hours'
      and (o.lease_until is null or o.lease_until <= now());
  update private.email_outbox o set status='failed',last_error_code='attempt_limit',lease_token=null,lease_until=null
    where o.status in ('pending','processing') and o.attempts >= 8 and (o.lease_until is null or o.lease_until <= now());
  return query with candidates as (
    select o.id from private.email_outbox o
      where o.available_at <= now() and o.attempts < 8
        and (o.status='pending' or (o.status='processing' and o.lease_until <= now()))
      order by o.available_at,o.created_at for update skip locked limit p_limit
  ) update private.email_outbox o set status='processing',lease_token=gen_random_uuid(),
      lease_until=now()+interval '5 minutes',attempts=o.attempts+1
    from candidates c where o.id=c.id returning o.id,o.lease_token,o.recipient_id,o.attempts;
end;
$$;

create function public.email_job_context(p_id uuid,p_lease_token uuid)
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
    'first_send_at',job.first_send_at);
end;
$$;

create function public.email_prepare_send(p_id uuid,p_lease_token uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare context jsonb; frozen jsonb;
begin
  context := public.email_job_context(p_id,p_lease_token);
  if context is null then return null; end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload->'to') <> 'array'
    or jsonb_array_length(p_payload->'to') <> 1 or not (p_payload ?& array['from','subject','html','text']) then
    raise exception 'Invalid email payload.';
  end if;
  update private.email_outbox set provider_payload=coalesce(provider_payload,p_payload),first_send_at=coalesce(first_send_at,now())
    where id=p_id and lease_token=p_lease_token returning provider_payload into frozen;
  return frozen;
end;
$$;

create function public.email_finish_job(p_id uuid,p_lease_token uuid,p_outcome text,p_provider_id text default null,p_error_code text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if p_outcome not in ('accepted','skipped','retry','failed','review') or p_outcome is null then raise exception 'Invalid outcome.'; end if;
  if p_outcome='accepted' and nullif(p_provider_id,'') is null then raise exception 'Provider acceptance needs an ID.'; end if;
  update private.email_outbox set
    status=case when p_outcome='retry' then case when attempts>=8 then 'failed' else 'pending' end else p_outcome end,
    available_at=case when p_outcome='retry' then now()+least(3600,power(2,attempts)::integer*30)*interval '1 second' else available_at end,
    provider_id=coalesce(p_provider_id,provider_id),accepted_at=case when p_outcome='accepted' then now() else accepted_at end,
    last_error_code=left(p_error_code,120),lease_token=null,lease_until=null
    where id=p_id and lease_token=p_lease_token and status='processing' and lease_until>now();
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
revoke all on function public.email_claim_jobs(integer),public.email_job_context(uuid,uuid),
  public.email_prepare_send(uuid,uuid,jsonb),public.email_finish_job(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.email_claim_jobs(integer),public.email_job_context(uuid,uuid),
  public.email_prepare_send(uuid,uuid,jsonb),public.email_finish_job(uuid,uuid,text,text,text) to service_role;
commit;
