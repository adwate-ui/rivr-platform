-- Selfie liveness and face match, the 18+ gate and duplicate detection (#5; scope-v1 module 1).
-- The selfie comes first (docs/decisions/0030): the vendor checks it is a live person and that no
-- other member of the venue has the same face, and it is kept in the private kyc bucket as the
-- member's KYC photo. DigiLocker's photo is then matched against it while DigiLocker's short-lived
-- link still works, so no document photo is ever stored. Under 18, or a PAN, Aadhaar reference or
-- face another member already holds, is refused: private.is_kyc_complete stays false, and the member
-- never reaches a seat.

alter table public.kyc_record
  add column photo_path text,
  add column liveness_score smallint check (liveness_score between 0 and 100),
  add column face_match_score smallint check (face_match_score between 0 and 100),
  -- The vendor's stable reference for the Aadhaar number (a token, never the number itself).
  add column aadhaar_reference text,
  add column refusal text check (refusal in ('under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar')),
  drop constraint kyc_record_status_check,
  add constraint kyc_record_status_check
    check (status in ('started', 'needs_pan', 'needs_review', 'verified', 'refused')),
  add constraint kyc_record_refused_with_reason check ((status = 'refused') = (refusal is not null)),
  -- The one KYC photo: <venue_id>/<member_id>/selfie.jpg in the kyc bucket.
  add constraint kyc_record_photo_is_the_selfie check (photo_path = venue_id::text || '/' || member_id::text || '/selfie.jpg'),
  add constraint kyc_record_verified_with_photo check (status <> 'verified' or photo_path is not null);

comment on column public.kyc_record.status is
  'started, needs_pan, needs_review (staff finish it), verified, or refused (under 18 or a duplicate identity; see refusal).';

-- Duplicate lookups, and however two checks race, never two verified members of a venue with one
-- PAN or one Aadhaar.
create index kyc_record_pan_idx on public.kyc_record (venue_id, pan) where pan is not null;
create index kyc_record_aadhaar_reference_idx on public.kyc_record (venue_id, aadhaar_reference) where aadhaar_reference is not null;
create unique index kyc_record_verified_pan_key on public.kyc_record (venue_id, pan) where status = 'verified';
create unique index kyc_record_verified_aadhaar_key on public.kyc_record (venue_id, aadhaar_reference) where status = 'verified';

-- The audit trail now also records why a check was refused.
create or replace function private.audit_kyc_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.kyc_record := coalesce(new, old);
  safe text[] := array['id', 'member_id', 'status', 'method', 'refusal', 'vendor_reference', 'verified_at'];
begin
  perform private.audit(
    changed.venue_id, lower(tg_op), 'kyc_record', changed.id::text,
    case when tg_op <> 'INSERT' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e (k, v) where k = any (safe)) end,
    case when tg_op <> 'DELETE' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e (k, v) where k = any (safe)) end
  );
  return null;
end;
$$;

-- Why a member's identity cannot pass, from what their record holds now, or null: under 18 on the
-- venue's calendar, or a PAN or Aadhaar reference another member of the venue already holds, whatever
-- that member's own check says.
create function private.kyc_refusal(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when k.date_of_birth > (now() at time zone v.time_zone)::date - interval '18 years' then 'under_18'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.pan = k.pan) then 'duplicate_pan'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.aadhaar_reference = k.aadhaar_reference)
      then 'duplicate_aadhaar'
  end
  from public.kyc_record k join public.venue v on v.id = k.venue_id
  where k.member_id = p_member_id;
$$;

-- Moves a check on to the status asked for, unless the gate refuses it. Verifying stamps the time
-- and tells the rest of the system (kyc.completed, once per member).
create function private.settle_kyc(p_member_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refusal text := private.kyc_refusal(p_member_id);
  v_record public.kyc_record;
begin
  update public.kyc_record
  set status = case when v_refusal is null then p_status else 'refused' end,
      refusal = v_refusal,
      verified_at = case when v_refusal is null and p_status = 'verified' then now() end
  where member_id = p_member_id
  returning * into v_record;
  if v_record.status = 'verified' then
    perform private.emit(v_record.venue_id, 'kyc.completed', jsonb_build_object('member_id', p_member_id),
                         'kyc.completed:' || p_member_id);
  end if;
  return v_record.status;
end;
$$;

-- The selfie passed the vendor's liveness check and is stored as the KYC photo. A face the vendor
-- already holds for another member is refused at once. Once, before DigiLocker: the photo DigiLocker's
-- is matched against is never replaced.
create function public.record_kyc_selfie(p_member_id uuid, p_liveness_score integer, p_same_face_as uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_duplicate boolean := p_same_face_as is not null and p_same_face_as <> p_member_id;
  v_status text;
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record k
  set photo_path = k.venue_id::text || '/' || k.member_id::text || '/selfie.jpg', liveness_score = p_liveness_score,
      status = case when v_is_duplicate then 'refused' else k.status end,
      refusal = case when v_is_duplicate then 'duplicate_face' end
  where k.member_id = p_member_id and k.status = 'started' and k.digilocker_session_id is null and k.photo_path is null
  returning k.status into v_status;
  return v_status;
end;
$$;

-- A DigiLocker hand-off began, once the selfie is in. Refused and finished checks never restart.
create or replace function public.record_kyc_started(p_member_id uuid, p_session_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set status = 'started', method = 'digilocker', digilocker_session_id = p_session_id
  where member_id = p_member_id and status in ('started', 'needs_pan') and photo_path is not null;
$$;

-- DigiLocker returned a record: the selfie is matched against its photo, and its name against the
-- member's. Either one different means someone else's documents: the check waits for staff and keeps
-- only the vendor reference, never that person's identity. Without a PAN it waits for one. Then the
-- gate: under 18, or a PAN or Aadhaar another member holds, is refused.
drop function public.record_kyc_digilocker(uuid, date, text, text, text, text, boolean);

create function public.record_kyc_digilocker(
  p_member_id uuid, p_date_of_birth date, p_masked_aadhaar text, p_aadhaar_reference text, p_pan text, p_address text,
  p_vendor_reference text, p_name_matches boolean, p_face_matches boolean, p_face_match_score integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_same_person boolean := coalesce(p_name_matches and p_face_matches, false);
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set date_of_birth = case when v_same_person then p_date_of_birth end,
      masked_aadhaar = case when v_same_person then p_masked_aadhaar end,
      aadhaar_reference = case when v_same_person then p_aadhaar_reference end,
      pan = case when v_same_person then p_pan end,
      address = case when v_same_person then p_address end,
      vendor_reference = p_vendor_reference,
      face_match_score = p_face_match_score
  where member_id = p_member_id and status = 'started' and photo_path is not null;
  if not found then return null; end if;
  return private.settle_kyc(p_member_id, case when not v_same_person then 'needs_review' when p_pan is null then 'needs_pan' else 'verified' end);
end;
$$;

-- A PAN the vendor found valid and matching the member's name. After DigiLocker (which gave the date
-- of birth and the photo the selfie matched) that completes the check; a PAN alone waits for staff
-- (#198). Then the gate, as for DigiLocker.
create or replace function public.record_kyc_pan(p_member_id uuid, p_pan text, p_date_of_birth date, p_vendor_reference text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method text;
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set pan = p_pan, date_of_birth = coalesce(date_of_birth, p_date_of_birth), vendor_reference = p_vendor_reference
  where member_id = p_member_id and status = 'needs_pan'
  returning method into v_method;
  if v_method is null then return null; end if;
  return private.settle_kyc(p_member_id, case when v_method = 'digilocker' then 'verified' else 'needs_review' end);
end;
$$;

-- Whether a member may take a seat or buy in (lanes A and B): verified, with a KYC photo, and 18 or
-- over today on the venue's calendar. Refused checks, duplicates among them, never pass.
create function private.is_kyc_complete(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select k.status = 'verified' and k.photo_path is not null
       and k.date_of_birth <= (now() at time zone v.time_zone)::date - interval '18 years'
    from public.kyc_record k join public.venue v on v.id = k.venue_id
    where k.member_id = p_member_id
  ), false);
$$;

grant execute on function public.record_kyc_selfie(uuid, integer, uuid),
  public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, boolean, integer)
  to service_role;
