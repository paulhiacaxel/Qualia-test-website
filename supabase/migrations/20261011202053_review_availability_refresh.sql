-- Availability can expire while a listing awaits review. Hosts may add fresh
-- windows without reopening reviewed content. Removal remains governed by the
-- existing, stricter require_availability_listing helper from phase 4.
begin;

create or replace function private.add_availability_window(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_verified_host();
  item public.listings%rowtype;
  new_id uuid;
begin
  -- require_verified_host takes the same host lock as review and booking.
  select * into item from public.listings where id = p_listing_id and host_id = actor_id for update;
  if not found then raise exception 'Listing unavailable.' using errcode = '42501'; end if;
  if item.status not in ('draft', 'rejected', 'submitted', 'in_review', 'approved', 'published') then
    raise exception 'Availability cannot be added while this listing is paused.' using errcode = '55000';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() or p_ends_at <= p_starts_at
    or p_ends_at - p_starts_at > interval '24 hours' then
    raise exception 'Choose a valid future availability window of at most 24 hours.' using errcode = '22023';
  end if;
  if p_ends_at - p_starts_at < item.duration_minutes * interval '1 minute' then
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

-- CREATE OR REPLACE preserves the narrow authenticated-only ACL from phase 2.
commit;
