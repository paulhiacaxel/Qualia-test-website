-- Qualia phase 1: identity and read-only marketplace foundations.
-- Profile edits and host opt-in are the ONLY end-user writes enabled here.
-- Later migrations must implement reviewed, transactional commands for listings,
-- bookings and payments. Never grant raw clients control over workflow statuses.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create type public.experience_category as enum (
  'cooking', 'sailing', 'photography', 'language', 'music', 'art', 'fitness'
);
create type public.listing_status as enum (
  'draft', 'submitted', 'in_review', 'approved', 'published', 'rejected', 'paused'
);
create type public.safety_review_status as enum ('pending', 'approved', 'rejected');
create type public.consultation_status as enum (
  'not_requested', 'required', 'scheduled', 'completed', 'waived'
);
create type public.booking_status as enum (
  'requested', 'awaiting_payment', 'confirmed', 'declined', 'cancelled', 'completed', 'expired'
);

-- Account data is private to its owner. Public host biographies are separate.
-- Every member can be a guest; is_host adds a capability, not a trust badge.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only a trusted operator/database credential may grant administrative access.
-- JWT user_metadata, including a claimed 'role', is deliberately ignored.
create table private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create index admin_memberships_granted_by_idx on private.admin_memberships(granted_by);

create table public.host_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  bio text not null default '' check (char_length(bio) <= 5000),
  city text not null check (city in ('Miami', 'Miami Beach')),
  portfolio_url text check (portfolio_url is null or char_length(portfolio_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only broad public location appears here. Street addresses and access
-- instructions belong in private.listing_locations and never in public APIs.
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.host_profiles(user_id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 20000),
  category public.experience_category not null,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  duration_minutes integer not null check (duration_minutes > 0),
  city text not null check (city in ('Miami', 'Miami Beach')),
  neighborhood text not null default '' check (char_length(neighborhood) <= 120),
  time_zone text not null default 'America/New_York' check (time_zone = 'America/New_York'),
  status public.listing_status not null default 'draft',
  safety_status public.safety_review_status not null default 'pending',
  consultation_status public.consultation_status not null default 'not_requested',
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, host_id),
  constraint publication_requires_review check (
    status <> 'published' or (
      safety_status = 'approved'
      and consultation_status in ('completed', 'waived')
      and published_at is not null
    )
  )
);
create index listings_host_id_idx on public.listings(host_id);
create index listings_published_category_idx on public.listings(category, city, published_at desc)
  where status = 'published';
create index listings_review_queue_idx on public.listings(status, submitted_at)
  where status in ('submitted', 'in_review', 'approved');

create table private.listing_locations (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  address_line1 text not null check (char_length(address_line1) between 1 and 250),
  address_line2 text not null default '' check (char_length(address_line2) <= 250),
  postal_code text not null check (char_length(postal_code) between 1 and 20),
  meeting_instructions text not null default '' check (char_length(meeting_instructions) <= 5000),
  updated_at timestamptz not null default now()
);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  -- A path in a private Storage bucket, not an arbitrary executable URL.
  storage_path text not null unique check (char_length(storage_path) between 1 and 1024),
  alt_text text not null default '' check (char_length(alt_text) <= 250),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

-- Concrete UTC windows avoid ambiguous local times around daylight saving.
-- Availability creation and booking-slot computation arrive in phases 2 and 4.
create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  host_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (listing_id, host_id) references public.listings(id, host_id) on delete cascade,
  check (ends_at > starts_at),
  unique (listing_id, starts_at, ends_at)
);
create index availability_host_time_idx on public.availability_windows(host_id, starts_at);

-- No client insert/update/delete grants. The booking RPC added in phase 4
-- must lock the host schedule, validate current availability, capture pricing,
-- and reject conflicts atomically before reservations can be created.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  host_id uuid not null,
  guest_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'requested',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  guest_message text not null default '' check (char_length(guest_message) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (listing_id, host_id) references public.listings(id, host_id) on delete restrict,
  check (guest_id <> host_id),
  check (ends_at > starts_at)
);
create index bookings_host_time_idx on public.bookings(host_id, starts_at);
create index bookings_guest_time_idx on public.bookings(guest_id, starts_at);
create index bookings_listing_idx on public.bookings(listing_id, host_id);

-- Internal review history is intentionally absent from public listing rows.
-- Phase 3 will write events through a reviewed admin command, never raw clients.
create table private.listing_review_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  stage text not null check (stage in ('safety', 'consultation', 'publication')),
  outcome text not null check (char_length(outcome) between 1 and 100),
  internal_note text not null default '' check (char_length(internal_note) <= 10000),
  created_at timestamptz not null default now()
);
create index listing_review_events_listing_idx on private.listing_review_events(listing_id, created_at desc);
create index listing_review_events_reviewer_idx on private.listing_review_events(reviewer_id);

-- Revoke legacy Supabase automatic grants before selectively granting access.
revoke all on table public.profiles, public.host_profiles, public.listings,
  public.listing_photos, public.availability_windows, public.bookings
  from public, anon, authenticated;
revoke all on table private.admin_memberships, private.listing_locations,
  private.listing_review_events from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.host_profiles, public.listings, public.listing_photos,
  public.availability_windows to anon, authenticated;
grant select on table public.bookings to authenticated;
grant select (user_id) on private.admin_memberships to authenticated;
grant all on table public.profiles, public.host_profiles, public.listings,
  public.listing_photos, public.availability_windows, public.bookings,
  private.admin_memberships, private.listing_locations, private.listing_review_events
  to service_role;

alter table public.profiles enable row level security;
alter table public.host_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.availability_windows enable row level security;
alter table public.bookings enable row level security;
alter table private.admin_memberships enable row level security;
alter table private.listing_locations enable row level security;
alter table private.listing_review_events enable row level security;

-- Members can ask only whether THEY are administrators. The function uses the
-- caller's RLS, so it needs no elevated SECURITY DEFINER privileges.
create policy admin_memberships_read_self on private.admin_memberships
  for select to authenticated using (user_id = (select auth.uid()));
create function public.is_admin()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_memberships where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create policy profiles_read_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy listings_read_published on public.listings
  for select to anon, authenticated using (status = 'published');
create policy listings_read_owner_or_admin on public.listings
  for select to authenticated
  using (host_id = (select auth.uid()) or (select public.is_admin()));

create policy host_profiles_read_published on public.host_profiles
  for select to anon, authenticated using (
    exists (select 1 from public.listings l where l.host_id = user_id and l.status = 'published')
  );
create policy host_profiles_read_self_or_admin on public.host_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy listing_photos_read_visible_listing on public.listing_photos
  for select to anon, authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id)
  );
create policy availability_read_visible_listing on public.availability_windows
  for select to anon, authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id)
  );
create policy bookings_read_participant_or_admin on public.bookings
  for select to authenticated using (
    guest_id = (select auth.uid()) or host_id = (select auth.uid()) or (select public.is_admin())
  );
-- No policies/grants expose private locations or internal review notes yet.

create function private.set_updated_at()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger host_profiles_set_updated_at before update on public.host_profiles
  for each row execute function private.set_updated_at();
create trigger listings_set_updated_at before update on public.listings
  for each row execute function private.set_updated_at();
create trigger listing_locations_set_updated_at before update on private.listing_locations
  for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

-- Definer privilege is necessary only for the Auth trigger to create a profile.
-- It is not exposed in the Data API, has no EXECUTE grant, and is not an RPC.
-- Only harmless display text is copied from user-editable metadata.
create function private.bootstrap_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;
revoke all on function private.bootstrap_profile() from public, anon, authenticated;
create trigger qualia_auth_user_created after insert on auth.users
  for each row execute function private.bootstrap_profile();

-- Backfill pre-existing Auth accounts without inventing capabilities or roles.
insert into public.profiles(id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120) from auth.users
on conflict (id) do nothing;

-- A deliberately narrow, idempotent opt-in. It cannot grant admin status or
-- approve a listing. Reject anonymous Auth sessions and unverified accounts.
create function private.enable_host_mode()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from auth.users u where u.id = actor_id
      and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
  ) then
    raise exception 'A verified account is required.' using errcode = '42501';
  end if;
  update public.profiles set is_host = true where id = actor_id;
  if not found then
    raise exception 'Profile is unavailable.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function private.enable_host_mode() from public, anon, authenticated;
grant execute on function private.enable_host_mode() to authenticated;
create function public.enable_host_mode()
returns void
language sql security invoker
set search_path = ''
as $$ select private.enable_host_mode(); $$;
revoke all on function public.enable_host_mode() from public, anon, authenticated;
grant execute on function public.enable_host_mode() to authenticated;

comment on table public.profiles is 'Private account identity. Hosts remain guests; is_host does not imply listing approval.';
comment on table public.bookings is 'Read-only foundation for clients. Phase 4 must add atomic schedule locking and booking commands before enabling writes.';
comment on table private.listing_locations is 'Exact meeting information. Never expose this schema via Supabase Data API.';
comment on table private.admin_memberships is 'Operator-managed authorization source. Never populate from signup metadata.';

commit;
