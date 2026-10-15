-- Adult account eligibility and activity-specific participation review.
-- These records are factual attestations and review decisions, NOT legal releases
-- or acceptance of unapproved terms. No existing account or booking is attested.
begin;

alter table public.profiles add column adult_attested_at timestamptz;
alter table public.profiles add column adult_attestation_version text;
alter table public.profiles add constraint adult_attestation_pair check (
  (adult_attested_at is null and adult_attestation_version is null) or
  (adult_attested_at is not null and adult_attestation_version = 'adult_account_v1'));
alter table public.listings add column participation_rules jsonb;

create table private.listing_safety_submissions (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  min_age integer check (min_age between 0 and 120),
  max_age integer check (max_age between 0 and 120),
  guardian_presence text check (guardian_presence in ('required','not_required')),
  participation_rules text not null default '' check (char_length(participation_rules) <= 4000),
  hazards text not null default '' check (char_length(hazards) <= 4000),
  equipment text not null default '' check (char_length(equipment) <= 4000),
  prerequisites text not null default '' check (char_length(prerequisites) <= 4000),
  supervision_plan text not null default '' check (char_length(supervision_plan) <= 4000),
  credentials_evidence text not null default '' check (char_length(credentials_evidence) <= 4000),
  insurance_evidence text not null default '' check (char_length(insurance_evidence) <= 4000),
  venue_evidence text not null default '' check (char_length(venue_evidence) <= 4000),
  emergency_plan text not null default '' check (char_length(emergency_plan) <= 4000),
  evidence_expires_on date,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_revision integer,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 4000),
  valid_until timestamptz,
  minor_without_guardian_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_age is null or max_age is null or min_age <= max_age)
);
create index listing_safety_reviewer_idx on private.listing_safety_submissions(reviewed_by);
create table private.listing_safety_review_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  revision integer not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  submission_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index listing_safety_history_listing_idx on private.listing_safety_review_history(listing_id,created_at);
create index listing_safety_history_reviewer_idx on private.listing_safety_review_history(reviewer_id);
create table private.booking_participation (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  kind text not null check (kind in ('self','minor')),
  age_at_experience integer not null check (age_at_experience between 0 and 120),
  rules_snapshot jsonb not null check (jsonb_typeof(rules_snapshot) = 'object'),
  adult_booker_confirmed boolean not null check (adult_booker_confirmed),
  rules_accepted boolean not null check (rules_accepted),
  guardian_authority_confirmed boolean not null,
  guardian_presence_accepted boolean not null,
  account_attestation_version text not null check (account_attestation_version = 'adult_account_v1'),
  accepted_at timestamptz not null default now(),
  check ((kind='self' and age_at_experience >= 18) or
    (kind='minor' and age_at_experience < 18 and guardian_authority_confirmed and guardian_presence_accepted))
);
alter table private.listing_safety_submissions enable row level security;
alter table private.listing_safety_review_history enable row level security;
alter table private.booking_participation enable row level security;
revoke all on private.listing_safety_submissions, private.listing_safety_review_history, private.booking_participation from public,anon,authenticated;
grant all on private.listing_safety_submissions, private.listing_safety_review_history, private.booking_participation to service_role;

create function private.adult_account_is_eligible(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_user_id and p.adult_attested_at is not null and p.adult_attestation_version='adult_account_v1'
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;
create function private.require_adult_user()
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_verified_user();
begin
  if not private.adult_account_is_eligible(actor) then
    raise exception 'Confirm that you are at least 18 before hosting or making a new booking.' using errcode='42501';
  end if;
  return actor;
end $$;
create function private.attest_adult_account(p_is_adult boolean,p_version text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_verified_user();
begin
  if p_is_adult is distinct from true or p_version is distinct from 'adult_account_v1' then
    raise exception 'An adult account holder must explicitly confirm they are at least 18.' using errcode='22023';
  end if;
  update public.profiles set adult_attested_at=coalesce(adult_attested_at,now()),
    adult_attestation_version='adult_account_v1' where id=actor;
end $$;
create function private.get_account_eligibility()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.require_verified_user(); result jsonb;
begin
  select jsonb_build_object('adult_attested_at',adult_attested_at,'adult_attestation_version',adult_attestation_version,
    'eligible',private.adult_account_is_eligible(actor)) into result from public.profiles where id=actor;
  return result;
end $$;
create or replace function private.enable_host_mode()
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_adult_user();
begin update public.profiles set is_host=true where id=actor; end $$;
create or replace function private.require_verified_host()
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_adult_user();
begin
  if not exists(select 1 from public.profiles where id=actor and is_host) then
    raise exception 'A verified host account is required.' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(actor::text));
  return actor;
end $$;

create function private.safety_submission_complete(p_listing_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.listing_safety_submissions s where s.listing_id=p_listing_id
  and s.min_age is not null and s.max_age is not null and s.guardian_presence is not null
  and btrim(s.participation_rules)<>'' and btrim(s.hazards)<>'' and btrim(s.equipment)<>''
  and btrim(s.prerequisites)<>'' and btrim(s.supervision_plan)<>'' and btrim(s.credentials_evidence)<>''
  and btrim(s.insurance_evidence)<>'' and btrim(s.venue_evidence)<>'' and btrim(s.emergency_plan)<>''
  and (s.evidence_expires_on is null or s.evidence_expires_on >= (now() at time zone 'America/New_York')::date));
$$;
create function private.approved_participation_rules(p_listing_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('revision',s.revision,'min_age',s.min_age,'max_age',s.max_age,
  'guardian_presence',s.guardian_presence,'participation_rules',s.participation_rules,'hazards',s.hazards,
  'equipment',s.equipment,'prerequisites',s.prerequisites,'supervision_plan',s.supervision_plan,'valid_until',s.valid_until)
 from private.listing_safety_submissions s join public.listings l on l.id=s.listing_id
 where s.listing_id=p_listing_id and s.review_status='approved' and s.reviewed_revision=s.revision
  and s.reviewed_by is not null and s.reviewed_at is not null and s.valid_until>now()
  and private.safety_submission_complete(s.listing_id) and private.adult_account_is_eligible(l.host_id)
  and (s.min_age>=18 or s.guardian_presence='required' or s.minor_without_guardian_approved)
  and (s.evidence_expires_on is null or s.valid_until <= ((s.evidence_expires_on+1)::timestamp at time zone 'America/New_York'));
$$;
-- Invalidation deliberately preserves previous bookings and their snapshots.
create function private.invalidate_safety_revision(p_listing_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update private.listing_safety_submissions set revision=revision+1,review_status='pending',reviewed_revision=null,
  reviewed_by=null,reviewed_at=null,review_note='',valid_until=null,minor_without_guardian_approved=false,updated_at=now()
  where listing_id=p_listing_id;
end $$;
create function private.get_listing_safety_submission(p_listing_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user(); result jsonb;
begin
 if not exists(select 1 from public.listings where id=p_listing_id and
   (host_id=actor or exists(select 1 from private.admin_memberships where user_id=actor))) then
   raise exception 'Listing unavailable.' using errcode='42501'; end if;
 select to_jsonb(s) into result from private.listing_safety_submissions s where listing_id=p_listing_id;
 return result;
end $$;
create function private.save_listing_safety_submission(p_listing_id uuid,p_expected_revision integer,p_submission jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_host(); current_revision integer; next_revision integer;
 key text; min_value integer; max_value integer; expiry date;
begin
 perform 1 from public.listings where id=p_listing_id and host_id=actor for update;
 if not found then raise exception 'Listing unavailable.' using errcode='42501'; end if;
 if p_submission is null or jsonb_typeof(p_submission)<>'object' then
   raise exception 'Provide the activity review fields.' using errcode='22023'; end if;
 for key in select jsonb_object_keys(p_submission) loop
  if key not in ('min_age','max_age','guardian_presence','participation_rules','hazards','equipment','prerequisites',
    'supervision_plan','credentials_evidence','insurance_evidence','venue_evidence','emergency_plan','evidence_expires_on') then
    raise exception 'Unexpected activity review field.' using errcode='22023'; end if;
 end loop;
 foreach key in array array['min_age','max_age'] loop
  if p_submission->>key is not null and (jsonb_typeof(p_submission->key)<>'number' or (p_submission->>key)!~'^[0-9]{1,3}$') then
    raise exception 'Participant ages must be whole years from 0 to 120.' using errcode='22023'; end if;
 end loop;
 min_value:=(p_submission->>'min_age')::integer; max_value:=(p_submission->>'max_age')::integer;
 if min_value not between 0 and 120 or max_value not between 0 and 120 or min_value>max_value then
  raise exception 'Choose a valid participant age range.' using errcode='22023'; end if;
 if p_submission->>'guardian_presence' is not null and p_submission->>'guardian_presence' not in ('required','not_required') then
  raise exception 'Choose the guardian presence requirement.' using errcode='22023'; end if;
 foreach key in array array['participation_rules','hazards','equipment','prerequisites','supervision_plan',
   'credentials_evidence','insurance_evidence','venue_evidence','emergency_plan'] loop
  if (p_submission->key is not null and jsonb_typeof(p_submission->key)<>'string') or char_length(coalesce(p_submission->>key,''))>4000 then
   raise exception 'Activity notes must be text of no more than 4000 characters per field.' using errcode='22023'; end if;
 end loop;
 if p_submission->>'evidence_expires_on' is not null then
  if p_submission->>'evidence_expires_on' !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'Use a complete evidence expiry date.' using errcode='22023'; end if;
  begin expiry:=(p_submission->>'evidence_expires_on')::date;
  exception when datetime_field_overflow or invalid_datetime_format then
   raise exception 'Use a valid evidence expiry date.' using errcode='22023'; end;
 end if;
 select revision into current_revision from private.listing_safety_submissions where listing_id=p_listing_id;
 if p_expected_revision is distinct from current_revision then
   raise exception 'The activity submission changed. Reload before saving.' using errcode='40001'; end if;
 next_revision:=coalesce(current_revision,0)+1;
 insert into private.listing_safety_submissions(listing_id,revision,min_age,max_age,guardian_presence,
   participation_rules,hazards,equipment,prerequisites,supervision_plan,credentials_evidence,insurance_evidence,venue_evidence,emergency_plan,evidence_expires_on)
 values(p_listing_id,next_revision,min_value,max_value,p_submission->>'guardian_presence',
   btrim(coalesce(p_submission->>'participation_rules','')),btrim(coalesce(p_submission->>'hazards','')),
   btrim(coalesce(p_submission->>'equipment','')),btrim(coalesce(p_submission->>'prerequisites','')),
   btrim(coalesce(p_submission->>'supervision_plan','')),btrim(coalesce(p_submission->>'credentials_evidence','')),
   btrim(coalesce(p_submission->>'insurance_evidence','')),btrim(coalesce(p_submission->>'venue_evidence','')),
   btrim(coalesce(p_submission->>'emergency_plan','')),expiry)
 on conflict(listing_id) do update set revision=excluded.revision,min_age=excluded.min_age,max_age=excluded.max_age,
  guardian_presence=excluded.guardian_presence,participation_rules=excluded.participation_rules,hazards=excluded.hazards,
  equipment=excluded.equipment,prerequisites=excluded.prerequisites,supervision_plan=excluded.supervision_plan,
  credentials_evidence=excluded.credentials_evidence,insurance_evidence=excluded.insurance_evidence,
  venue_evidence=excluded.venue_evidence,emergency_plan=excluded.emergency_plan,evidence_expires_on=excluded.evidence_expires_on,
  review_status='pending',reviewed_revision=null,reviewed_by=null,reviewed_at=null,review_note='',valid_until=null,
  minor_without_guardian_approved=false,updated_at=now();
 update public.listings set status='draft',safety_status='pending',consultation_status='not_requested',
  published_at=null,participation_rules=null where id=p_listing_id;
 return next_revision;
end $$;

create function private.admin_review_listing_safety(p_listing_id uuid,p_expected_revision integer,p_decision text,
 p_review_note text,p_valid_until timestamptz,p_minor_without_guardian_approved boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_verified_admin(); host_id_value uuid; s private.listing_safety_submissions%rowtype;
 state public.listing_status;
begin
 select host_id into host_id_value from public.listings where id=p_listing_id;
 if host_id_value is null then raise exception 'Listing unavailable.' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(host_id_value::text));
 select status into state from public.listings where id=p_listing_id for update;
 if state='draft' then raise exception 'The host must submit the activity before review.' using errcode='55000'; end if;
 select * into s from private.listing_safety_submissions where listing_id=p_listing_id for update;
 if not found then raise exception 'An activity submission is required.' using errcode='55000'; end if;
 if p_expected_revision is distinct from s.revision then
  raise exception 'The activity submission changed. Reload before reviewing.' using errcode='40001'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or char_length(btrim(coalesce(p_review_note,''))) not between 3 and 4000 then
  raise exception 'Record an approval or rejection with concise host-visible review notes.' using errcode='22023'; end if;
 if p_decision='approved' then
  if not private.safety_submission_complete(p_listing_id) or p_valid_until is null or not isfinite(p_valid_until) or p_valid_until<=now() then
   raise exception 'Complete the activity evidence and set a future review expiry.' using errcode='22023'; end if;
  if s.evidence_expires_on is not null and p_valid_until>((s.evidence_expires_on+1)::timestamp at time zone 'America/New_York') then
   raise exception 'Review approval cannot extend beyond the evidence expiry.' using errcode='22023'; end if;
  if s.min_age<18 and s.guardian_presence='not_required' and p_minor_without_guardian_approved is distinct from true then
   raise exception 'Explicitly review and approve any arrangement without guardian presence.' using errcode='22023'; end if;
 end if;
 update private.listing_safety_submissions set review_status=p_decision,reviewed_revision=revision,
  reviewed_by=actor,reviewed_at=now(),review_note=btrim(p_review_note),
  valid_until=case when p_decision='approved' then p_valid_until else null end,
  minor_without_guardian_approved=p_decision='approved' and s.min_age<18 and s.guardian_presence='not_required'
    and coalesce(p_minor_without_guardian_approved,false),updated_at=now()
  where listing_id=p_listing_id;
 insert into private.listing_safety_review_history(listing_id,revision,reviewer_id,decision,submission_snapshot)
  select listing_id,revision,actor,p_decision,to_jsonb(x) from private.listing_safety_submissions x where listing_id=p_listing_id;
 -- A rejected activity cannot retain its public approval. Overall review remains
 -- separate so the existing host-feedback/consultation workflow is preserved.
 if p_decision='rejected' then
  update public.listings set status='in_review',safety_status='pending',consultation_status='not_requested',
    participation_rules=null,published_at=null where id=p_listing_id;
 else
  update public.listings set participation_rules=private.approved_participation_rules(p_listing_id) where id=p_listing_id;
 end if;
end $$;

create function private.guard_listing_participation()
returns trigger language plpgsql security definer set search_path='' as $$
declare approved jsonb;
begin
 if tg_op='INSERT' then
  if new.status<>'draft' or new.safety_status<>'pending' or new.participation_rules is not null then
   raise exception 'New listings must start as drafts before activity review.' using errcode='55000'; end if;
  return new;
 end if;
 if row(new.title,new.description,new.category,new.price_cents,new.duration_minutes,new.city,new.neighborhood,new.time_zone)
   is distinct from row(old.title,old.description,old.category,old.price_cents,old.duration_minutes,old.city,old.neighborhood,old.time_zone) then
  perform private.invalidate_safety_revision(new.id);
  new.participation_rules:=null; new.safety_status:='pending'; new.consultation_status:='not_requested';
  new.status:='draft'; new.published_at:=null;
 end if;
 if new.status='submitted' and old.status is distinct from 'submitted' then
  if not private.safety_submission_complete(new.id) then
   raise exception 'Complete the activity, age, supervision, evidence and emergency fields before submitting.' using errcode='22023'; end if;
 end if;
 if (new.safety_status='approved' and old.safety_status is distinct from 'approved') or
    (new.status in ('approved','published') and old.status is distinct from new.status) then
  approved:=private.approved_participation_rules(new.id);
  if approved is null then raise exception 'Approve the current activity submission before safety approval or publication.' using errcode='55000'; end if;
  new.participation_rules:=approved;
 end if;
 if new.status='rejected' and old.status is distinct from 'rejected' then
  perform private.invalidate_safety_revision(new.id); new.participation_rules:=null;
 end if;
 -- Never copy host-private evidence or an unreviewed arbitrary JSON document
 -- into the public listing column, even through a trusted service write.
 new.participation_rules:=private.approved_participation_rules(new.id);
 return new;
end $$;
create trigger listings_participation_guard before insert or update on public.listings
 for each row execute function private.guard_listing_participation();
create function private.invalidate_listing_safety_dependency()
returns trigger language plpgsql security definer set search_path='' as $$
declare listing_id_value uuid; host_id_value uuid;
begin
 if tg_op='UPDATE' and to_jsonb(new)-'updated_at' = to_jsonb(old)-'updated_at' then return new; end if;
 if tg_table_name='host_profiles' then
  host_id_value:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(host_id_value::text));
  for listing_id_value in select id from public.listings where host_id=host_id_value loop
   perform private.invalidate_safety_revision(listing_id_value);
   update public.listings set status='draft',safety_status='pending',consultation_status='not_requested',published_at=null,participation_rules=null where id=listing_id_value;
  end loop;
 else
  listing_id_value:=case when tg_op='DELETE' then old.listing_id else new.listing_id end;
  select host_id into host_id_value from public.listings where id=listing_id_value;
  if host_id_value is not null then
   perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(host_id_value::text));
   perform private.invalidate_safety_revision(listing_id_value);
   update public.listings set status='draft',safety_status='pending',consultation_status='not_requested',published_at=null,participation_rules=null where id=listing_id_value;
  end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger safety_location_changed after insert or update or delete on private.listing_locations
 for each row execute function private.invalidate_listing_safety_dependency();
create trigger safety_photo_changed after insert or update or delete on public.listing_photos
 for each row execute function private.invalidate_listing_safety_dependency();
create trigger safety_host_profile_changed after update on public.host_profiles
 for each row execute function private.invalidate_listing_safety_dependency();

create function private.get_listing_participation_rules(p_listing_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select private.approved_participation_rules(l.id) from public.listings l where l.id=p_listing_id and l.status='published';
$$;
create function private.booking_participation_current(p_booking_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bookings b join private.booking_participation p on p.booking_id=b.id
  join public.listings l on l.id=b.listing_id
  where b.id=p_booking_id and l.status='published' and private.adult_account_is_eligible(b.guest_id)
   and private.adult_account_is_eligible(b.host_id)
   and private.approved_participation_rules(l.id) is not null
   and (private.approved_participation_rules(l.id)->>'revision')::integer=(p.rules_snapshot->>'revision')::integer
   and (private.approved_participation_rules(l.id)->>'valid_until')::timestamptz>=b.ends_at
   and (p.rules_snapshot->>'valid_until')::timestamptz>=b.ends_at);
$$;
create function private.guard_booking_participation_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; rules jsonb;
begin
 if tg_op<>'INSERT' then raise exception 'Captured participant acknowledgments cannot be changed or deleted.' using errcode='55000'; end if;
 select * into b from public.bookings where id=new.booking_id;
 perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(b.host_id::text));
 rules:=private.get_listing_participation_rules(b.listing_id);
 if not private.adult_account_is_eligible(b.guest_id) or not private.adult_account_is_eligible(b.host_id) then
  raise exception 'An explicitly attested adult booker and host are required.' using errcode='42501'; end if;
 if rules is null or new.rules_snapshot is distinct from rules or (rules->>'valid_until')::timestamptz<b.ends_at then
  raise exception 'Current reviewed participation rules must cover the whole experience.' using errcode='55000'; end if;
 if new.age_at_experience not between (rules->>'min_age')::integer and (rules->>'max_age')::integer then
  raise exception 'The participant age on the experience date is outside this activity age range.' using errcode='22023'; end if;
 new.accepted_at:=now();
 return new;
end $$;
create trigger booking_participation_snapshot_guard before insert or update or delete on private.booking_participation
 for each row execute function private.guard_booking_participation_snapshot();
create function private.require_booking_participation_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('requested','awaiting_payment') and not exists(select 1 from private.booking_participation where booking_id=new.id) then
  raise exception 'New booking requests require participant details and explicit acknowledgments.' using errcode='22023'; end if;
 return new;
end $$;
create constraint trigger bookings_participation_required after insert on public.bookings
 deferrable initially deferred for each row execute function private.require_booking_participation_snapshot();
create function private.guard_booking_acceptance_participation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='awaiting_payment' and old.status is distinct from 'awaiting_payment' then
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(new.host_id::text));
  if not private.booking_participation_current(new.id) then
   raise exception 'The reviewed activity or participant rules changed. The guest must make a new request.' using errcode='55000'; end if;
 end if;
 return new;
end $$;
create trigger bookings_participation_acceptance_guard before update of status on public.bookings
 for each row execute function private.guard_booking_acceptance_participation();
create function private.get_booking_participation(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_verified_user(); result jsonb;
begin
 if not exists(select 1 from public.bookings where id=p_booking_id and (actor in (host_id,guest_id)
   or exists(select 1 from private.admin_memberships where user_id=actor))) then
  raise exception 'Booking unavailable.' using errcode='42501'; end if;
 select to_jsonb(p)-'booking_id' into result from private.booking_participation p where booking_id=p_booking_id;
 return result;
end $$;

-- New requests capture the exact reviewed participation rules atomically.
create or replace function private.request_booking(p_listing_id uuid, p_starts_at timestamptz, p_guest_message text, p_participant jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_adult_user(); listing_host_id uuid;
  item public.listings%rowtype; policy private.booking_policy%rowtype;
  new_id uuid; ends_at_value timestamptz; rules jsonb; participant_age integer; key text;
begin
  if char_length(coalesce(p_guest_message, '')) > 3000 or p_starts_at is null or p_starts_at <= now() then
    raise exception 'Choose a future time and a message under 3000 characters.' using errcode = '22023';
  end if;
  -- A separate user-lock namespace makes guest rate limits atomic without
  -- reversing the host-lock order used by review, availability and payments.
  perform pg_catalog.pg_advisory_xact_lock(72462, pg_catalog.hashtext(actor_id::text));
  select host_id into listing_host_id from public.listings where id = p_listing_id and status = 'published';
  if listing_host_id is null then raise exception 'This experience is not available.' using errcode = '55000'; end if;
  if listing_host_id = actor_id then raise exception 'You cannot book your own experience.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461, pg_catalog.hashtext(listing_host_id::text));
  select * into item from public.listings where id = p_listing_id and status = 'published' for update;
  if not found then raise exception 'This experience is no longer available.' using errcode = '55000'; end if;
  if not exists (select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = item.host_id and p.is_host and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null) then
    raise exception 'This host is not currently accepting requests.' using errcode = '55000';
  end if;
  select * into policy from private.booking_policy where singleton and enabled and payment_deadline_minutes >= 32 for share;
  if not found then raise exception 'Booking requests are not open yet.' using errcode = '55000'; end if;
  if p_starts_at <= clock_timestamp() + interval '32 minutes' then
    raise exception 'Choose a time more than 32 minutes away so your host can respond and you can start payment.' using errcode = 'QL001';
  end if;
  if (select count(*) from public.bookings where guest_id = actor_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have reached the daily booking request limit.' using errcode = '54000';
  end if;
  ends_at_value := p_starts_at + item.duration_minutes * interval '1 minute';
  rules:=private.get_listing_participation_rules(item.id);
  if rules is null or (rules->>'valid_until')::timestamptz<ends_at_value then
    raise exception 'Current activity approval must cover the whole experience.' using errcode='55000'; end if;
  if p_participant is null or jsonb_typeof(p_participant)<>'object' then
    raise exception 'Provide participant details and acknowledge the activity rules.' using errcode='22023'; end if;
  for key in select jsonb_object_keys(p_participant) loop
    if key not in ('kind','age_at_experience','adult_booker_confirmed','rules_accepted',
      'guardian_authority_confirmed','guardian_presence_accepted','rules_revision') then
      raise exception 'Unexpected participant field.' using errcode='22023'; end if;
  end loop;
  if p_participant->>'kind' is null or p_participant->>'kind' not in ('self','minor')
    or jsonb_typeof(p_participant->'age_at_experience') is distinct from 'number'
    or (p_participant->>'age_at_experience')!~'^[0-9]{1,3}$' then
    raise exception 'Choose who is participating and their age in whole years on the experience date.' using errcode='22023'; end if;
  participant_age:=(p_participant->>'age_at_experience')::integer;
  if participant_age not between 0 and 120
    or participant_age not between (rules->>'min_age')::integer and (rules->>'max_age')::integer
    or (p_participant->>'kind'='self' and participant_age<18)
    or (p_participant->>'kind'='minor' and participant_age>=18) then
    raise exception 'The participant age on the experience date is outside the approved age range.' using errcode='22023'; end if;
  if jsonb_typeof(p_participant->'rules_revision') is distinct from 'number'
    or p_participant->'rules_revision' is distinct from rules->'revision' then
    raise exception 'The participation rules changed. Reload and review them before booking.' using errcode='40001'; end if;
  if p_participant->'adult_booker_confirmed' is distinct from 'true'::jsonb
    or p_participant->'rules_accepted' is distinct from 'true'::jsonb
    or jsonb_typeof(p_participant->'guardian_authority_confirmed') is distinct from 'boolean'
    or jsonb_typeof(p_participant->'guardian_presence_accepted') is distinct from 'boolean'
    or (p_participant->>'kind'='minor' and
      (p_participant->'guardian_authority_confirmed' is distinct from 'true'::jsonb
       or p_participant->'guardian_presence_accepted' is distinct from 'true'::jsonb)) then
    raise exception 'An adult booker must accept the rules and complete any required guardian acknowledgments.' using errcode='22023'; end if;

  if not exists (select 1 from public.availability_windows a where a.listing_id = item.id
    and a.starts_at <= p_starts_at and a.ends_at >= ends_at_value
    and mod(extract(epoch from (p_starts_at - a.starts_at)), (item.duration_minutes * 60)::numeric) = 0) then
    raise exception 'Choose one of the available times on the calendar.' using errcode = '22023';
  end if;
  perform private.expire_host_bookings(listing_host_id);
  if exists (select 1 from public.bookings b where b.host_id = listing_host_id
    and b.status in ('requested', 'awaiting_payment', 'confirmed')
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, ends_at_value, '[)')) then
    raise exception 'This host is no longer available at that time.' using errcode = '23P01';
  end if;
  if not exists (select 1 from private.listing_locations where listing_id = item.id) then
    raise exception 'This experience is missing its meeting details.' using errcode = '55000';
  end if;
  insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, amount_cents, currency,
    guest_message, request_expires_at, listing_title_snapshot, listing_category_snapshot,
    listing_city_snapshot, listing_neighborhood_snapshot, duration_minutes_snapshot,
    policy_request_expiry_minutes, policy_payment_deadline_minutes)
  values (item.id, item.host_id, actor_id, p_starts_at, ends_at_value, item.price_cents, item.currency,
    btrim(coalesce(p_guest_message, '')), least(p_starts_at - interval '32 minutes', now() + policy.request_expiry_minutes * interval '1 minute'),
    item.title, item.category, item.city, item.neighborhood, item.duration_minutes,
    policy.request_expiry_minutes, policy.payment_deadline_minutes) returning id into new_id;
  insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
    adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,account_attestation_version)
  values(new_id,p_participant->>'kind',participant_age,rules,true,true,
    (p_participant->>'guardian_authority_confirmed')::boolean,
    (p_participant->>'guardian_presence_accepted')::boolean,'adult_account_v1');
  insert into private.booking_meeting_locations(booking_id, address_line1, address_line2, postal_code, meeting_instructions)
    select new_id, address_line1, address_line2, postal_code, meeting_instructions
    from private.listing_locations where listing_id = item.id;
  insert into private.booking_events(booking_id, actor_id, event) values (new_id, actor_id, 'requested');
  return new_id;
end;
$$;

-- The old direct request endpoint cannot omit participant acknowledgments.
create or replace function private.request_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text)
returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'Reload the booking form and complete the participant acknowledgments.' using errcode='22023'; end $$;
create or replace function public.request_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text)
returns uuid language plpgsql security invoker set search_path='' as $$
begin raise exception 'Reload the booking form and complete the participant acknowledgments.' using errcode='22023'; end $$;
revoke all on function private.request_booking(uuid,timestamptz,text) from public,anon,authenticated,service_role;

create or replace function private.list_booking_slots(p_listing_id uuid, p_from timestamptz, p_until timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz, price_cents integer, currency text)
language plpgsql stable security definer set search_path = '' as $$
declare item public.listings%rowtype; rules jsonb;
begin
  if p_from is null or p_until is null or p_until <= p_from or p_until - p_from > interval '31 days' then
    raise exception 'Choose a calendar range of at most 31 days.' using errcode = '22023';
  end if;
  if not exists (select 1 from private.booking_policy where singleton and enabled and payment_deadline_minutes >= 32) then return; end if;
  select * into item from public.listings where id = p_listing_id and status = 'published';
  if not found then return; end if;
  rules:=private.get_listing_participation_rules(item.id);
  if rules is null then return; end if;
  return query select s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', item.price_cents, item.currency
  from public.availability_windows a
  cross join lateral generate_series(a.starts_at, a.ends_at - item.duration_minutes * interval '1 minute',
    item.duration_minutes * interval '1 minute') s(slot_start)
  where a.listing_id = item.id and a.ends_at > p_from and a.starts_at < p_until
    and s.slot_start + item.duration_minutes * interval '1 minute' <= (rules->>'valid_until')::timestamptz
    and s.slot_start >= p_from and s.slot_start < p_until and s.slot_start > now() + interval '32 minutes'
    and not exists (select 1 from public.bookings b where b.host_id = item.host_id
      and private.effective_booking_status(b.status, b.request_expires_at, b.payment_deadline_at, b.starts_at, b.id)
        in ('requested', 'awaiting_payment', 'confirmed')
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
    and not exists (select 1 from public.host_calendar_blocks b where b.host_id = item.host_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + item.duration_minutes * interval '1 minute', '[)'))
  order by s.slot_start limit 2000;
end;
$$;

-- Checkout retains the existing host lock and financial policy calculation.
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
  if b.status not in ('confirmed','completed') and not private.booking_participation_current(b.id) then
    raise exception 'The activity review or participant rules changed. Make a new request after the activity is approved.' using errcode='55000'; end if;
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

-- Provider reconciliation remains active; a newly unsafe unsettled charge is
-- quarantined for refund review, while prior paid/refund paths are preserved.
create or replace function private.pay_apply_payment(p_event_key uuid,p_attempt_id uuid,p_session_id text,p_payment_intent_id text,
  p_charge_id text,p_amount_cents integer,p_currency text,p_state text,p_processor_fee_cents integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.payment_attempts%rowtype; b public.bookings%rowtype; problem text;
begin
  select * into a from private.payment_attempts where id=p_attempt_id;
  if not found then raise exception 'Unknown payment attempt.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72461,pg_catalog.hashtext(a.host_id::text));
  select * into b from public.bookings where id=a.booking_id for update;
  select * into a from private.payment_attempts where id=p_attempt_id for update;
  if p_state is null or p_state not in ('processing','paid','failed','expired') or p_session_id is null
    or not exists(select 1 from private.stripe_event_inbox where id=p_event_key and environment=a.environment)
    or (a.session_id is not null and a.session_id<>p_session_id)
    or (a.payment_intent_id is not null and p_payment_intent_id is not null and a.payment_intent_id<>p_payment_intent_id) then
    raise exception 'Payment evidence does not match the reserved attempt.' using errcode='22023'; end if;
  if a.state='paid' then
    -- A delayed failure/expiry event cannot undo a verified successful charge.
    if p_state='paid' and a.charge_id=p_charge_id and p_processor_fee_cents is not null and a.processor_fee_cents is null then
      update private.payment_attempts set processor_fee_cents=p_processor_fee_cents where id=a.id;
    end if;
    return jsonb_build_object('state',a.state,'booking_status',b.status);
  end if;
  if a.state='quarantined' then return jsonb_build_object('state',a.state,'booking_status',b.status); end if;
  if p_state='paid' then
    if p_payment_intent_id is null or p_charge_id is null or p_amount_cents is null or p_amount_cents<0 or p_currency is null then
      raise exception 'A successful canonical payment needs intent, charge, amount, and currency.' using errcode='22023'; end if;
    if p_amount_cents<>a.amount_cents or p_currency<>a.currency then problem:='Canonical amount or currency differs from the quote.';
    elsif b.status<>'awaiting_payment' or b.starts_at<=now() then problem:='Payment arrived after the booking ceased to be payable.';
    elsif not private.booking_participation_current(b.id) then
      problem:='The reviewed activity or participant rules changed after checkout; manual refund review required.';
    elsif exists(select 1 from private.payment_attempts where booking_id=b.id and id<>a.id and state in ('preparing','open','processing','paid','quarantined')) then
      problem:='Another payment attempt or exception exists for this booking.';
    elsif exists(select 1 from public.host_calendar_blocks busy where busy.host_id=b.host_id
      and tstzrange(busy.starts_at,busy.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then
      problem:='The host blocked this time after the booking expired; manual refund review required.';
    elsif exists(select 1 from public.bookings other where other.host_id=b.host_id and other.id<>b.id
      and other.status in ('requested','awaiting_payment','confirmed','completed')
      and tstzrange(other.starts_at,other.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then
      problem:='The host time is no longer available; manual refund review required.';
    end if;
    update private.payment_attempts set state=case when problem is null then 'paid' else 'quarantined' end,
      session_id=p_session_id,payment_intent_id=p_payment_intent_id,charge_id=p_charge_id,
      received_amount_cents=p_amount_cents,received_currency=p_currency,processor_fee_cents=p_processor_fee_cents,
      quarantine_reason=problem,paid_at=now(),updated_at=now() where id=a.id;
    if problem is null then
      update private.incentive_reservations set state='consumed' where attempt_id=a.id and state='reserved';
      update public.bookings set status='confirmed' where id=b.id;
    end if;
  elsif p_state='processing' then
    if a.state in ('preparing','open','processing') then
      update private.payment_attempts set state='processing',session_id=p_session_id,
        payment_intent_id=coalesce(payment_intent_id,p_payment_intent_id),updated_at=now() where id=a.id;
    end if;
  else
    -- Only a canonical terminal Session/Intent may reach this branch. A card
    -- decline while Checkout remains open is not terminal and must be retried.
    update private.payment_attempts set state=p_state,session_id=p_session_id,
      payment_intent_id=coalesce(payment_intent_id,p_payment_intent_id),updated_at=now() where id=a.id;
    update private.incentive_reservations set state='released' where attempt_id=a.id and state='reserved';
    if b.payment_deadline_at<=now() or b.starts_at<=now() then update public.bookings set status='expired' where id=b.id and status='awaiting_payment'; end if;
  end if;
  select state into p_state from private.payment_attempts where id=a.id;
  select status into b.status from public.bookings where id=b.id;
  return jsonb_build_object('state',p_state,'booking_status',b.status);
end $$;

-- Do not silently move a booking to a different person, activity or service date
-- after their age-on-date and participation rules were captured.
create function private.guard_booking_participation_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.booking_participation where booking_id=old.id) and
  row(new.listing_id,new.host_id,new.guest_id,new.starts_at,new.ends_at) is distinct from
  row(old.listing_id,old.host_id,old.guest_id,old.starts_at,old.ends_at) then
  raise exception 'Captured participant details require a new booking if the activity, participant or date changes.' using errcode='55000'; end if;
 return new;
end $$;
create trigger bookings_participation_identity_guard before update on public.bookings
 for each row execute function private.guard_booking_participation_identity();
create function private.guard_safety_review_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'Activity review history is append-only.' using errcode='55000'; end $$;
create trigger safety_review_history_immutable before update or delete on private.listing_safety_review_history
 for each row execute function private.guard_safety_review_history();

create function public.attest_adult_account(p_is_adult boolean,p_version text)
returns void language sql security invoker set search_path='' as $$ select private.attest_adult_account(p_is_adult,p_version); $$;
create function public.get_account_eligibility()
returns jsonb language sql security invoker set search_path='' as $$ select private.get_account_eligibility(); $$;
create function public.save_listing_safety_submission(p_listing_id uuid,p_expected_revision integer,p_submission jsonb)
returns integer language sql security invoker set search_path='' as $$ select private.save_listing_safety_submission(p_listing_id,p_expected_revision,p_submission); $$;
create function public.get_listing_safety_submission(p_listing_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_listing_safety_submission(p_listing_id); $$;
create function public.admin_review_listing_safety(p_listing_id uuid,p_expected_revision integer,p_decision text,
 p_review_note text,p_valid_until timestamptz,p_minor_without_guardian_approved boolean)
returns void language sql security invoker set search_path='' as $$ select private.admin_review_listing_safety(p_listing_id,p_expected_revision,p_decision,p_review_note,p_valid_until,p_minor_without_guardian_approved); $$;
create function public.get_listing_participation_rules(p_listing_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_listing_participation_rules(p_listing_id); $$;
create function public.request_booking(p_listing_id uuid,p_starts_at timestamptz,p_guest_message text,p_participant jsonb)
returns uuid language sql security invoker set search_path='' as $$ select private.request_booking(p_listing_id,p_starts_at,p_guest_message,p_participant); $$;
create function public.get_booking_participation(p_booking_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_booking_participation(p_booking_id); $$;

-- Revoke implicit PostgreSQL/Supabase legacy default EXECUTE grants. Only the
-- invoker wrappers and their individually authorized private entry points open.
revoke all on function private.adult_account_is_eligible(uuid),private.require_adult_user(),
 private.attest_adult_account(boolean,text),private.get_account_eligibility(),private.safety_submission_complete(uuid),
 private.approved_participation_rules(uuid),private.invalidate_safety_revision(uuid),private.get_listing_safety_submission(uuid),
 private.save_listing_safety_submission(uuid,integer,jsonb),private.admin_review_listing_safety(uuid,integer,text,text,timestamptz,boolean),
 private.guard_listing_participation(),private.invalidate_listing_safety_dependency(),private.get_listing_participation_rules(uuid),
 private.booking_participation_current(uuid),private.guard_booking_participation_snapshot(),private.require_booking_participation_snapshot(),
 private.guard_booking_acceptance_participation(),private.get_booking_participation(uuid),private.request_booking(uuid,timestamptz,text,jsonb),
 private.guard_booking_participation_identity(),private.guard_safety_review_history()
 from public,anon,authenticated,service_role;
revoke all on function public.attest_adult_account(boolean,text),public.get_account_eligibility(),
 public.save_listing_safety_submission(uuid,integer,jsonb),public.get_listing_safety_submission(uuid),
 public.admin_review_listing_safety(uuid,integer,text,text,timestamptz,boolean),public.get_listing_participation_rules(uuid),
 public.request_booking(uuid,timestamptz,text,jsonb),public.get_booking_participation(uuid)
 from public,anon,authenticated,service_role;
grant execute on function private.attest_adult_account(boolean,text),private.get_account_eligibility(),
 private.save_listing_safety_submission(uuid,integer,jsonb),private.get_listing_safety_submission(uuid),
 private.admin_review_listing_safety(uuid,integer,text,text,timestamptz,boolean),private.request_booking(uuid,timestamptz,text,jsonb),
 private.get_booking_participation(uuid),public.attest_adult_account(boolean,text),public.get_account_eligibility(),
 public.save_listing_safety_submission(uuid,integer,jsonb),public.get_listing_safety_submission(uuid),
 public.admin_review_listing_safety(uuid,integer,text,text,timestamptz,boolean),public.request_booking(uuid,timestamptz,text,jsonb),
 public.get_booking_participation(uuid) to authenticated;
grant execute on function private.get_listing_participation_rules(uuid),public.get_listing_participation_rules(uuid) to anon,authenticated;


-- Host account creation is an entry command; account reads, webhook updates,
-- transfers, refunds and payout reconciliation keep their existing behavior.
create or replace function private.pay_prepare_account(p_host_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  perform private.financial_actor(p_host_id);
  if not exists(select 1 from public.profiles where id=p_host_id and is_host) then
    raise exception 'Host account required.' using errcode='42501'; end if;
  -- Dashboard and refresh share this lookup. Preserve existing connected account
  -- access without pretending an older host completed the new attestation.
  select to_jsonb(a) into result from private.stripe_accounts a
    where host_id=p_host_id and environment=p_environment and account_id is not null;
  if result is not null then return result; end if;
  if not private.adult_account_is_eligible(p_host_id) then
    raise exception 'Confirm that you are at least 18 before creating a host payment account.' using errcode='42501'; end if;
  insert into private.stripe_accounts(host_id,environment) values(p_host_id,p_environment) on conflict(host_id,environment) do nothing;
  select to_jsonb(a) into result from private.stripe_accounts a where host_id=p_host_id and environment=p_environment;
  return result;
end $$;

commit;
