-- Owner-approved founding cohort reduction: first 30, with unchanged 3 bookings / 3 months.
-- Advance only the current host agreement and trusted acceptance manifest.
-- Existing v1 acceptance records, bookings, quotes and commercial policies remain immutable.
-- New commercial configuration is activated separately after read-back of its current state.
-- No account is accepted, enrolled or moved to a new policy by this migration.
begin;

create or replace function private.current_legal_acceptance(p_user_id uuid,p_scope text)
returns uuid language sql stable security definer set search_path='' as $$
  select id from private.legal_acceptances where user_id=p_user_id and scope=p_scope and
    version=case p_scope when 'guest' then 'qualia_guest_2026_10_13_v1'
      when 'host' then 'qualia_host_2026_10_13_v2' end;
$$;

create or replace function private.accept_legal_terms(p_scope text,p_guest_version text,p_host_version text,p_terms_accepted boolean,p_privacy_acknowledged boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_adult_user(); manifest jsonb;
begin
  if p_scope is null or p_scope not in ('guest','host') or p_guest_version is distinct from 'qualia_guest_2026_10_13_v1'
    or (p_scope='host' and p_host_version is distinct from 'qualia_host_2026_10_13_v2')
    or (p_scope='guest' and p_host_version is not null)
    or p_terms_accepted is distinct from true or p_privacy_acknowledged is distinct from true then
    raise exception 'Review the current terms, cancellation policy and privacy notice, then explicitly confirm.' using errcode='22023';
  end if;
  manifest:=jsonb_build_object('/terms','qualia_guest_2026_10_13_v1',
    '/cancellation-policy','qualia_cancellation_2026_10_13_v1','/privacy','qualia_privacy_2026_10_13_v1');
  -- The actor, versions, document manifest and time come from trusted database code.
  -- Repeat confirmation is idempotent and never changes the original acceptance time.
  insert into private.legal_acceptances(user_id,scope,version,document_versions)
    values(actor,'guest','qualia_guest_2026_10_13_v1',manifest) on conflict(user_id,scope,version) do nothing;
  if p_scope='host' then
    insert into private.legal_acceptances(user_id,scope,version,document_versions)
      values(actor,'host','qualia_host_2026_10_13_v2',manifest||jsonb_build_object('/host-terms','qualia_host_2026_10_13_v2'))
      on conflict(user_id,scope,version) do nothing;
  end if;
end $$;

create or replace function private.get_legal_acceptance()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user();
begin
 return jsonb_build_object(
   'guest_accepted',private.current_legal_acceptance(actor,'guest') is not null,
   'host_accepted',private.current_legal_acceptance(actor,'host') is not null and private.current_legal_acceptance(actor,'guest') is not null,
   'guest_version','qualia_guest_2026_10_13_v1','host_version','qualia_host_2026_10_13_v2',
   'records',coalesce((select jsonb_agg(jsonb_build_object('scope',scope,'version',version,
     'document_versions',document_versions,'accepted_at',accepted_at) order by accepted_at)
     from private.legal_acceptances where user_id=actor),'[]'::jsonb));
end $$;

commit;
