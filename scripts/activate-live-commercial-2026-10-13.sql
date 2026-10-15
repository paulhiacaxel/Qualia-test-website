-- One-time operator-authorized launch configuration, not an automatic migration.
-- Target: Qualia production, Supabase fjotwcufttuccebrbgsp, after the matching
-- legal-acceptance migration and application release have been verified.
-- Axel approved these operating terms and live activation in the conversation.
-- approved_by records that business authorization; this script does not create
-- a signed-in session, impersonate auth.uid(), or accept any user's agreements.
-- No founder is enrolled and no listing is published by this operation.
begin;
do $$
declare
  operator_id uuid;
  policy_id uuid;
  existing private.commercial_policies%rowtype;
  booking_settings private.booking_policy%rowtype;
  existing_enabled boolean;
  cancellation text := 'Cancel through your booking or contact support@bookqualia.com. We use the scheduled start time shown on the booking, including its time zone. Guest cancellation at least 48 hours before start: full refund of the amount paid. Host cancellation: full refund of the amount paid. Guest cancellation less than 48 hours before start: no automatic refund; Qualia reviews the circumstances and any legal entitlement. Weather, venue closure, safety concerns, interruption or no-show: contact Qualia for review. Do not treat an unsafe session as completed to obtain release. Approved refunds are submitted to the original payment method where supported; the payment provider controls when the credit appears. A reschedule requires agreement and availability and does not silently change cancellation rights. Full policy: https://bookqualia.com/legal/qualia_cancellation_2026_10_13_v1';
begin
  select u.id into strict operator_id from auth.users u
    join private.admin_memberships a on a.user_id=u.id
    where u.email='axel@bookqualia.com' and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false);
  if to_regprocedure('public.accept_legal_terms(text,text,text,boolean,boolean)') is null then
    raise exception 'Deploy the explicit legal-acceptance migration first.';
  end if;
  if not exists(select 1 from private.stripe_accounts where host_id=operator_id
    and environment='live' and account_id='acct_1UPrcuRWrbZzYTAS') then
    raise exception 'Expected production live Stripe mapping is missing; verify the target project.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72464,pg_catalog.hashtext('live'));
  select * into strict booking_settings from private.booking_policy where singleton for update;
  if booking_settings.request_expiry_minutes is distinct from 1440 or
    booking_settings.payment_deadline_minutes is distinct from 1440 then
    raise exception 'Booking deadlines changed; inspect them before activation.';
  end if;
  select p.* into existing from private.commercial_policies p
    join private.commercial_settings s on s.policy_id=p.id where s.environment='live';
  if found then
    -- Re-running may verify this release, but cannot silently replace a later policy.
    if row(existing.environment,existing.standard_fee_bps,existing.founder_fee_bps,existing.founder_free_bookings,
      existing.founder_duration_months,existing.founder_cohort_cap,existing.processing_allocation,
      existing.payout_delay_hours,existing.restore_refunded_credit,existing.referral_free_bookings,
      existing.referral_credit_cap,existing.terms_version,existing.cancellation_terms)
      is distinct from row('live'::text,1750,1250,3,3,40,'host_actual_cost'::text,48,true,1,2,
        'qualia_host_2026_10_13_v1'::text,cancellation) then
      raise exception 'A different live policy already exists; inspect it before making changes.';
    end if;
    select enabled into existing_enabled from private.commercial_settings where environment='live';
    if existing_enabled and booking_settings.enabled then return; end if;
    raise exception 'Launch policy exists but is paused or inconsistent; do not silently re-enable it.';
  else
    if booking_settings.enabled or exists(select 1 from private.commercial_settings where environment='live') then
      raise exception 'Unexpected partially configured launch; review state before proceeding.';
    end if;
    if exists(select 1 from private.payment_attempts where environment='live') then
      raise exception 'Live payment records already exist without the expected policy; reconcile first.';
    end if;
    insert into private.commercial_policies(environment,standard_fee_bps,founder_fee_bps,
      founder_free_bookings,founder_duration_months,founder_cohort_cap,processing_allocation,
      payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,
      terms_version,cancellation_terms,approved_by)
    values('live',1750,1250,3,3,40,'host_actual_cost',48,true,1,2,
      'qualia_host_2026_10_13_v1',cancellation,operator_id) returning id into policy_id;
  end if;
  insert into private.commercial_settings(environment,policy_id,enabled)
    values('live',policy_id,true)
    on conflict(environment) do update set policy_id=excluded.policy_id,enabled=true;
  update private.booking_policy set enabled=true,approved_by=operator_id,approved_at=now() where singleton;
  if not found then raise exception 'Expected singleton booking policy is missing.'; end if;
  insert into private.booking_policy_history(actor_id,settings)
    select operator_id,to_jsonb(p)||jsonb_build_object('authorization_source',
      'Owner-approved live launch configuration executed by assistant through the authorized management connection, 2026-10-13 UTC',
      'commercial_policy_id',policy_id)
    from private.booking_policy p where singleton;
end $$;
commit;
