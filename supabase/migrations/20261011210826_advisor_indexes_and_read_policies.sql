-- Hosted advisor remediation. These indexes support foreign-key lookups on the
-- referencing side; existing environment-first/partial indexes do not cover them.
begin;

create index commercial_policies_approved_by_idx on private.commercial_policies(approved_by);
create index commercial_settings_policy_id_idx on private.commercial_settings(policy_id);
create index host_incentive_terms_approved_by_idx on private.host_incentive_terms(approved_by);
create index host_incentive_terms_policy_id_idx on private.host_incentive_terms(policy_id);
create index payment_attempts_guest_id_idx on private.payment_attempts(guest_id);
create index payment_attempts_policy_id_idx on private.payment_attempts(policy_id);
create index referral_credit_grants_approved_by_idx on private.referral_credit_grants(approved_by);
create index referral_credit_grants_referred_host_id_idx on private.referral_credit_grants(referred_host_id);
create index referral_credit_grants_referrer_id_idx on private.referral_credit_grants(referrer_id);
create index settlement_operations_actor_id_idx on private.settlement_operations(actor_id);
create index settlement_operations_attempt_id_idx on private.settlement_operations(attempt_id);
create index availability_listing_host_idx on public.availability_windows(listing_id,host_id);

-- Authenticated SELECT previously ORed two permissive policies. Express the
-- identical predicate once per role, avoiding redundant policy evaluation.
-- Anonymous visitors still have only the published-only policy.
alter policy listings_read_published on public.listings to anon;
drop policy listings_read_owner_or_admin on public.listings;
create policy listings_read_authenticated on public.listings
  for select to authenticated
  using (status = 'published' or host_id = (select auth.uid()) or (select public.is_admin()));

alter policy host_profiles_read_published on public.host_profiles to anon;
drop policy host_profiles_read_self_or_admin on public.host_profiles;
create policy host_profiles_read_authenticated on public.host_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid()) or (select public.is_admin())
    or exists (select 1 from public.listings l
      where l.host_id = host_profiles.user_id and l.status = 'published')
  );

-- Private tables intentionally retain RLS without client policies (deny all).
commit;
