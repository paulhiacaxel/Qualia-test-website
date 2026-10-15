import { MARKER, uuid, accountId, sqlString as q } from "./guards.mjs";

// A local rehearsal commercial contract, never a production policy or real-user acceptance.
export const policy = {
  environment: "sandbox",
  enabled: true,
  standard_fee_bps: 1750,
  founder_fee_bps: 1250,
  founder_free_bookings: 3,
  founder_duration_months: 3,
  founder_cohort_cap: 30,
  processing_allocation: "host_actual_cost",
  payout_delay_hours: 48,
  restore_refunded_credit: true,
  referral_free_bookings: 1,
  referral_credit_cap: 2,
  terms_version: "local-rehearsal-only-v1",
  cancellation_terms:
    "Synthetic local rehearsal only; no real experience or payment. Guest cancellation at least 48 hours before start or host cancellation receives a full refund; later guest cancellations require review.",
  incentive_start: "host_enrollment",
  cutoff_rule: "checkout_before_cutoff_frozen_quote",
  refund_rule: "proportional_commission_nonrefundable_processing",
  completion_rule: "admin_after_end",
  liability_acknowledged: true,
};

function identity(state) {
  return Object.fromEntries(
    ["run", "host", "guest", "listing"].map((name) => [name, q(uuid(state[name]))]),
  );
}
/** One DO statement is atomic and compatible with the CLI's extended query protocol. */
export function seedSql(state, recipient) {
  const s = identity(state);
  return `do $rehearsal$
declare operation jsonb; p uuid; safety_revision integer;
begin
  if exists(select 1 from public.listings) or exists(select 1 from public.bookings)
    or exists(select 1 from private.commercial_policies) or exists(select 1 from private.stripe_accounts)
    or (select count(*) from auth.users) <> 2
    or not exists(select 1 from auth.users where id=${s.host} and email_confirmed_at is not null)
    or not exists(select 1 from auth.users where id=${s.guest} and email_confirmed_at is not null) then
    raise exception 'Rehearsal seed requires only its two fresh local Auth users and an empty marketplace.';
  end if;
  create schema qualia_rehearsal;
  revoke all on schema qualia_rehearsal from public,anon,authenticated,service_role;
  create table qualia_rehearsal.fixture(run_id uuid primary key, marker text not null, host_id uuid not null,
    guest_id uuid not null, listing_id uuid not null, created_at timestamptz not null default now());
  create table qualia_rehearsal.time_advances(booking_id uuid primary key, original_starts_at timestamptz not null,
    original_ends_at timestamptz not null, advanced_at timestamptz not null default now());
  revoke all on all tables in schema qualia_rehearsal from public,anon,authenticated,service_role;
  insert into qualia_rehearsal.fixture values(${s.run},${q(MARKER)},${s.host},${s.guest},${s.listing},now());
  insert into private.admin_memberships(user_id,reason) values(${s.host},'Isolated local acceptance fixture only');
  -- These two synthetic people explicitly attest only inside this isolated fixture.
  perform set_config('request.jwt.claim.sub',${s.guest},true);
  perform public.attest_adult_account(true,'adult_account_v1');
  -- Explicit synthetic acceptance; never fabricate consent for hosted real users.
  perform public.accept_legal_terms('guest','qualia_guest_2026_10_13_v1',null,true,true);
  perform set_config('request.jwt.claim.sub',${s.host},true);
  perform public.attest_adult_account(true,'adult_account_v1');
  perform public.accept_legal_terms('host','qualia_guest_2026_10_13_v1','qualia_host_2026_10_13_v2',true,true);
  perform public.enable_host_mode();
  perform public.save_host_profile('Local rehearsal host','Synthetic private acceptance fixture.','Miami',null);
  insert into public.listings(id,host_id,title,description,category,price_cents,duration_minutes,city,neighborhood,
    status,safety_status,consultation_status,published_at)
    values(${s.listing},${s.host},'LOCAL TEST ONLY — private art session','Synthetic local fixture; never publish on bookqualia.com.',
      'art',10000,60,'Miami','Wynwood','draft','pending','not_requested',null);
  insert into private.listing_locations(listing_id,address_line1,postal_code)
    values(${s.listing},'Local fixture — no real meeting address','33127');
  insert into public.availability_windows(listing_id,host_id,starts_at,ends_at)
    select ${s.listing},${s.host},date_trunc('hour',now())+n*interval '1 day',date_trunc('hour',now())+n*interval '1 day'+interval '4 hours'
      from generate_series(4,7) n;
  -- Use the same evidence and review commands as the host/admin UI. No global
  -- rehearsal exception or fabricated acceptance exists in the production schema.
  safety_revision := public.save_listing_safety_submission(${s.listing},null,
    jsonb_build_object('min_age',18,'max_age',120,'guardian_presence','not_required',
      'participation_rules','Synthetic local art session: follow host instructions.',
      'hazards','Synthetic local fixture: ordinary studio hazards reviewed.',
      'equipment','Synthetic local fixture: inspected art supplies provided.',
      'prerequisites','Synthetic local fixture: no previous experience required.',
      'supervision_plan','Synthetic local fixture: continuous individual supervision.',
      'credentials_evidence','Synthetic local fixture: relevant teaching evidence reviewed.',
      'insurance_evidence','Synthetic local fixture: activity coverage reviewed.',
      'venue_evidence','Synthetic local fixture: studio suitability reviewed.',
      'emergency_plan','Synthetic local fixture: stop activity and contact emergency services.',
      'evidence_expires_on',null));
  update public.listings set status='submitted' where id=${s.listing};
  perform public.admin_review_listing_safety(${s.listing},safety_revision,'approved',
    'Synthetic local acceptance review only','2100-01-01T00:00:00Z',false);
  update public.listings set status='published',safety_status='approved',
    consultation_status='waived',published_at=now() where id=${s.listing};
  perform public.admin_set_booking_policy(1440,1440,true);
  p := public.admin_set_commercial_policy(${q(JSON.stringify(policy))}::jsonb);
  operation := public.pay_prepare_account(${s.host},'sandbox');
  perform public.pay_attach_account((operation->>'operation_id')::uuid,${q(accountId(recipient))});
  perform public.pay_sync_account(${q(recipient)},'sandbox',true,true,'[]'::jsonb);
  perform set_config('request.jwt.claim.sub','',true);
end $rehearsal$;`;
}

export function markerSql(state) {
  const s = identity(state);
  return `select count(*)::int as matches from qualia_rehearsal.fixture
    where marker=${q(MARKER)} and run_id=${s.run} and host_id=${s.host} and guest_id=${s.guest} and listing_id=${s.listing}`;
}
/** Legacy fixtures only: an acknowledged participant's service date is immutable. */
export function advanceSql(state, bookingId) {
  const s = identity(state),
    booking = q(uuid(bookingId));
  return `do $rehearsal$
declare b public.bookings%rowtype; delay integer; new_end timestamptz;
begin
  if not exists(select 1 from qualia_rehearsal.fixture where marker=${q(MARKER)} and run_id=${s.run}
    and host_id=${s.host} and guest_id=${s.guest} and listing_id=${s.listing}) then
    raise exception 'Wrong rehearsal marker.'; end if;
  perform pg_advisory_xact_lock(72461,hashtext(${s.host}));
  select * into b from public.bookings where id=${booking} and host_id=${s.host} and guest_id=${s.guest}
    and listing_id=${s.listing} and status='confirmed' for update;
  if not found then raise exception 'Only this confirmed local fixture can advance.'; end if;
  select p.payout_delay_hours into delay from private.payment_attempts a join private.commercial_policies p on p.id=a.policy_id
    where a.booking_id=b.id and a.environment='sandbox' and p.environment='sandbox' and a.state='paid'
      and a.quarantine_reason is null and a.session_id like 'cs_test_%' and a.charge_id is not null;
  if not found or exists(select 1 from private.payment_attempts where booking_id=b.id and environment<>'sandbox') then
    raise exception 'A verified sandbox payment is required.'; end if;
  if exists(select 1 from private.booking_participation where booking_id=b.id) then
    raise exception 'Captured participant dates cannot be fast-forwarded. Complete this rehearsal at its original scheduled time and captured payout delay.';
  end if;
  insert into qualia_rehearsal.time_advances(booking_id,original_starts_at,original_ends_at) values(b.id,b.starts_at,b.ends_at);
  -- One host lock covers both the old and proposed ranges. Place later rehearsals
  -- before earlier advanced fixtures/blocks instead of creating an overlap.
  new_end := least(now() - (delay+1)*interval '1 hour',
    (select min(starts_at)-interval '1 hour' from public.bookings where host_id=b.host_id and id<>b.id
      and status in ('requested','awaiting_payment','confirmed','completed')),
    (select min(starts_at)-interval '1 hour' from public.host_calendar_blocks where host_id=b.host_id));
  update public.bookings set starts_at=new_end-(b.ends_at-b.starts_at),ends_at=new_end where id=b.id;
end $rehearsal$;`;
}

export function evidenceSql(state, bookingId) {
  const s = identity(state);
  return `select b.id,b.status as booking_status,a.environment,a.state,a.amount_cents,a.received_amount_cents,
    a.received_currency,a.processor_fee_cents,a.commission_bps,a.commission_cents,a.session_id,a.payment_intent_id,a.charge_id,a.quarantine_reason,
    (select count(*)::int from private.stripe_event_inbox e where e.environment='sandbox' and e.status='processed'
      and e.object_id in (a.session_id,a.payment_intent_id)) as processed_payment_events,
    (select count(*)::int from private.stripe_event_inbox where status='failed') as failed_events,
    (select count(*)::int from private.settlement_operations where attempt_id=a.id and state in ('queued','pending','unknown')) as pending_operations,
    coalesce((select sum(amount_cents)::int from private.settlement_operations where attempt_id=a.id and kind='transfer' and state='succeeded'),0) as transfer_cents,
    coalesce((select sum(amount_cents)::int from private.settlement_operations where attempt_id=a.id and kind='refund' and state='succeeded'),0) as refund_cents,
    coalesce((select sum(amount_cents)::int from private.settlement_operations where attempt_id=a.id and kind='reversal' and state='succeeded'),0) as reversal_cents
    from public.bookings b join private.payment_attempts a on a.booking_id=b.id
    where b.id=${q(uuid(bookingId))} and b.host_id=${s.host} and b.guest_id=${s.guest} and b.listing_id=${s.listing}
      and a.state='paid'`;
}
