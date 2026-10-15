-- Owner-authorized reduction to 30 founding hosts, approved October 12 Miami time.
-- Run only after the host-v2 legal migration and matching app are ready.
-- This is a guarded one-time configuration action, not an automatic migration.
-- Old policies and all acceptance/enrollment/booking/payment snapshots are retained.
-- approved_by preserves the original approved operator; the owner delegated this
-- cap-only revision in conversation. No auth.uid() is set or user consent fabricated.
-- The commercial enabled flags and global booking configuration are not changed.
begin;
do $$
declare
  expected record;
  original private.commercial_policies%rowtype;
  replacement private.commercial_policies%rowtype;
  settings private.commercial_settings%rowtype;
  target_kind text;
  expected_settings integer;
  expected_copy jsonb;
  replacement_count integer;
begin
  -- Same environment locks as admin policy saves and founding enrollment.
  -- Fixed order also serializes the two production configuration changes together.
  perform pg_catalog.pg_advisory_xact_lock(72464,pg_catalog.hashtext('live'));
  perform pg_catalog.pg_advisory_xact_lock(72464,pg_catalog.hashtext('sandbox'));
  if to_regprocedure('private.current_legal_acceptance(uuid,text)') is null or
    position('qualia_host_2026_10_13_v2' in pg_get_functiondef(
      'private.current_legal_acceptance(uuid,text)'::regprocedure))=0 then
    raise exception 'Apply the host-v2 legal migration before changing the founding cohort.';
  end if;

  if exists(select 1 from private.commercial_policies where id='047161b1-c46f-4cfe-bf9a-f2cab619bc71') then
    target_kind:='rehearsal'; expected_settings:=1;
    if exists(select 1 from private.commercial_policies where id in
      ('a2471d8d-9f80-40b0-8bbf-5f42b2ca8188','09c510e0-1c08-40c7-a33a-0c5981138271')) then
      raise exception 'Mixed rehearsal and production source policies; inspect the target.';
    end if;
  elsif exists(select 1 from private.commercial_policies where id='a2471d8d-9f80-40b0-8bbf-5f42b2ca8188')
    and exists(select 1 from private.commercial_policies where id='09c510e0-1c08-40c7-a33a-0c5981138271') then
    target_kind:='production'; expected_settings:=2;
  else
    raise exception 'Expected Qualia source policies are missing; verify the target project.';
  end if;
  if (select count(*) from private.commercial_settings)<>expected_settings then
    raise exception 'Unexpected commercial settings; inspect the target before changing policy.';
  end if;

  for expected in select * from (values
    ('production','live','a2471d8d-9f80-40b0-8bbf-5f42b2ca8188'::uuid,
      'qualia_host_2026_10_13_v1','qualia_host_2026_10_13_v2',
      '033c5f79-f66a-49e5-90e9-dc6a7864d7f9'::uuid,'2026-10-13 02:52:04.720705+00'::timestamptz,
      '782f68d8853adc7b6f7f0787914e7d48'),
    ('production','sandbox','09c510e0-1c08-40c7-a33a-0c5981138271'::uuid,
      'sandbox-2026-10-12-v1','sandbox-2026-10-13-cap30-v2',
      '033c5f79-f66a-49e5-90e9-dc6a7864d7f9'::uuid,'2026-10-12 16:42:07.443815+00'::timestamptz,
      'a34eca13efc64a98aaec423c527c7b43'),
    ('rehearsal','sandbox','047161b1-c46f-4cfe-bf9a-f2cab619bc71'::uuid,
      'local-rehearsal-only-v1','local-rehearsal-only-cap30-v2',
      '4b1e5621-0993-4c04-8ddf-99d69023f9f5'::uuid,'2026-10-12 22:52:03.686311+00'::timestamptz,
      'fa604e95335fdda8a9cd2bf1bd1680bb')
    ) as sources(target,environment,old_id,old_version,new_version,approved_by,created_at,cancellation_md5)
    where target=target_kind order by environment
  loop
    select * into strict original from private.commercial_policies where id=expected.old_id for update;
    if row(original.environment,original.standard_fee_bps,original.founder_fee_bps,
      original.founder_free_bookings,original.founder_duration_months,original.founder_cohort_cap,
      original.processing_allocation,original.payout_delay_hours,original.restore_refunded_credit,
      original.referral_free_bookings,original.referral_credit_cap,original.terms_version,
      original.approved_by,original.created_at,md5(original.cancellation_terms))
      is distinct from row(expected.environment,1750,1250,3,3,40,'host_actual_cost'::text,
        48,true,1,2,expected.old_version,expected.approved_by,expected.created_at,expected.cancellation_md5) then
      raise exception 'Original % policy no longer matches the approved source.',expected.environment;
    end if;
    if (select count(*) from private.host_incentive_terms where environment=expected.environment)>30 then
      raise exception 'More than 30 founders are already enrolled in %; preserve their agreements and review.',expected.environment;
    end if;
    select * into strict settings from private.commercial_settings
      where environment=expected.environment for update;
    expected_copy:=(to_jsonb(original)-'id'-'created_at')||jsonb_build_object(
      'founder_cohort_cap',30,'terms_version',expected.new_version);
    select count(*) into replacement_count from private.commercial_policies
      where environment=expected.environment and terms_version=expected.new_version;
    if replacement_count>1 then
      raise exception 'Duplicate replacement policy versions; inspect before changing configuration.';
    elsif replacement_count=1 then
      select * into strict replacement from private.commercial_policies
        where environment=expected.environment and terms_version=expected.new_version for update;
      if (to_jsonb(replacement)-'id'-'created_at') is distinct from expected_copy then
        raise exception 'Replacement policy differs from the approved cap-only copy.';
      end if;
    else
      replacement.id:=null;
    end if;
    if settings.policy_id is distinct from original.id and
      (replacement.id is null or settings.policy_id is distinct from replacement.id) then
      raise exception 'A later or unknown policy is active; do not replace it silently.';
    end if;
    if replacement.id is null then
      -- Populate the row from the original so every non-target field is preserved,
      -- including future added columns. Explicit identity/time make this a new version.
      select * into replacement from jsonb_populate_record(null::private.commercial_policies,
        expected_copy||jsonb_build_object('id',gen_random_uuid(),'created_at',now()));
      insert into private.commercial_policies select replacement.*;
    end if;
    if settings.policy_id=original.id then
      update private.commercial_settings set policy_id=replacement.id
        where environment=expected.environment and policy_id=original.id;
      if not found then raise exception 'Commercial settings changed unexpectedly.'; end if;
    end if;
    -- Deliberately no enabled update and no founder/booking/consent writes.
  end loop;
end $$;
commit;
