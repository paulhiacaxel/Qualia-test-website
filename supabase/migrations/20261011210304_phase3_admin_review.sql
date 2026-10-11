-- Phase 3: verified administrators review immutable host submissions.
-- Internal notes and exact meeting details remain outside the exposed schema.
begin;

create table private.listing_review_details (
  listing_id uuid primary key references public.listings(id) on delete restrict,
  profile_checked boolean not null default false,
  experience_checked boolean not null default false,
  location_checked boolean not null default false,
  risks_checked boolean not null default false,
  risk_notes text not null default '' check (char_length(risk_notes) <= 10000),
  consultation_scheduled_at timestamptz,
  host_feedback text not null default '' check (char_length(host_feedback) <= 3000),
  reviewed_at timestamptz not null default now()
);
alter table private.listing_review_details enable row level security;
revoke all on table private.listing_review_details from public, anon, authenticated;
grant all on table private.listing_review_details to service_role;

create function private.require_verified_admin()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from auth.users u join private.admin_memberships a on a.user_id = u.id
    where u.id = actor_id and not coalesce(u.is_anonymous, false)
      and u.email_confirmed_at is not null
  ) then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  return actor_id;
end;
$$;
revoke all on function private.require_verified_admin() from public, anon, authenticated;

-- Administrators can sign registered review photos, never arbitrary bucket files.
create function private.admin_can_read_listing_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users u join private.admin_memberships a on a.user_id = u.id
    where u.id = auth.uid() and not coalesce(u.is_anonymous, false)
      and u.email_confirmed_at is not null
  ) then return false; end if;
  return exists (select 1 from public.listing_photos p join public.listings l on l.id = p.listing_id
    where p.storage_path = p_name and l.status <> 'draft');
end;
$$;
revoke all on function private.admin_can_read_listing_object(text) from public, anon, authenticated;
grant execute on function private.admin_can_read_listing_object(text) to authenticated;
create policy qualia_photos_read_review_admin on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and private.admin_can_read_listing_object(name));

create function private.admin_get_listing_review(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_verified_admin();
  select jsonb_build_object(
    'listing', to_jsonb(l),
    'host', (select to_jsonb(h) from public.host_profiles h where h.user_id = l.host_id),
    'location', (select to_jsonb(a) - 'listing_id' from private.listing_locations a where a.listing_id = l.id),
    'photos', coalesce((select jsonb_agg(to_jsonb(p) order by p.position) from public.listing_photos p where p.listing_id = l.id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at) from public.availability_windows a where a.listing_id = l.id), '[]'::jsonb),
    'review', (select to_jsonb(r) - 'listing_id' from private.listing_review_details r where r.listing_id = l.id),
    'history', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
      select stage, outcome, internal_note, reviewer_id, created_at from private.listing_review_events
      where listing_id = l.id order by created_at desc limit 100
    ) e), '[]'::jsonb)
  ) into result from public.listings l where l.id = p_listing_id and l.status <> 'draft';
  if result is null then raise exception 'Submitted listing unavailable.' using errcode = 'P0002'; end if;
  return result;
end;
$$;
revoke all on function private.admin_get_listing_review(uuid) from public, anon, authenticated;
grant execute on function private.admin_get_listing_review(uuid) to authenticated;
create function public.admin_get_listing_review(p_listing_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.admin_get_listing_review(p_listing_id);
$$;
revoke all on function public.admin_get_listing_review(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_listing_review(uuid) to authenticated;

-- A single transactional command owns all review transitions. Browser sessions
-- retain no table mutation grants, including sessions belonging to an admin.
create function private.admin_review_listing(p_listing_id uuid, p_action text,
  p_expected_updated_at timestamptz, p_note text, p_host_feedback text,
  p_scheduled_at timestamptz, p_risk_notes text, p_checks jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_verified_admin();
  listing_host_id uuid;
  item public.listings%rowtype;
  detail private.listing_review_details%rowtype;
  event_stage text;
begin
  if p_action is null or p_action not in ('start_review', 'approve_safety', 'reject',
    'require_consultation', 'schedule_consultation', 'complete_consultation', 'waive_consultation', 'publish', 'pause') then
    raise exception 'Choose a supported review action.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 3 and 5000
    or char_length(coalesce(p_host_feedback, '')) > 3000
    or char_length(coalesce(p_risk_notes, '')) > 10000 then
    raise exception 'Add a concise review note (3–5000 characters).' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) + char_length(btrim(coalesce(p_risk_notes, ''))) > 9500 then
    raise exception 'Keep the combined decision and risk notes under 9500 characters.' using errcode = '22023';
  end if;
  select host_id into listing_host_id from public.listings where id = p_listing_id;
  if listing_host_id is null then raise exception 'Listing unavailable.' using errcode = 'P0002'; end if;
  -- Same order as host mutations: host advisory lock, then listing row lock.
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(listing_host_id::text));
  select * into item from public.listings where id = p_listing_id for update;
  if not found or item.status = 'draft' then
    raise exception 'This listing has not been submitted.' using errcode = '55000';
  end if;
  if p_expected_updated_at is null or item.updated_at <> p_expected_updated_at then
    raise exception 'This listing changed. Reload it before reviewing.' using errcode = '40001';
  end if;
  insert into private.listing_review_details(listing_id) values (p_listing_id) on conflict do nothing;
  select * into detail from private.listing_review_details where listing_id = p_listing_id;

  if p_action = 'start_review' then
    if item.status <> 'submitted' then raise exception 'Only submitted listings can start review.' using errcode = '55000'; end if;
    update public.listings set status = 'in_review' where id = p_listing_id;
    event_stage := 'safety';

  elsif p_action = 'approve_safety' then
    if item.status not in ('submitted', 'in_review') or item.safety_status <> 'pending' then
      raise exception 'Safety review is not pending.' using errcode = '55000';
    end if;
    if p_checks is null or p_checks->'profile' is distinct from 'true'::jsonb
      or p_checks->'experience' is distinct from 'true'::jsonb
      or p_checks->'location' is distinct from 'true'::jsonb
      or p_checks->'risks' is distinct from 'true'::jsonb
      or btrim(coalesce(p_risk_notes, '')) = '' then
      raise exception 'Complete all review checks and record the relevant risks.' using errcode = '22023';
    end if;
    update private.listing_review_details set profile_checked = true, experience_checked = true,
      location_checked = true, risks_checked = true, risk_notes = btrim(p_risk_notes),
      host_feedback = '', consultation_scheduled_at = null where listing_id = p_listing_id;
    update public.listings set status = 'in_review', safety_status = 'approved' where id = p_listing_id;
    event_stage := 'safety';

  elsif p_action = 'reject' then
    if item.status not in ('submitted', 'in_review', 'approved', 'paused') then
      raise exception 'Pause a live listing before returning it for changes.' using errcode = '55000';
    end if;
    if char_length(btrim(coalesce(p_host_feedback, ''))) < 3 then
      raise exception 'Explain to the host what must change.' using errcode = '22023';
    end if;
    update public.listings set status = 'rejected', safety_status = 'rejected',
      consultation_status = 'not_requested', published_at = null where id = p_listing_id;
    update private.listing_review_details set profile_checked = false, experience_checked = false,
      location_checked = false, risks_checked = false, host_feedback = btrim(p_host_feedback),
      consultation_scheduled_at = null where listing_id = p_listing_id;
    event_stage := 'safety';

  elsif p_action in ('require_consultation', 'schedule_consultation', 'complete_consultation', 'waive_consultation') then
    if item.status not in ('in_review', 'approved') or item.safety_status <> 'approved' then
      raise exception 'Approve the safety review before deciding on a consultation.' using errcode = '55000';
    end if;
    if p_action = 'require_consultation' then
      if item.consultation_status not in ('not_requested', 'waived') then
        raise exception 'A consultation is already underway or completed.' using errcode = '55000';
      end if;
      update public.listings set status = 'in_review', consultation_status = 'required' where id = p_listing_id;
      update private.listing_review_details set consultation_scheduled_at = null where listing_id = p_listing_id;
    elsif p_action = 'schedule_consultation' then
      if item.consultation_status not in ('required', 'scheduled') or p_scheduled_at is null or p_scheduled_at <= now() then
        raise exception 'Choose a future time for the required consultation.' using errcode = '22023';
      end if;
      update public.listings set status = 'in_review', consultation_status = 'scheduled' where id = p_listing_id;
      update private.listing_review_details set consultation_scheduled_at = p_scheduled_at where listing_id = p_listing_id;
    elsif p_action = 'complete_consultation' then
      if item.consultation_status <> 'scheduled' or detail.consultation_scheduled_at is null
        or detail.consultation_scheduled_at > now() then
        raise exception 'Only a scheduled consultation whose time has arrived can be completed.' using errcode = '55000';
      end if;
      update public.listings set status = 'approved', consultation_status = 'completed' where id = p_listing_id;
    else
      if item.consultation_status not in ('not_requested', 'required', 'scheduled') then
        raise exception 'This consultation already has a final decision.' using errcode = '55000';
      end if;
      update public.listings set status = 'approved', consultation_status = 'waived' where id = p_listing_id;
      update private.listing_review_details set consultation_scheduled_at = null where listing_id = p_listing_id;
    end if;
    event_stage := 'consultation';

  elsif p_action = 'publish' then
    if item.status <> 'approved' or item.safety_status <> 'approved'
      or item.consultation_status not in ('completed', 'waived')
      or not (detail.profile_checked and detail.experience_checked and detail.location_checked and detail.risks_checked) then
      raise exception 'Complete safety and consultation decisions before publication.' using errcode = '55000';
    end if;
    if not exists (select 1 from auth.users u join public.profiles p on p.id = u.id
      join public.host_profiles h on h.user_id = p.id where p.id = item.host_id
      and p.is_host and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
      and btrim(h.display_name) <> '' and btrim(h.bio) <> '')
      or btrim(item.title) = '' or btrim(item.description) = '' or btrim(item.neighborhood) = ''
      or not exists (select 1 from private.listing_locations a where a.listing_id = p_listing_id
        and btrim(a.address_line1) <> '' and btrim(a.postal_code) <> '') then
      raise exception 'A verified host, complete profile, listing, and meeting address are required.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.listing_photos p where p.listing_id = p_listing_id)
      or exists (select 1 from public.listing_photos p where p.listing_id = p_listing_id and not exists (
        select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = p.storage_path
          and o.owner_id = item.host_id::text)) then
      raise exception 'All listing photos must have their original uploaded files.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.availability_windows a where a.listing_id = p_listing_id
      and a.starts_at > now() and a.ends_at - a.starts_at >= item.duration_minutes * interval '1 minute') then
      raise exception 'The listing needs current future availability before publication.' using errcode = '22023';
    end if;
    update public.listings set status = 'published', published_at = now() where id = p_listing_id;
    event_stage := 'publication';

  else -- pause: remove from public browsing immediately, preserving review history.
    if item.status <> 'published' then raise exception 'Only a live listing can be paused.' using errcode = '55000'; end if;
    if char_length(btrim(coalesce(p_host_feedback, ''))) < 3 then
      raise exception 'Explain the pause to the host.' using errcode = '22023';
    end if;
    update public.listings set status = 'paused', published_at = null where id = p_listing_id;
    update private.listing_review_details set host_feedback = btrim(p_host_feedback) where listing_id = p_listing_id;
    event_stage := 'publication';
  end if;

  update private.listing_review_details set reviewed_at = now() where listing_id = p_listing_id;
  -- Notes are append-only for all app roles. No UPDATE/DELETE policy is granted.
  insert into private.listing_review_events(listing_id, reviewer_id, stage, outcome, internal_note)
  values (p_listing_id, actor_id, event_stage, p_action, btrim(p_note)
    || case when p_action in ('reject', 'pause') then E'\nHost feedback: ' || btrim(p_host_feedback) else '' end
    || case when p_action = 'approve_safety' then E'\nRisk assessment: ' || btrim(p_risk_notes) else '' end
    || case when p_action = 'schedule_consultation' then E'\nScheduled for: ' || p_scheduled_at::text else '' end);
end;
$$;
revoke all on function private.admin_review_listing(uuid, text, timestamptz, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function private.admin_review_listing(uuid, text, timestamptz, text, text, timestamptz, text, jsonb) to authenticated;
create function public.admin_review_listing(p_listing_id uuid, p_action text,
  p_expected_updated_at timestamptz, p_note text, p_host_feedback text,
  p_scheduled_at timestamptz, p_risk_notes text, p_checks jsonb)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_review_listing(p_listing_id, p_action, p_expected_updated_at,
    p_note, p_host_feedback, p_scheduled_at, p_risk_notes, p_checks);
$$;
revoke all on function public.admin_review_listing(uuid, text, timestamptz, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_review_listing(uuid, text, timestamptz, text, text, timestamptz, text, jsonb) to authenticated;

-- Hosts see only the feedback intended for them, never the internal assessment.
create function private.get_listing_review_feedback(p_listing_id uuid)
returns table(host_feedback text, reviewed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host();
begin
  if not exists (select 1 from public.listings where id = p_listing_id and host_id = actor_id) then
    raise exception 'Listing unavailable.' using errcode = '42501';
  end if;
  return query select d.host_feedback, d.reviewed_at from private.listing_review_details d
    where d.listing_id = p_listing_id and d.host_feedback <> '';
end;
$$;
revoke all on function private.get_listing_review_feedback(uuid) from public, anon, authenticated;
grant execute on function private.get_listing_review_feedback(uuid) to authenticated;
create function public.get_listing_review_feedback(p_listing_id uuid)
returns table(host_feedback text, reviewed_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.get_listing_review_feedback(p_listing_id);
$$;
revoke all on function public.get_listing_review_feedback(uuid) from public, anon, authenticated;
grant execute on function public.get_listing_review_feedback(uuid) to authenticated;

comment on table private.listing_review_details is 'Internal operational review, not a certification or legal waiver. Owner-approved launch criteria still required.';
commit;
