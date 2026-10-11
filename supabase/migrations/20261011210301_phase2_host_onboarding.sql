-- Phase 2: narrow host onboarding commands and a private photo bucket.
-- Table grants remain read-only. Public invoker wrappers delegate to narrowly
-- scoped private commands; every privileged command verifies the actor again.
begin;

alter table public.listings add constraint listing_price_upper_bound check (price_cents <= 10000000);
alter table public.listings add constraint listing_duration_upper_bound check (duration_minutes <= 1440);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']);

-- Serialize a host's draft/profile/photo operations, including submission.
-- Never derive administrative authority from a role supplied by the client.
create function private.require_verified_host()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = actor_id and p.is_host and not coalesce(u.is_anonymous, false)
      and u.email_confirmed_at is not null
  ) then
    raise exception 'A verified host account is required.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(actor_id::text));
  return actor_id;
end;
$$;

create function private.require_editable_listing(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); listing_state public.listing_status;
begin
  select l.status into listing_state from public.listings l
    where l.id = p_listing_id and l.host_id = actor_id for update;
  if not found then raise exception 'Listing unavailable.' using errcode = '42501'; end if;
  if listing_state not in ('draft', 'rejected') then
    raise exception 'This listing is locked while it is in review or live.' using errcode = '55000';
  end if;
  return actor_id;
end;
$$;

create function private.save_host_profile(p_display_name text, p_bio text, p_city text, p_portfolio_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host();
begin
  if btrim(coalesce(p_display_name, '')) = '' then
    raise exception 'Add your display name.' using errcode = '22023';
  end if;
  if nullif(btrim(p_portfolio_url), '') is not null
    and p_portfolio_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Portfolio links must use HTTPS.' using errcode = '22023';
  end if;
  -- Public host details form part of the safety review. Do not silently replace
  -- them after submission; a later revision workflow can reopen review safely.
  if exists (select 1 from public.listings where host_id = actor_id and status not in ('draft', 'rejected')) then
    raise exception 'Profile changes require reopening your reviewed listings.' using errcode = '55000';
  end if;
  insert into public.host_profiles(user_id, display_name, bio, city, portfolio_url)
    values (actor_id, btrim(p_display_name), btrim(coalesce(p_bio, '')), p_city, nullif(btrim(p_portfolio_url), ''))
    on conflict (user_id) do update set display_name = excluded.display_name,
      bio = excluded.bio, city = excluded.city, portfolio_url = excluded.portfolio_url;
end;
$$;

create function private.create_listing(p_title text, p_description text, p_category public.experience_category,
  p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host(); new_id uuid;
begin
  if not exists (select 1 from public.host_profiles where user_id = actor_id) then
    raise exception 'Complete your host profile first.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_title, '')) = '' then raise exception 'Add a title.' using errcode = '22023'; end if;
  insert into public.listings(host_id, title, description, category, price_cents, duration_minutes, city, neighborhood)
  values (actor_id, btrim(p_title), btrim(coalesce(p_description, '')), p_category,
    p_price_cents, p_duration_minutes, p_city, btrim(coalesce(p_neighborhood, '')))
  returning id into new_id;
  return new_id;
end;
$$;

create function private.save_listing(p_listing_id uuid, p_title text, p_description text,
  p_category public.experience_category, p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_editable_listing(p_listing_id);
  if btrim(coalesce(p_title, '')) = '' then raise exception 'Add a title.' using errcode = '22023'; end if;
  update public.listings set title = btrim(p_title), description = btrim(coalesce(p_description, '')),
    category = p_category, price_cents = p_price_cents, duration_minutes = p_duration_minutes,
    city = p_city, neighborhood = btrim(coalesce(p_neighborhood, '')) where id = p_listing_id;
end;
$$;

create function private.delete_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_editable_listing(p_listing_id);
begin
  if exists (select 1 from private.listing_review_events where listing_id = p_listing_id) then
    raise exception 'Reviewed listings retain their history. Revise this listing or ask an administrator to pause it.' using errcode = '55000';
  end if;
  -- Deleting storage metadata with SQL leaves the underlying file orphaned.
  -- The caller must remove files through the Storage API before deleting a draft.
  if exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos'
    and o.name like actor_id::text || '/' || p_listing_id::text || '/%') then
    raise exception 'Remove the listing photo files before deleting this draft.' using errcode = '55000';
  end if;
  delete from public.listings where id = p_listing_id;
end;
$$;

create function private.get_listing_location(p_listing_id uuid)
returns table(address_line1 text, address_line2 text, postal_code text, meeting_instructions text)
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_verified_host();
begin
  if not exists (select 1 from public.listings where id = p_listing_id and host_id = actor_id) then
    raise exception 'Listing unavailable.' using errcode = '42501';
  end if;
  return query select a.address_line1, a.address_line2, a.postal_code, a.meeting_instructions
    from private.listing_locations a where a.listing_id = p_listing_id;
end;
$$;

create function private.save_listing_location(p_listing_id uuid, p_address_line1 text,
  p_address_line2 text, p_postal_code text, p_meeting_instructions text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_editable_listing(p_listing_id);
  if btrim(coalesce(p_address_line1, '')) = '' or btrim(coalesce(p_postal_code, '')) = '' then
    raise exception 'Add the meeting address and postal code.' using errcode = '22023';
  end if;
  insert into private.listing_locations(listing_id, address_line1, address_line2, postal_code, meeting_instructions)
  values (p_listing_id, btrim(p_address_line1), btrim(coalesce(p_address_line2, '')), btrim(p_postal_code),
    btrim(coalesce(p_meeting_instructions, '')))
  on conflict (listing_id) do update set address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2, postal_code = excluded.postal_code,
    meeting_instructions = excluded.meeting_instructions;
end;
$$;

-- Strict namespace: uploader UUID / listing UUID / unique object UUID + extension.
create function private.own_listing_object_id(p_name text)
returns uuid language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_name is null or p_name !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    or split_part(p_name, '/', 1) <> auth.uid()::text then return null; end if;
  return split_part(p_name, '/', 2)::uuid;
end;
$$;

create function private.can_read_listing_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare listing_id uuid := private.own_listing_object_id(p_name);
begin
  if listing_id is null then return false; end if;
  return exists (select 1 from public.listings l where l.id = listing_id and l.host_id = auth.uid());
end;
$$;

create function private.can_write_listing_object(p_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare listing_id uuid := private.own_listing_object_id(p_name);
begin
  if listing_id is null then return false; end if;
  perform private.require_editable_listing(listing_id);
  return true;
exception when insufficient_privilege or object_not_in_prerequisite_state then return false;
end;
$$;

create policy qualia_photos_read_own on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and private.can_read_listing_object(name));
create policy qualia_photos_insert_own_draft on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and owner_id = (select auth.uid())::text
    and private.can_write_listing_object(name));
create policy qualia_photos_update_own_draft on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and owner_id = (select auth.uid())::text
    and private.can_write_listing_object(name))
  with check (bucket_id = 'listing-photos' and owner_id = (select auth.uid())::text
    and private.can_write_listing_object(name));
create policy qualia_photos_delete_own_draft on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and owner_id = (select auth.uid())::text
    and private.can_write_listing_object(name));

create function private.add_listing_photo(p_listing_id uuid, p_storage_path text, p_alt_text text, p_position integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_editable_listing(p_listing_id); new_id uuid;
begin
  if private.own_listing_object_id(p_storage_path) is distinct from p_listing_id or not exists (
    select 1 from storage.objects o where o.bucket_id = 'listing-photos'
      and o.name = p_storage_path and o.owner_id = actor_id::text
  ) then raise exception 'Upload this photo to your listing first.' using errcode = '22023'; end if;
  if (select count(*) from public.listing_photos where listing_id = p_listing_id) >= 8 then
    raise exception 'Use at most eight photos per listing.' using errcode = '22023';
  end if;
  insert into public.listing_photos(listing_id, storage_path, alt_text, position)
    values (p_listing_id, p_storage_path, btrim(coalesce(p_alt_text, '')), p_position) returning id into new_id;
  return new_id;
end;
$$;

create function private.remove_listing_photo(p_photo_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare photo_listing_id uuid; actor_id uuid := private.require_verified_host();
begin
  select p.listing_id into photo_listing_id from public.listing_photos p
    join public.listings l on l.id = p.listing_id where p.id = p_photo_id and l.host_id = actor_id;
  if not found then raise exception 'Photo unavailable.' using errcode = '42501'; end if;
  perform private.require_editable_listing(photo_listing_id);
  delete from public.listing_photos where id = p_photo_id;
  -- Remove the file separately through Storage API; SQL metadata deletion is unsafe.
end;
$$;

create function private.add_availability_window(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_editable_listing(p_listing_id); new_id uuid;
begin
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at then
    raise exception 'Choose a valid future availability window.' using errcode = '22023';
  end if;
  if p_ends_at - p_starts_at > interval '24 hours' then
    raise exception 'Availability windows can be at most 24 hours.' using errcode = '22023';
  end if;
  if p_ends_at - p_starts_at < (select duration_minutes * interval '1 minute' from public.listings where id = p_listing_id) then
    raise exception 'Availability must be long enough for the experience.' using errcode = '22023';
  end if;
  if exists (select 1 from public.availability_windows a where a.listing_id = p_listing_id
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then
    raise exception 'This availability overlaps an existing window.' using errcode = '23P01';
  end if;
  insert into public.availability_windows(listing_id, host_id, starts_at, ends_at)
    values (p_listing_id, actor_id, p_starts_at, p_ends_at) returning id into new_id;
  return new_id;
end;
$$;

create function private.remove_availability_window(p_window_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare window_listing_id uuid; actor_id uuid := private.require_verified_host();
begin
  select a.listing_id into window_listing_id from public.availability_windows a
    where a.id = p_window_id and a.host_id = actor_id;
  if not found then raise exception 'Availability unavailable.' using errcode = '42501'; end if;
  perform private.require_editable_listing(window_listing_id);
  delete from public.availability_windows where id = p_window_id;
end;
$$;

create function private.submit_listing_for_review(p_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_editable_listing(p_listing_id); item public.listings%rowtype;
begin
  select * into item from public.listings where id = p_listing_id;
  if btrim(item.title) = '' or btrim(item.description) = '' or btrim(item.neighborhood) = '' then
    raise exception 'Complete the title, description, and neighborhood before submitting.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.host_profiles h where h.user_id = actor_id
    and btrim(h.display_name) <> '' and btrim(h.bio) <> '') then
    raise exception 'Complete your host profile before submitting.' using errcode = '22023';
  end if;
  if not exists (select 1 from private.listing_locations where listing_id = p_listing_id) then
    raise exception 'Add your private meeting address before submitting.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.listing_photos p join storage.objects o
    on o.bucket_id = 'listing-photos' and o.name = p.storage_path and o.owner_id = actor_id::text
    where p.listing_id = p_listing_id) then
    raise exception 'Upload at least one listing photo before submitting.' using errcode = '22023';
  end if;
  if exists (select 1 from public.listing_photos p where p.listing_id = p_listing_id
    and not exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = p.storage_path)) then
    raise exception 'Remove or re-upload missing photo files before submitting.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.availability_windows a where a.listing_id = p_listing_id
    and a.starts_at > now() and a.ends_at - a.starts_at >= item.duration_minutes * interval '1 minute') then
    raise exception 'Add future availability long enough for this experience.' using errcode = '22023';
  end if;
  update public.listings set status = 'submitted', safety_status = 'pending',
    consultation_status = 'not_requested', submitted_at = now(), published_at = null
    where id = p_listing_id;
end;
$$;

-- Explicit function ACLs: Postgres otherwise grants EXECUTE to PUBLIC.
revoke all on function private.require_verified_host() from public, anon, authenticated;
revoke all on function private.require_editable_listing(uuid) from public, anon, authenticated;
revoke all on function private.own_listing_object_id(text) from public, anon, authenticated;
revoke all on function private.can_read_listing_object(text) from public, anon, authenticated;
grant execute on function private.can_read_listing_object(text) to authenticated;
revoke all on function private.can_write_listing_object(text) from public, anon, authenticated;
grant execute on function private.can_write_listing_object(text) to authenticated;

revoke all on function private.save_host_profile(text, text, text, text) from public, anon, authenticated;
grant execute on function private.save_host_profile(text, text, text, text) to authenticated;
create function public.save_host_profile(p_display_name text, p_bio text, p_city text, p_portfolio_url text)
returns void language sql security invoker set search_path = '' as $$
  select private.save_host_profile(p_display_name, p_bio, p_city, p_portfolio_url);
$$;
revoke all on function public.save_host_profile(text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_host_profile(text, text, text, text) to authenticated;

revoke all on function private.create_listing(text, text, public.experience_category, integer, integer, text, text) from public, anon, authenticated;
grant execute on function private.create_listing(text, text, public.experience_category, integer, integer, text, text) to authenticated;
create function public.create_listing(p_title text, p_description text, p_category public.experience_category, p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_listing(p_title, p_description, p_category, p_price_cents, p_duration_minutes, p_city, p_neighborhood);
$$;
revoke all on function public.create_listing(text, text, public.experience_category, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.create_listing(text, text, public.experience_category, integer, integer, text, text) to authenticated;

revoke all on function private.save_listing(uuid, text, text, public.experience_category, integer, integer, text, text) from public, anon, authenticated;
grant execute on function private.save_listing(uuid, text, text, public.experience_category, integer, integer, text, text) to authenticated;
create function public.save_listing(p_listing_id uuid, p_title text, p_description text, p_category public.experience_category, p_price_cents integer, p_duration_minutes integer, p_city text, p_neighborhood text)
returns void language sql security invoker set search_path = '' as $$
  select private.save_listing(p_listing_id, p_title, p_description, p_category, p_price_cents, p_duration_minutes, p_city, p_neighborhood);
$$;
revoke all on function public.save_listing(uuid, text, text, public.experience_category, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.save_listing(uuid, text, text, public.experience_category, integer, integer, text, text) to authenticated;

revoke all on function private.delete_listing(uuid) from public, anon, authenticated;
grant execute on function private.delete_listing(uuid) to authenticated;
create function public.delete_listing(p_listing_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_listing(p_listing_id);
$$;
revoke all on function public.delete_listing(uuid) from public, anon, authenticated;
grant execute on function public.delete_listing(uuid) to authenticated;

revoke all on function private.get_listing_location(uuid) from public, anon, authenticated;
grant execute on function private.get_listing_location(uuid) to authenticated;
create function public.get_listing_location(p_listing_id uuid)
returns table(address_line1 text, address_line2 text, postal_code text, meeting_instructions text) language sql security invoker set search_path = '' as $$
  select * from private.get_listing_location(p_listing_id);
$$;
revoke all on function public.get_listing_location(uuid) from public, anon, authenticated;
grant execute on function public.get_listing_location(uuid) to authenticated;

revoke all on function private.save_listing_location(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function private.save_listing_location(uuid, text, text, text, text) to authenticated;
create function public.save_listing_location(p_listing_id uuid, p_address_line1 text, p_address_line2 text, p_postal_code text, p_meeting_instructions text)
returns void language sql security invoker set search_path = '' as $$
  select private.save_listing_location(p_listing_id, p_address_line1, p_address_line2, p_postal_code, p_meeting_instructions);
$$;
revoke all on function public.save_listing_location(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_listing_location(uuid, text, text, text, text) to authenticated;

revoke all on function private.add_listing_photo(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function private.add_listing_photo(uuid, text, text, integer) to authenticated;
create function public.add_listing_photo(p_listing_id uuid, p_storage_path text, p_alt_text text, p_position integer)
returns uuid language sql security invoker set search_path = '' as $$
  select private.add_listing_photo(p_listing_id, p_storage_path, p_alt_text, p_position);
$$;
revoke all on function public.add_listing_photo(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.add_listing_photo(uuid, text, text, integer) to authenticated;

revoke all on function private.remove_listing_photo(uuid) from public, anon, authenticated;
grant execute on function private.remove_listing_photo(uuid) to authenticated;
create function public.remove_listing_photo(p_photo_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.remove_listing_photo(p_photo_id);
$$;
revoke all on function public.remove_listing_photo(uuid) from public, anon, authenticated;
grant execute on function public.remove_listing_photo(uuid) to authenticated;

revoke all on function private.add_availability_window(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.add_availability_window(uuid, timestamptz, timestamptz) to authenticated;
create function public.add_availability_window(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language sql security invoker set search_path = '' as $$
  select private.add_availability_window(p_listing_id, p_starts_at, p_ends_at);
$$;
revoke all on function public.add_availability_window(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.add_availability_window(uuid, timestamptz, timestamptz) to authenticated;

revoke all on function private.remove_availability_window(uuid) from public, anon, authenticated;
grant execute on function private.remove_availability_window(uuid) to authenticated;
create function public.remove_availability_window(p_window_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.remove_availability_window(p_window_id);
$$;
revoke all on function public.remove_availability_window(uuid) from public, anon, authenticated;
grant execute on function public.remove_availability_window(uuid) to authenticated;

revoke all on function private.submit_listing_for_review(uuid) from public, anon, authenticated;
grant execute on function private.submit_listing_for_review(uuid) to authenticated;
create function public.submit_listing_for_review(p_listing_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.submit_listing_for_review(p_listing_id);
$$;
revoke all on function public.submit_listing_for_review(uuid) from public, anon, authenticated;
grant execute on function public.submit_listing_for_review(uuid) to authenticated;

commit;
