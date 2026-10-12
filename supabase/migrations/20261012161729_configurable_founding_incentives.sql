-- Versioned founding offers. No commercial policy is created or enabled here.
-- Defaults preserve historical 10-booking / 6-calendar-month contracts and
-- existing direct inserts. The admin RPC requires explicit values for every new policy.
begin;

alter table private.commercial_policies
  add column founder_free_bookings integer not null default 10 check (founder_free_bookings between 0 and 100),
  add column founder_duration_months integer not null default 6 check (founder_duration_months between 1 and 24),
  -- Legacy policies were uncapped. New policy saves require an explicit cap.
  add column founder_cohort_cap integer check (founder_cohort_cap between 1 and 10000);

-- Enrollment snapshots protect agreed offers from subsequent policy changes.
-- Historical starts_at/ends_at, lifetime fees and refund rules are untouched.
alter table private.host_incentive_terms
  add column free_booking_limit integer not null default 10 check (free_booking_limit between 0 and 100),
  add column duration_months integer not null default 6 check (duration_months between 1 and 24);

create or replace function private.admin_set_commercial_policy(p_settings jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); policy uuid; env text:=p_settings->>'environment';
begin
  if p_settings is null or jsonb_typeof(p_settings)<>'object' or env is null or env not in ('sandbox','live') or not (p_settings ?& array['enabled','standard_fee_bps','founder_fee_bps','founder_free_bookings','founder_duration_months','founder_cohort_cap',
    'processing_allocation','payout_delay_hours','restore_refunded_credit','referral_free_bookings',
    'referral_credit_cap','terms_version','cancellation_terms','incentive_start','cutoff_rule','refund_rule','completion_rule','liability_acknowledged'])
    or coalesce(p_settings->>'founder_free_bookings','') !~ '^[0-9]+$'
    or coalesce(p_settings->>'founder_duration_months','') !~ '^[0-9]+$'
    or coalesce(p_settings->>'founder_cohort_cap','') !~ '^[0-9]+$'
    or p_settings->>'incentive_start' is distinct from 'host_enrollment'
    or p_settings->>'cutoff_rule' is distinct from 'checkout_before_cutoff_frozen_quote'
    or p_settings->>'refund_rule' is distinct from 'proportional_commission_nonrefundable_processing'
    or p_settings->>'completion_rule' is distinct from 'admin_after_end'
    or p_settings->'liability_acknowledged' is distinct from 'true'::jsonb then
    raise exception 'Explicitly approve every supported commercial term before enabling payments.' using errcode='22023';
  end if;
  -- Share one lock with enrollments so a policy/cap change cannot race a cohort admission.
  perform pg_catalog.pg_advisory_xact_lock(72464,pg_catalog.hashtext(env));
  insert into private.commercial_policies(environment,standard_fee_bps,founder_fee_bps,founder_free_bookings,founder_duration_months,founder_cohort_cap,processing_allocation,
    payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
  values(env,(p_settings->>'standard_fee_bps')::integer,(p_settings->>'founder_fee_bps')::integer,
    (p_settings->>'founder_free_bookings')::integer,(p_settings->>'founder_duration_months')::integer,
    (p_settings->>'founder_cohort_cap')::integer,p_settings->>'processing_allocation',
    (p_settings->>'payout_delay_hours')::integer,(p_settings->>'restore_refunded_credit')::boolean,
    (p_settings->>'referral_free_bookings')::integer,(p_settings->>'referral_credit_cap')::integer,
    p_settings->>'terms_version',p_settings->>'cancellation_terms',actor) returning id into policy;
  insert into private.commercial_settings(environment,policy_id,enabled) values(env,policy,(p_settings->>'enabled')::boolean)
    on conflict(environment) do update set policy_id=excluded.policy_id,enabled=excluded.enabled;
  return policy;
end $$;

-- Remove the old signature so callers cannot omit the terms they reviewed.
drop function public.admin_enroll_founder(uuid,text,timestamptz);
drop function private.admin_enroll_founder(uuid,text,timestamptz);
create function private.admin_enroll_founder(p_host_id uuid,p_environment text,p_started_at timestamptz,p_policy_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); p private.commercial_policies%rowtype;
begin
  perform private.financial_actor(p_host_id);
  if p_environment is null or p_environment not in ('sandbox','live') then
    raise exception 'Choose sandbox or live.' using errcode='22023'; end if;
  -- Cohort admission is serialized across all hosts and policy versions in one environment.
  perform pg_catalog.pg_advisory_xact_lock(72464,pg_catalog.hashtext(p_environment));
  if not exists(select 1 from public.profiles where id=p_host_id and is_host) or p_started_at is null then
    raise exception 'Select a verified host and an explicit contract start time.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(p_host_id::text));
  if not exists(select 1 from public.listings where host_id=p_host_id and status='published') then
    raise exception 'Publish an approved listing before activating founding terms.' using errcode='55000'; end if;
  if exists(select 1 from private.host_incentive_terms where host_id=p_host_id and environment=p_environment) then
    raise exception 'Existing founding terms cannot be overwritten.' using errcode='23505'; end if;
  select cp.* into p from private.commercial_policies cp join private.commercial_settings s on s.policy_id=cp.id where s.environment=p_environment;

  if not found then raise exception 'Approve commercial terms before enrolling founders.' using errcode='55000'; end if;
  if p_policy_id is null or p_policy_id is distinct from p.id then
    raise exception 'The founding terms changed. Reload and review the current policy with the host before enrolling.' using errcode='22023'; end if;
  if p.founder_cohort_cap is not null and
    (select count(*) from private.host_incentive_terms where environment=p_environment)>=p.founder_cohort_cap then
    raise exception 'The founding host cohort is full under the current approved policy.' using errcode='55000'; end if;
  insert into private.host_incentive_terms(host_id,environment,policy_id,lifetime_fee_bps,free_booking_limit,duration_months,starts_at,ends_at,restore_refunded_credit,approved_by)
  values(p_host_id,p_environment,p.id,p.founder_fee_bps,p.founder_free_bookings,p.founder_duration_months,p_started_at,
    ((p_started_at at time zone 'America/New_York')+pg_catalog.make_interval(months => p.founder_duration_months)) at time zone 'America/New_York',p.restore_refunded_credit,actor);
end $$;

create or replace function private.pay_reserve_checkout(p_actor_id uuid,p_booking_id uuid,p_environment text,p_policy_id uuid,p_terms_accepted boolean)
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
      if used<founder.free_booking_limit then promo:='founder'; fee:=0;
      elsif consumed<founder.free_booking_limit then raise exception 'Founding credits are reserved by payments still processing. Try again after they settle.' using errcode='55000'; end if;
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

create or replace function private.pay_read_host(p_actor_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.financial_actor(p_actor_id);
  if not exists(select 1 from public.profiles where id=p_actor_id and is_host) then raise exception 'Host access required.' using errcode='42501'; end if;
  return jsonb_build_object('commercial',(select jsonb_build_object('enabled',s.enabled,'terms_version',p.terms_version,
    'standard_fee_bps',p.standard_fee_bps,'founder_fee_bps',p.founder_fee_bps,'founder_free_bookings',p.founder_free_bookings,
    'founder_duration_months',p.founder_duration_months,'processing_allocation',p.processing_allocation,
    'payout_delay_hours',p.payout_delay_hours,'cancellation_terms',p.cancellation_terms,
    'founder',(select jsonb_build_object('lifetime_fee_bps',f.lifetime_fee_bps,'free_booking_limit',f.free_booking_limit,
      'duration_months',f.duration_months,'starts_at',f.starts_at,'ends_at',f.ends_at)
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

-- Replaced function signatures retain their ACLs; enrollment has a new explicit-policy wrapper.
-- Explicit revokes also defend against unintended inherited privileges.
revoke all on function private.admin_set_commercial_policy(jsonb) from public,anon,authenticated;
revoke all on function private.admin_enroll_founder(uuid,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function private.pay_reserve_checkout(uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
revoke all on function private.pay_read_host(uuid,text) from public,anon,authenticated;
grant execute on function private.admin_set_commercial_policy(jsonb) to authenticated;
grant execute on function private.admin_enroll_founder(uuid,text,timestamptz,uuid) to authenticated;
grant execute on function private.pay_reserve_checkout(uuid,uuid,text,uuid,boolean) to service_role;
grant execute on function private.pay_read_host(uuid,text) to service_role;
create function public.admin_enroll_founder(p_host_id uuid,p_environment text,p_started_at timestamptz,p_policy_id uuid)
returns void language sql security invoker set search_path='' as $$
  select private.admin_enroll_founder(p_host_id,p_environment,p_started_at,p_policy_id);
$$;
revoke all on function public.admin_enroll_founder(uuid,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.admin_enroll_founder(uuid,text,timestamptz,uuid) to authenticated;
commit;
