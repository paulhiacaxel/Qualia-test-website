-- Phase 5: private money ledger; every processor command is service-role only.
-- No commercial settings, connected accounts, or promotions are seeded.
begin;

create table private.commercial_policies (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('sandbox','live')),
  standard_fee_bps integer not null check (standard_fee_bps between 0 and 10000),
  founder_fee_bps integer not null check (founder_fee_bps between 0 and standard_fee_bps),
  processing_allocation text not null check (processing_allocation in ('platform_absorbs','host_actual_cost')),
  payout_delay_hours integer not null check (payout_delay_hours between 0 and 720),
  restore_refunded_credit boolean not null,
  referral_free_bookings integer not null check (referral_free_bookings between 0 and 10),
  referral_credit_cap integer not null check (referral_credit_cap between 0 and 100),
  terms_version text not null check (char_length(btrim(terms_version)) between 1 and 100),
  cancellation_terms text not null check (char_length(btrim(cancellation_terms)) between 10 and 10000),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(referral_credit_cap >= referral_free_bookings)
);
create table private.commercial_settings (
  environment text primary key check (environment in ('sandbox','live')),
  policy_id uuid references private.commercial_policies(id),
  enabled boolean not null default false,
  check (not enabled or policy_id is not null)
);
create table private.stripe_accounts (
  operation_id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id),
  environment text not null check (environment in ('sandbox','live')),
  account_id text,
  transfers_active boolean not null default false,
  payouts_active boolean not null default false,
  requirements_due jsonb not null default '[]',
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique(host_id,environment), unique(environment,account_id)
);
create table private.host_incentive_terms (
  host_id uuid not null references public.profiles(id),
  environment text not null check (environment in ('sandbox','live')),
  policy_id uuid not null references private.commercial_policies(id),
  lifetime_fee_bps integer not null check (lifetime_fee_bps between 0 and 10000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  restore_refunded_credit boolean not null,
  approved_by uuid not null references auth.users(id),
  primary key(host_id,environment), check(ends_at > starts_at)
);
create table private.referral_credit_grants (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id),
  referred_host_id uuid not null references public.profiles(id),
  environment text not null check(environment in ('sandbox','live')),
  credits integer not null check(credits > 0),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(environment,referred_host_id), check(referrer_id <> referred_host_id)
);
create table private.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  environment text not null check(environment in ('sandbox','live')),
  guest_id uuid not null references public.profiles(id),
  host_id uuid not null references public.profiles(id),
  account_id text not null,
  amount_cents integer not null check(amount_cents > 0),
  currency text not null check(currency = 'usd'),
  commission_bps integer not null check(commission_bps between 0 and 10000),
  commission_cents integer not null check(commission_cents >= 0 and commission_cents <= amount_cents),
  policy_id uuid not null references private.commercial_policies(id),
  state text not null default 'preparing' check(state in ('preparing','open','processing','paid','failed','expired','quarantined')),
  terms_accepted_at timestamptz not null,
  expires_at timestamptz not null,
  session_id text, payment_intent_id text, charge_id text, checkout_url text,
  processor_fee_cents integer check(processor_fee_cents >= 0),
  received_amount_cents integer check(received_amount_cents >= 0), received_currency text,
  quarantine_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(environment,session_id), unique(environment,payment_intent_id), unique(environment,charge_id)
);
create unique index one_active_checkout_per_booking on private.payment_attempts(booking_id)
  where state in ('preparing','open','processing','paid');
create index payment_attempts_host_idx on private.payment_attempts(host_id,environment,state);
create table private.incentive_reservations (
  attempt_id uuid primary key references private.payment_attempts(id),
  host_id uuid not null references public.profiles(id),
  environment text not null,
  kind text not null check(kind in ('founder','referral')),
  state text not null default 'reserved' check(state in ('reserved','consumed','released')),
  created_at timestamptz not null default now()
);
create index incentive_host_state_idx on private.incentive_reservations(host_id,environment,kind,state);
create table private.stripe_event_inbox (
  id uuid primary key default gen_random_uuid(),
  environment text not null check(environment in ('sandbox','live')),
  account_context text not null,
  event_id text not null, event_type text not null, object_id text not null,
  status text not null default 'pending' check(status in ('pending','failed','processed')),
  last_error text,
  received_at timestamptz not null default now(), processed_at timestamptz,
  unique(environment,account_context,event_id)
);
create table private.settlement_operations (
  id uuid primary key,
  booking_id uuid not null references public.bookings(id),
  attempt_id uuid not null references private.payment_attempts(id),
  kind text not null check(kind in ('transfer','refund','reversal')),
  amount_cents integer not null check(amount_cents > 0),
  state text not null default 'queued' check(state in ('queued','pending','succeeded','failed','unknown')),
  external_id text,
  reversed_total_cents integer not null default 0 check(reversed_total_cents>=0),
  parent_id uuid references private.settlement_operations(id),
  reason text not null default '',
  last_error text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(kind,external_id)
);
create unique index one_transfer_operation_per_booking on private.settlement_operations(booking_id) where kind='transfer' and state<>'failed';
create unique index one_reversal_per_refund on private.settlement_operations(parent_id) where kind='reversal';
create index settlement_booking_idx on private.settlement_operations(booking_id,kind,state);
create table private.payment_disputes (
  environment text not null, dispute_id text not null, attempt_id uuid not null references private.payment_attempts(id),
  state text not null check(state in ('open','won','lost')), amount_cents integer not null check(amount_cents>0),
  updated_at timestamptz not null default now(), primary key(environment,dispute_id)
);
create index payment_disputes_attempt_idx on private.payment_disputes(attempt_id,state);
create table private.stripe_payouts (
  environment text not null, account_id text not null, payout_id text not null,
  state text not null check(state in ('pending','in_transit','paid','failed','canceled')),
  amount_cents integer not null check(amount_cents >= 0), currency text not null check(currency='usd'),
  arrival_date timestamptz, updated_at timestamptz not null default now(), primary key(environment,payout_id)
);

-- RLS + no browser grants, including owner sessions. Secret server credentials
-- invoke narrow commands; the underlying tables are not in the Data API.
do $$ declare t text; begin
  foreach t in array array['commercial_policies','commercial_settings','stripe_accounts','host_incentive_terms',
    'referral_credit_grants','payment_attempts','incentive_reservations','stripe_event_inbox',
    'settlement_operations','payment_disputes','stripe_payouts'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
    execute format('grant all on private.%I to service_role',t);
  end loop;
end $$;

create function private.financial_actor(p_actor_id uuid,p_admin boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_actor_id is null or not exists(select 1 from auth.users where id=p_actor_id
    and email_confirmed_at is not null and not coalesce(is_anonymous,false))
    or (p_admin and not exists(select 1 from private.admin_memberships where user_id=p_actor_id)) then
    raise exception 'Verified account permission is required.' using errcode='42501';
  end if;
end $$;
revoke all on function private.financial_actor(uuid,boolean) from public,anon,authenticated;

create function private.admin_set_commercial_policy(p_settings jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); policy uuid; env text:=p_settings->>'environment';
begin
  if p_settings is null or jsonb_typeof(p_settings)<>'object' or env is null or env not in ('sandbox','live') or not (p_settings ?& array['enabled','standard_fee_bps','founder_fee_bps',
    'processing_allocation','payout_delay_hours','restore_refunded_credit','referral_free_bookings',
    'referral_credit_cap','terms_version','cancellation_terms','incentive_start','cutoff_rule','refund_rule','completion_rule','liability_acknowledged'])
    or p_settings->>'incentive_start' is distinct from 'host_enrollment'
    or p_settings->>'cutoff_rule' is distinct from 'checkout_before_cutoff_frozen_quote'
    or p_settings->>'refund_rule' is distinct from 'proportional_commission_nonrefundable_processing'
    or p_settings->>'completion_rule' is distinct from 'admin_after_end'
    or p_settings->'liability_acknowledged' is distinct from 'true'::jsonb then
    raise exception 'Explicitly approve every supported commercial term before enabling payments.' using errcode='22023';
  end if;
  insert into private.commercial_policies(environment,standard_fee_bps,founder_fee_bps,processing_allocation,
    payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
  values(env,(p_settings->>'standard_fee_bps')::integer,(p_settings->>'founder_fee_bps')::integer,p_settings->>'processing_allocation',
    (p_settings->>'payout_delay_hours')::integer,(p_settings->>'restore_refunded_credit')::boolean,
    (p_settings->>'referral_free_bookings')::integer,(p_settings->>'referral_credit_cap')::integer,
    p_settings->>'terms_version',p_settings->>'cancellation_terms',actor) returning id into policy;
  insert into private.commercial_settings(environment,policy_id,enabled) values(env,policy,(p_settings->>'enabled')::boolean)
    on conflict(environment) do update set policy_id=excluded.policy_id,enabled=excluded.enabled;
  return policy;
end $$;
create function private.admin_disable_payments(p_environment text)
returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_verified_admin();
  if p_environment not in ('sandbox','live') then raise exception 'Invalid environment.' using errcode='22023'; end if;
  insert into private.commercial_settings(environment,enabled) values(p_environment,false)
    on conflict(environment) do update set enabled=false;
end $$;
create function private.admin_get_commercial_policy(p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin perform private.require_verified_admin();
  select jsonb_build_object('enabled',s.enabled,'policy',to_jsonb(p)) into result
    from private.commercial_settings s left join private.commercial_policies p on p.id=s.policy_id where s.environment=p_environment;
  return coalesce(result,jsonb_build_object('enabled',false,'policy',null));
end $$;
create function private.admin_enroll_founder(p_host_id uuid,p_environment text,p_started_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); p private.commercial_policies%rowtype;
begin
  perform private.financial_actor(p_host_id);
  if not exists(select 1 from public.profiles where id=p_host_id and is_host) or p_started_at is null then
    raise exception 'Select a verified host and an explicit contract start time.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(p_host_id::text));
  select cp.* into p from private.commercial_policies cp join private.commercial_settings s on s.policy_id=cp.id where s.environment=p_environment;
  if not found then raise exception 'Approve commercial terms before enrolling founders.' using errcode='55000'; end if;
  insert into private.host_incentive_terms(host_id,environment,policy_id,lifetime_fee_bps,starts_at,ends_at,restore_refunded_credit,approved_by)
  values(p_host_id,p_environment,p.id,p.founder_fee_bps,p_started_at,
    ((p_started_at at time zone 'America/New_York')+interval '6 months') at time zone 'America/New_York',p.restore_refunded_credit,actor);
end $$;

create function private.pay_prepare_account(p_host_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  perform private.financial_actor(p_host_id);
  if not exists(select 1 from public.profiles where id=p_host_id and is_host) then raise exception 'Host account required.' using errcode='42501'; end if;
  insert into private.stripe_accounts(host_id,environment) values(p_host_id,p_environment) on conflict(host_id,environment) do nothing;
  select to_jsonb(a) into result from private.stripe_accounts a where host_id=p_host_id and environment=p_environment;
  return result;
end $$;
create function private.pay_attach_account(p_operation_id uuid,p_account_id text)
returns void language plpgsql security definer set search_path='' as $$
declare item private.stripe_accounts%rowtype; begin
  select * into item from private.stripe_accounts where operation_id=p_operation_id for update;
  if not found or p_account_id !~ '^acct_[A-Za-z0-9]+$' or (item.account_id is not null and item.account_id<>p_account_id) then
    raise exception 'Account mapping cannot be changed.' using errcode='22023'; end if;
  update private.stripe_accounts set account_id=p_account_id where operation_id=p_operation_id;
end $$;
create function private.pay_sync_account(p_account_id text,p_environment text,p_transfers_active boolean,p_payouts_active boolean,p_requirements_due jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  update private.stripe_accounts set transfers_active=p_transfers_active,payouts_active=p_payouts_active,
    requirements_due=coalesce(p_requirements_due,'[]'),synced_at=now() where account_id=p_account_id and environment=p_environment;
  if not found then raise exception 'Unknown connected account.' using errcode='P0002'; end if;
end $$;

create function private.financial_attempt_json(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('attempt_id',a.id,'operation_id',a.id,'booking_id',a.booking_id,'guest_id',a.guest_id,'host_id',a.host_id,
    'listing_title',b.listing_title_snapshot,'amount_cents',a.amount_cents,'currency',a.currency,'host_account_id',a.account_id,
    'commission_cents',a.commission_cents,'policy_version',a.policy_id,'expires_at',a.expires_at,'attempt_state',a.state,
    'session_id',a.session_id,'url',a.checkout_url,'environment',a.environment,'kind','checkout','created_at',a.created_at)
  from private.payment_attempts a join public.bookings b on b.id=a.booking_id where a.id=p_id;
$$;
revoke all on function private.financial_attempt_json(uuid) from public,anon,authenticated;

create function private.pay_checkout_terms(p_actor_id uuid,p_booking_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; policy uuid; result jsonb;
begin
  perform private.financial_actor(p_actor_id);
  select * into b from public.bookings where id=p_booking_id and guest_id=p_actor_id;
  if not found then raise exception 'Booking unavailable.' using errcode='42501'; end if;
  select policy_id into policy from private.payment_attempts where booking_id=b.id and environment=p_environment and state in ('preparing','open','processing','paid','quarantined') limit 1;
  if policy is null then select policy_id into policy from private.commercial_settings where environment=p_environment and enabled; end if;
  if policy is null then raise exception 'Payments are not enabled.' using errcode='55000'; end if;
  select jsonb_build_object('policy_id',id,'amount_cents',b.amount_cents,'currency',b.currency,
    'terms_version',terms_version,'cancellation_terms',cancellation_terms,
    'host_account_id',(select account_id from private.stripe_accounts where host_id=b.host_id and environment=p_environment))
    into result from private.commercial_policies where id=policy;
  return result;
end $$;

create function private.pay_reserve_checkout(p_actor_id uuid,p_booking_id uuid,p_environment text,p_policy_id uuid,p_terms_accepted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; p private.commercial_policies%rowtype; a private.stripe_accounts%rowtype;
  founder private.host_incentive_terms%rowtype; old private.payment_attempts%rowtype;
  fee integer; promo text; used integer; consumed integer; credits integer; new_id uuid;
begin
  perform private.financial_actor(p_actor_id);
  select * into b from public.bookings where id=p_booking_id;
  if not found or b.guest_id<>p_actor_id then raise exception 'Booking unavailable.' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
  select * into b from public.bookings where id=p_booking_id for update;
  select * into old from private.payment_attempts where booking_id=b.id and state in ('preparing','open','processing','paid','quarantined');
  if found then
    if old.environment<>p_environment then raise exception 'This booking belongs to another payment environment.' using errcode='55000'; end if;
    if p_terms_accepted is distinct from true or p_policy_id is distinct from old.policy_id then raise exception 'Review and accept the quoted booking terms.' using errcode='22023'; end if;
    return private.financial_attempt_json(old.id);
  end if;
  if b.status<>'awaiting_payment' or b.payment_deadline_at is null or b.payment_deadline_at < now()+interval '31 minutes'
    or b.starts_at<now()+interval '31 minutes' or not exists(select 1 from public.listings where id=b.listing_id and status='published') then
    raise exception 'This accepted booking needs at least 31 minutes of payment time remaining.' using errcode='55000'; end if;
  select cp.* into p from private.commercial_policies cp join private.commercial_settings s on s.policy_id=cp.id
    where s.environment=p_environment and s.enabled for share;
  if not found then raise exception 'Payments are not enabled under approved commercial terms.' using errcode='55000'; end if;
  if p_terms_accepted is distinct from true or p_policy_id is distinct from p.id then raise exception 'The terms changed. Review and accept the current booking terms.' using errcode='22023'; end if;
  select * into a from private.stripe_accounts where host_id=b.host_id and environment=p_environment and account_id is not null
    and transfers_active and payouts_active and synced_at > now()-interval '15 minutes';
  if not found then raise exception 'Refresh the host payment account before checkout.' using errcode='55000'; end if;
  fee:=p.standard_fee_bps;
  select * into founder from private.host_incentive_terms where host_id=b.host_id and environment=p_environment for update;
  if found and now()>=founder.starts_at then
    fee:=founder.lifetime_fee_bps;
    if now()>=founder.starts_at and now()<founder.ends_at then
      select count(*) filter(where state in ('reserved','consumed')),count(*) filter(where state='consumed') into used,consumed
        from private.incentive_reservations where host_id=b.host_id and environment=p_environment and kind='founder';
      if used<10 then promo:='founder'; fee:=0;
      elsif consumed<10 then raise exception 'Founding credits are reserved by payments still processing. Try again after they settle.' using errcode='55000'; end if;
    end if;
  end if;
  if promo is null then
    select coalesce(sum(g.credits),0) into credits from private.referral_credit_grants g where referrer_id=b.host_id and environment=p_environment;
    select count(*) into used from private.incentive_reservations where host_id=b.host_id and environment=p_environment and kind='referral' and state in ('reserved','consumed');
    if used<credits then promo:='referral'; fee:=0; end if;
  end if;
  insert into private.payment_attempts(booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,commission_bps,commission_cents,policy_id,expires_at,terms_accepted_at)
  values(b.id,p_environment,b.guest_id,b.host_id,a.account_id,b.amount_cents,b.currency,fee,
    floor(b.amount_cents::numeric*fee/10000)::integer,p.id,least(b.payment_deadline_at,b.starts_at,now()+interval '23 hours'),now()) returning id into new_id;
  if promo is not null then insert into private.incentive_reservations(attempt_id,host_id,environment,kind) values(new_id,b.host_id,p_environment,promo); end if;
  return private.financial_attempt_json(new_id);
end $$;

create function private.pay_attach_checkout(p_attempt_id uuid,p_session_id text,p_payment_intent_id text,p_url text,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts%rowtype; begin
  select * into a from private.payment_attempts where id=p_attempt_id for update;
  if not found or p_session_id is null or p_url !~ '^https://checkout\.stripe\.com/'
    or (a.session_id is not null and a.session_id<>p_session_id) or p_expires_at is null or p_expires_at>a.expires_at then
    raise exception 'Invalid or changed checkout session.' using errcode='22023'; end if;
  update private.payment_attempts set session_id=p_session_id,payment_intent_id=coalesce(payment_intent_id,p_payment_intent_id),
    checkout_url=p_url,expires_at=p_expires_at,state=case when state='preparing' then 'open' else state end,updated_at=now() where id=p_attempt_id;
end $$;
create function private.pay_ingest_event(p_environment text,p_account_context text,p_event_id text,p_event_type text,p_object_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  insert into private.stripe_event_inbox(environment,account_context,event_id,event_type,object_id)
  values(p_environment,coalesce(p_account_context,'platform'),p_event_id,p_event_type,p_object_id)
  on conflict(environment,account_context,event_id) do nothing;
  select jsonb_build_object('event_key',id,'status',status) into result from private.stripe_event_inbox
    where environment=p_environment and account_context=coalesce(p_account_context,'platform') and event_id=p_event_id;
  return result;
end $$;
create function private.pay_finish_event(p_event_key uuid,p_error text)
returns void language plpgsql security definer set search_path='' as $$
begin update private.stripe_event_inbox set status=case when p_error is null then 'processed' else 'failed' end,
  last_error=left(p_error,1000),processed_at=case when p_error is null then now() else null end where id=p_event_key and status<>'processed'; end $$;

create function private.pay_apply_payment(p_event_key uuid,p_attempt_id uuid,p_session_id text,p_payment_intent_id text,
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

create function private.financial_operation_json(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(o)||jsonb_build_object('operation_id',o.id,'environment',a.environment,'currency',a.currency,
    'destination',a.account_id,'charge_id',a.charge_id,'payment_intent_id',a.payment_intent_id,
    'transfer_group','qualia_booking_'||a.booking_id::text,
    'transfer_id',(select t.external_id from private.settlement_operations t where t.booking_id=o.booking_id and t.kind='transfer' and t.state<>'failed'))
  from private.settlement_operations o join private.payment_attempts a on a.id=o.attempt_id where o.id=p_id;
$$;
revoke all on function private.financial_operation_json(uuid) from public,anon,authenticated;
create function private.pay_get_operation(p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(private.financial_attempt_json(p_operation_id),private.financial_operation_json(p_operation_id),
    (select to_jsonb(a)||jsonb_build_object('kind','account') from private.stripe_accounts a where a.operation_id=p_operation_id));
$$;
create function private.pay_complete_booking(p_actor_id uuid,p_booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; begin
  perform private.financial_actor(p_actor_id,true);
  select * into b from public.bookings where id=p_booking_id;
  if not found then raise exception 'Booking unavailable.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
  select * into b from public.bookings where id=p_booking_id for update;
  if b.status='completed' then return; end if;
  if b.status<>'confirmed' or b.ends_at>now() or not exists(select 1 from private.payment_attempts where booking_id=b.id and state='paid') then
    raise exception 'Only a paid experience that has ended can be marked complete.' using errcode='55000'; end if;
  update public.bookings set status='completed' where id=b.id;
end $$;

create function private.pay_prepare_release(p_actor_id uuid,p_booking_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; a private.payment_attempts%rowtype; p private.commercial_policies%rowtype;
  existing private.settlement_operations%rowtype; refunds integer; net integer;
begin
  perform private.financial_actor(p_actor_id,true);
  select * into b from public.bookings where id=p_booking_id;
  if not found then raise exception 'Booking unavailable.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
  select * into b from public.bookings where id=p_booking_id for update;
  select * into existing from private.settlement_operations where booking_id=b.id and kind='transfer' and state<>'failed';
  if found and existing.state='succeeded' then return private.financial_operation_json(existing.id); end if;
  select * into a from private.payment_attempts where booking_id=b.id and state='paid' for update;
  if not found then raise exception 'Verified payment is required before transfer.' using errcode='55000'; end if;
  select * into p from private.commercial_policies where id=a.policy_id;
  if a.quarantine_reason is not null or b.status<>'completed' or b.ends_at+p.payout_delay_hours*interval '1 hour'>now()
    or exists(select 1 from private.payment_disputes where attempt_id=a.id and state<>'won')
    or exists(select 1 from private.payment_attempts where booking_id=b.id and state='quarantined')
    or exists(select 1 from private.settlement_operations where booking_id=b.id and state in ('queued','pending','unknown') and id is distinct from existing.id)
    or not exists(select 1 from private.stripe_accounts where host_id=b.host_id and environment=a.environment
      and transfers_active and payouts_active and synced_at>now()-interval '15 minutes') then
    raise exception 'Transfer is waiting for completion, its delay, or financial/account review.' using errcode='55000'; end if;
  if p.processing_allocation='host_actual_cost' and a.processor_fee_cents is null then
    raise exception 'Actual processor costs must be reconciled before host deduction.' using errcode='55000'; end if;
  select coalesce(sum(amount_cents),0) into refunds from private.settlement_operations where attempt_id=a.id and kind='refund' and state='succeeded';
  net:=greatest(0,a.amount_cents-refunds-floor((a.amount_cents-refunds)::numeric*a.commission_bps/10000)::integer
    -case when p.processing_allocation='host_actual_cost' then a.processor_fee_cents else 0 end);
  if net<=0 then raise exception 'There is no remaining host entitlement to transfer.' using errcode='55000'; end if;
  if existing.id is not null then
    if existing.amount_cents<>net then raise exception 'The prior transfer amount is obsolete; reconcile it before any new transfer.' using errcode='55000'; end if;
    return private.financial_operation_json(existing.id);
  end if;
  if exists(select 1 from private.settlement_operations where id=p_operation_id) then
    raise exception 'A terminal failed transfer needs a new reviewed operation ID.' using errcode='55000'; end if;
  insert into private.settlement_operations(id,booking_id,attempt_id,kind,amount_cents,actor_id) values(p_operation_id,b.id,a.id,'transfer',net,p_actor_id);
  return private.financial_operation_json(p_operation_id);
end $$;

create function private.pay_prepare_refund(p_actor_id uuid,p_booking_id uuid,p_amount_cents integer,p_reason text,p_operation_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; a private.payment_attempts%rowtype; p private.commercial_policies%rowtype;
  old private.settlement_operations%rowtype; transfer private.settlement_operations%rowtype;
  reserved integer; target integer; reversed integer; recovery integer; reversal_id uuid;
begin
  perform private.financial_actor(p_actor_id,true);
  select * into b from public.bookings where id=p_booking_id;
  if not found then raise exception 'Booking unavailable.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
  select * into b from public.bookings where id=p_booking_id for update;
  select * into old from private.settlement_operations where id=p_operation_id;
  if found then
    if old.booking_id<>b.id or old.attempt_id is distinct from p_attempt_id or old.kind<>'refund' or old.amount_cents<>p_amount_cents then
      raise exception 'An operation ID cannot be reused with different refund details.' using errcode='22023'; end if;
    return private.financial_operation_json(old.id)||jsonb_build_object('reversal_operation',
      (select private.financial_operation_json(id) from private.settlement_operations where parent_id=old.id and kind='reversal'));
  end if;
  select * into a from private.payment_attempts where id=p_attempt_id and booking_id=b.id
    and state in ('paid','quarantined') and charge_id is not null for update;
  if not found or a.received_currency is distinct from 'usd' then raise exception 'Select the exact verified USD charge for this refund.' using errcode='55000'; end if;
  if exists(select 1 from private.payment_disputes where attempt_id=a.id and state<>'won') then
    raise exception 'Resolve the dispute before issuing an additional refund.' using errcode='55000'; end if;
  if p_amount_cents is null or p_amount_cents<=0 or char_length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then
    raise exception 'Choose a positive refund and record its reason.' using errcode='22023'; end if;
  select coalesce(sum(amount_cents),0) into reserved from private.settlement_operations where attempt_id=a.id and kind='refund' and state<>'failed';
  if reserved+p_amount_cents>coalesce(a.received_amount_cents,a.amount_cents) then raise exception 'Refund exceeds the remaining paid amount.' using errcode='22023'; end if;
  select * into transfer from private.settlement_operations where attempt_id=a.id and kind='transfer' and state<>'failed' for update;
  insert into private.settlement_operations(id,booking_id,attempt_id,kind,amount_cents,reason,actor_id)
  values(p_operation_id,b.id,a.id,'refund',p_amount_cents,btrim(p_reason),p_actor_id);
  if transfer.state in ('queued','pending','unknown','succeeded') then
    select * into p from private.commercial_policies where id=a.policy_id;
    target:=greatest(0,a.amount_cents-reserved-p_amount_cents-floor((a.amount_cents-reserved-p_amount_cents)::numeric*a.commission_bps/10000)::integer
      -case when p.processing_allocation='host_actual_cost' then coalesce(a.processor_fee_cents,0) else 0 end);
    select coalesce(sum(amount_cents),0) into reversed from private.settlement_operations where attempt_id=a.id and kind='reversal' and state<>'failed';
    reversed:=greatest(reversed,transfer.reversed_total_cents);
    recovery:=greatest(0,transfer.amount_cents-target-reversed);
    if recovery>0 then
      reversal_id:=gen_random_uuid();
      insert into private.settlement_operations(id,booking_id,attempt_id,kind,amount_cents,parent_id,reason,actor_id)
      values(reversal_id,b.id,a.id,'reversal',recovery,p_operation_id,'Recover host entitlement for refund',p_actor_id);
    end if;
  end if;
  return private.financial_operation_json(p_operation_id)||jsonb_build_object('reversal_operation',private.financial_operation_json(reversal_id));
end $$;

-- Canonical processor metadata ties early webhooks to our durable operation.
-- A webhook arriving before the API response must not create a second refund.
create function private.pay_sync_refund(p_environment text,p_charge_id text,p_refund_id text,p_state text,p_amount_cents integer,p_operation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts%rowtype; o private.settlement_operations%rowtype; operation uuid;
begin
  select * into a from private.payment_attempts where environment=p_environment and charge_id=p_charge_id;
  if not found then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  if p_state is null or p_state not in ('pending','succeeded','failed') or p_refund_id is null or p_amount_cents is null or p_amount_cents<=0 then
    raise exception 'Invalid canonical refund.' using errcode='22023'; end if;
  select * into o from private.settlement_operations where kind='refund' and external_id=p_refund_id for update;
  if not found and p_operation_id is not null then
    select * into o from private.settlement_operations where id=p_operation_id for update;
    if not found then raise exception 'Unknown refund operation metadata.' using errcode='22023'; end if;
  end if;
  if o.id is not null then
    if o.kind<>'refund' or o.attempt_id<>a.id or o.amount_cents<>p_amount_cents
      or (p_operation_id is not null and o.id<>p_operation_id)
      or (o.external_id is not null and o.external_id<>p_refund_id) then
      raise exception 'Refund identity mismatch.' using errcode='22023'; end if;
    operation:=o.id;
  else
    -- A Dashboard refund is recorded once and blocks release until recovery is reviewed.
    operation:=gen_random_uuid();
    insert into private.settlement_operations(id,booking_id,attempt_id,kind,amount_cents,external_id,reason)
    values(operation,a.booking_id,a.id,'refund',p_amount_cents,p_refund_id,'External Stripe refund; review host recovery');
    update private.payment_attempts set quarantine_reason='External refund '||p_refund_id||' requires settlement review.' where id=a.id;
  end if;
  perform private.pay_record_operation(operation,p_refund_id,p_state,null);
end $$;
create function private.pay_sync_transfer(p_environment text,p_transfer_id text,p_amount_reversed integer,
  p_operation_id uuid,p_amount_cents integer,p_charge_id text,p_destination text)
returns void language plpgsql security definer set search_path='' as $$
declare o private.settlement_operations%rowtype; a private.payment_attempts%rowtype;
begin
  select * into a from private.payment_attempts where environment=p_environment and charge_id=p_charge_id;
  if not found then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  if p_transfer_id is null or p_amount_cents is null or p_amount_cents<=0 or p_amount_reversed is null
    or p_amount_reversed<0 or p_amount_reversed>p_amount_cents then raise exception 'Invalid canonical transfer.' using errcode='22023'; end if;
  select * into o from private.settlement_operations where kind='transfer' and external_id=p_transfer_id for update;
  if not found and p_operation_id is not null then
    select * into o from private.settlement_operations where id=p_operation_id for update;
    if not found then raise exception 'Unknown transfer operation metadata.' using errcode='22023'; end if;
  end if;
  if o.id is null then
    -- Do not silently double-pay after a transfer made outside the application.
    update private.payment_attempts set quarantine_reason='External transfer '||p_transfer_id||' requires settlement review.' where id=a.id;
    return;
  end if;
  if o.kind<>'transfer' or o.attempt_id<>a.id or o.amount_cents<>p_amount_cents or p_destination is distinct from a.account_id
    or (p_operation_id is not null and o.id<>p_operation_id)
    or (o.external_id is not null and o.external_id<>p_transfer_id) then
    raise exception 'Transfer identity mismatch.' using errcode='22023'; end if;
  perform private.pay_record_operation(o.id,p_transfer_id,'succeeded',null);
  update private.settlement_operations set reversed_total_cents=greatest(reversed_total_cents,p_amount_reversed),updated_at=now() where id=o.id;
end $$;
create function private.pay_sync_dispute(p_environment text,p_charge_id text,p_dispute_id text,p_state text,p_amount_cents integer)
returns void language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts%rowtype; begin
  select * into a from private.payment_attempts where environment=p_environment and charge_id=p_charge_id;
  if not found then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  insert into private.payment_disputes(environment,dispute_id,attempt_id,state,amount_cents)
    values(p_environment,p_dispute_id,a.id,p_state,p_amount_cents)
    on conflict(environment,dispute_id) do update set state=excluded.state,amount_cents=excluded.amount_cents,updated_at=now();
end $$;
create function private.pay_sync_payout(p_environment text,p_account_id text,p_payout_id text,p_state text,p_amount_cents integer,p_currency text,p_arrival_date timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.stripe_accounts where account_id=p_account_id and environment=p_environment) then
    raise exception 'Unknown payout account.' using errcode='42501'; end if;
  insert into private.stripe_payouts(environment,account_id,payout_id,state,amount_cents,currency,arrival_date)
    values(p_environment,p_account_id,p_payout_id,p_state,p_amount_cents,p_currency,p_arrival_date)
    on conflict(environment,payout_id) do update set state=excluded.state,amount_cents=excluded.amount_cents,arrival_date=excluded.arrival_date,updated_at=now();
end $$;

create function private.admin_grant_referral(p_referrer_id uuid,p_referred_host_id uuid,p_environment text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); p private.commercial_policies%rowtype; granted integer;
begin
  perform private.financial_actor(p_referrer_id); perform private.financial_actor(p_referred_host_id);
  if p_referrer_id=p_referred_host_id or not exists(select 1 from public.profiles where id=p_referrer_id and is_host) then
    raise exception 'Select two different verified hosts.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(p_referrer_id::text));
  select cp.* into p from private.commercial_policies cp join private.commercial_settings s on s.policy_id=cp.id where s.environment=p_environment;
  if not found or p.referral_free_bookings=0 then raise exception 'Referral credits have not been approved.' using errcode='55000'; end if;
  if not exists(select 1 from public.bookings b join private.payment_attempts a on a.booking_id=b.id
    where b.host_id=p_referred_host_id and b.status='completed' and a.state='paid' and a.environment=p_environment
    and not exists(select 1 from private.settlement_operations o where o.attempt_id=a.id and o.kind='refund' and o.state<>'failed')) then
    raise exception 'The referred host must complete their first paid, non-refunded booking.' using errcode='55000'; end if;
  select coalesce(sum(credits),0) into granted from private.referral_credit_grants where referrer_id=p_referrer_id and environment=p_environment;
  if granted+p.referral_free_bookings>p.referral_credit_cap then raise exception 'This host has reached the approved referral cap.' using errcode='55000'; end if;
  insert into private.referral_credit_grants(referrer_id,referred_host_id,environment,credits,approved_by)
    values(p_referrer_id,p_referred_host_id,p_environment,p.referral_free_bookings,actor);
end $$;

create function private.pay_read_booking(p_actor_id uuid,p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; result jsonb;
begin
  perform private.financial_actor(p_actor_id);
  select * into b from public.bookings where id=p_booking_id;
  if not found or (p_actor_id not in (b.host_id,b.guest_id) and not exists(select 1 from private.admin_memberships where user_id=p_actor_id)) then
    raise exception 'Booking unavailable.' using errcode='42501'; end if;
  select jsonb_build_object('booking_id',b.id,'booking_status',b.status,'can_checkout',b.status='awaiting_payment' and p_actor_id=b.guest_id,
    'payment',(select jsonb_build_object('attempt_id',a.id,'state',a.state,'amount_cents',a.amount_cents,'commission_cents',a.commission_cents,
      'processor_fee_cents',a.processor_fee_cents,'processing_allocation',p.processing_allocation,'paid_at',a.paid_at,'currency',a.currency,
      'url',case when p_actor_id=b.guest_id and a.state='open' then a.checkout_url else null end,
      'policy_version',p.terms_version,'cancellation_terms',p.cancellation_terms)
      from private.payment_attempts a join private.commercial_policies p on p.id=a.policy_id where a.booking_id=b.id order by a.created_at desc limit 1),
    'operations',coalesce((select jsonb_agg(jsonb_build_object('operation_id',o.id,'kind',o.kind,'amount_cents',o.amount_cents,'state',o.state,
      'reversed_total_cents',o.reversed_total_cents,'created_at',o.created_at) order by o.created_at) from private.settlement_operations o where o.booking_id=b.id),'[]'::jsonb)) into result;
  return result;
end $$;
create function private.pay_read_host(p_actor_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.financial_actor(p_actor_id);
  if not exists(select 1 from public.profiles where id=p_actor_id and is_host) then raise exception 'Host access required.' using errcode='42501'; end if;
  return jsonb_build_object('commercial',(select jsonb_build_object('enabled',s.enabled,'terms_version',p.terms_version,
    'standard_fee_bps',p.standard_fee_bps,'founder_fee_bps',p.founder_fee_bps,'processing_allocation',p.processing_allocation,
    'payout_delay_hours',p.payout_delay_hours,'cancellation_terms',p.cancellation_terms,
    'founder',(select jsonb_build_object('lifetime_fee_bps',f.lifetime_fee_bps,'starts_at',f.starts_at,'ends_at',f.ends_at)
      from private.host_incentive_terms f where f.host_id=p_actor_id and f.environment=p_environment),
    'founder_credits_consumed',(select count(*) from private.incentive_reservations r where r.host_id=p_actor_id and r.environment=p_environment and r.kind='founder' and r.state='consumed'),
    'founder_credits_reserved',(select count(*) from private.incentive_reservations r where r.host_id=p_actor_id and r.environment=p_environment and r.kind='founder' and r.state='reserved'),
    'referral_credits_granted',(select coalesce(sum(g.credits),0) from private.referral_credit_grants g where g.referrer_id=p_actor_id and g.environment=p_environment),
    'referral_credits_used',(select count(*) from private.incentive_reservations r where r.host_id=p_actor_id and r.environment=p_environment and r.kind='referral' and r.state in ('reserved','consumed')))
    from private.commercial_settings s join private.commercial_policies p on p.id=s.policy_id where s.environment=p_environment),
    'account',(select to_jsonb(a) from private.stripe_accounts a where host_id=p_actor_id and environment=p_environment),
    'earnings',coalesce((select jsonb_agg(x.summary order by x.created_at desc) from (select private.pay_read_booking(p_actor_id,b.id) as summary,b.created_at
      from public.bookings b where host_id=p_actor_id and exists(select 1 from private.payment_attempts a where a.booking_id=b.id and a.environment=p_environment)
      order by b.created_at desc limit 200) x),'[]'::jsonb),
    'payouts',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc) from private.stripe_payouts p join private.stripe_accounts a
      on a.account_id=p.account_id and a.environment=p.environment where a.host_id=p_actor_id and a.environment=p_environment),'[]'::jsonb));
end $$;
create function private.pay_read_admin(p_actor_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.financial_actor(p_actor_id,true);
  return jsonb_build_object(
    'attempts',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.*,b.status as booking_status,b.ends_at as booking_ends_at from private.payment_attempts a join public.bookings b on b.id=a.booking_id where a.environment=p_environment order by a.updated_at desc limit 200)x),'[]'::jsonb),
    'operations',coalesce((select jsonb_agg(private.financial_operation_json(x.id)) from (select o.id from private.settlement_operations o join private.payment_attempts a on a.id=o.attempt_id where a.environment=p_environment order by o.updated_at desc limit 200)x),'[]'::jsonb),
    'disputes',coalesce((select jsonb_agg(to_jsonb(d)) from private.payment_disputes d where environment=p_environment),'[]'::jsonb),
    'payouts',coalesce((select jsonb_agg(to_jsonb(p)) from private.stripe_payouts p where environment=p_environment),'[]'::jsonb));
end $$;

create function private.pay_record_operation(p_operation_id uuid,p_external_id text,p_state text,p_error text)
returns void language plpgsql security definer set search_path='' as $$
declare o private.settlement_operations%rowtype; a private.payment_attempts%rowtype; total integer; restore boolean;
begin
  select * into o from private.settlement_operations where id=p_operation_id;
  if not found then raise exception 'Unknown financial operation.' using errcode='P0002'; end if;
  select * into a from private.payment_attempts where id=o.attempt_id;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  select * into o from private.settlement_operations where id=p_operation_id for update;
  if p_state is null or p_state not in ('pending','succeeded','failed','unknown') or (p_state='succeeded' and p_external_id is null)
    or (o.external_id is not null and p_external_id is not null and o.external_id<>p_external_id) then
    raise exception 'Financial operation evidence is invalid.' using errcode='22023'; end if;
  if o.state='succeeded' then return; end if;
  update private.settlement_operations set state=p_state,external_id=coalesce(external_id,p_external_id),last_error=left(p_error,1000),updated_at=now() where id=o.id;
  if o.kind='refund' and p_state='succeeded' then
    select coalesce(sum(amount_cents),0) into total from private.settlement_operations where attempt_id=a.id and kind='refund' and state='succeeded';
    if total>=coalesce(a.received_amount_cents,a.amount_cents) then
      if a.state='paid' or not exists(select 1 from private.payment_attempts where booking_id=a.booking_id and id<>a.id and state='paid') then
        update public.bookings set status='cancelled' where id=a.booking_id and status in ('confirmed','completed','awaiting_payment');
      end if;
      select case when r.kind='founder' then f.restore_refunded_credit else p.restore_refunded_credit end into restore
        from private.incentive_reservations r join private.commercial_policies p on p.id=a.policy_id
        left join private.host_incentive_terms f on f.host_id=a.host_id and f.environment=a.environment where r.attempt_id=a.id;
      update private.incentive_reservations set state='released' where attempt_id=a.id and (state='reserved' or coalesce(restore,false));
    end if;
  end if;
end $$;

-- A local deadline cannot release inventory while Stripe may still collect.
create function private.financial_hold_active(p_booking_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.payment_attempts a join public.bookings b on b.id=a.booking_id
 where a.booking_id=p_booking_id and b.status='awaiting_payment' and a.state in ('preparing','open','processing','quarantined'));
$$;
revoke all on function private.financial_hold_active(uuid) from public,anon,authenticated;
create function private.effective_booking_status(p_status public.booking_status,p_request_expires_at timestamptz,
 p_payment_deadline_at timestamptz,p_starts_at timestamptz,p_booking_id uuid)
returns public.booking_status language sql stable security definer set search_path='' as $$
 select case when p_status='awaiting_payment' and private.financial_hold_active(p_booking_id) then p_status
 else private.effective_booking_status(p_status,p_request_expires_at,p_payment_deadline_at,p_starts_at) end;
$$;
revoke all on function private.effective_booking_status(public.booking_status,timestamptz,timestamptz,timestamptz,uuid) from public,anon,authenticated;

create or replace function private.expire_host_bookings(p_host_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  with expired as (
    update public.bookings set status = 'expired' where host_id = p_host_id
      and status in ('requested', 'awaiting_payment')
      and private.effective_booking_status(status, request_expires_at, payment_deadline_at, starts_at, id) = 'expired'
    returning id
  ) insert into private.booking_events(booking_id, event) select id, 'expired' from expired;
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
      and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id)
        in ('requested', 'awaiting_payment', 'confirmed')
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
  order by s.slot_start limit 2000;
end;
$$;

create or replace function private.cancel_unpaid_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.bookings%rowtype := private.lock_participant_booking(p_booking_id);
begin
  if private.financial_hold_active(p_booking_id) then raise exception 'Checkout is active. Wait for payment reconciliation or contact support.' using errcode='55000'; end if;
  if item.status not in ('requested', 'awaiting_payment') then
    raise exception 'Only an unpaid request can be cancelled here. Contact support for a paid booking.' using errcode = '55000';
  end if;
  -- Phase 5 must also inspect/expire any in-flight Stripe checkout before this
  -- transition. A verified payment event must never lose its conflict lock.
  update public.bookings set status = 'cancelled' where id = p_booking_id;
  insert into private.booking_events(booking_id, actor_id, event) values (p_booking_id, auth.uid(), 'cancelled');
end;
$$;

drop function public.list_my_bookings(text);
drop function private.list_my_bookings(text);

create function private.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz,
  ends_at timestamptz, status public.booking_status, amount_cents integer, currency text,
  guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz,
  created_at timestamptz, updated_at timestamptz, listing_title text,
  listing_category public.experience_category, listing_city text, host_name text, guest_name text, payment_hold_active boolean)
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
    coalesce(b.listing_city_snapshot, l.city), h.display_name, coalesce(nullif(g.full_name, ''), 'Guest'), private.financial_hold_active(b.id)
  from public.bookings b join public.listings l on l.id = b.listing_id
    join public.host_profiles h on h.user_id = b.host_id join public.profiles g on g.id = b.guest_id
  where (p_role = 'guest' and b.guest_id = actor_id) or (p_role = 'host' and b.host_id = actor_id)
  order by b.created_at desc limit 500;
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

create function public.list_my_bookings(p_role text)
returns table(id uuid, listing_id uuid, host_id uuid, guest_id uuid, starts_at timestamptz, ends_at timestamptz, status public.booking_status, amount_cents integer, currency text, guest_message text, request_expires_at timestamptz, payment_deadline_at timestamptz, created_at timestamptz, updated_at timestamptz, listing_title text, listing_category public.experience_category, listing_city text, host_name text, guest_name text, payment_hold_active boolean) language sql security invoker set search_path = '' as $$
  select * from private.list_my_bookings(p_role);
$$;
revoke all on function private.list_my_bookings(text) from public,anon,authenticated;
grant execute on function private.list_my_bookings(text) to authenticated;
revoke all on function public.list_my_bookings(text) from public,anon,authenticated;
grant execute on function public.list_my_bookings(text) to authenticated;

-- Only invoker wrappers are public. Payment commands require secret server access.
do $$ declare f record; args text; target_role text; begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) as arguments,
 pg_get_function_identity_arguments(p.oid) as identity_args,pg_get_function_result(p.oid) as result,p.pronargs
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and (p.proname like 'pay_%' or p.proname in
 ('admin_set_commercial_policy','admin_get_commercial_policy','admin_disable_payments','admin_enroll_founder','admin_grant_referral')) loop
 select string_agg('$'||i::text,',' order by i) into args from generate_series(1,f.pronargs) i;
 target_role:=case when f.proname like 'pay_%' then 'service_role' else 'authenticated' end;
 execute format('revoke all on function private.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
 execute format('grant execute on function private.%I(%s) to %I',f.proname,f.identity_args,target_role);
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',
 f.proname,f.arguments,f.result,'select private.'||quote_ident(f.proname)||'('||coalesce(args,'')||');');
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
 execute format('grant execute on function public.%I(%s) to %I',f.proname,f.identity_args,target_role);
 end loop;
end $$;
commit;
