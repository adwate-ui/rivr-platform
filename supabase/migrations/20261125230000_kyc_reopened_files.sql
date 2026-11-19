-- A reopened desk check's files go at once (#931, decision 0583's follow-up). Reopening a verified check done in person cleared
-- what the desk entered, but its face photo and two document photos stayed in the member's kyc folder until their next desk
-- check, or for good if they never came back. The reopening now lists those paths; the console then asks the
-- kyc-reopened-files Edge Function, which reads them as the super admin (so the reopening itself authorises it) and removes
-- them from Storage with the service role, then has them forgotten.

-- The files a reopening listed to go; private, read and forgotten only through the two functions below.
create table private.kyc_reopened_file (
  path text primary key,
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  reopened_at timestamptz not null default now(),
  -- Only a file in the member's own folder, so what the Edge Function removes can never be another's (security review).
  constraint kyc_reopened_file_in_folder check (starts_with(path, venue_id::text || '/' || member_id::text || '/') and position('..' in path) = 0)
);
create index kyc_reopened_file_member_idx on private.kyc_reopened_file (member_id);
alter table private.kyc_reopened_file enable row level security;
revoke all on private.kyc_reopened_file from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.reopen_kyc_check(p_member_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_record public.kyc_record;
  v_is_held_by_vendor boolean;
  v_is_verified_in_person boolean;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'members.override_features')
     or private.is_own_kyc_check(p_member_id) is true then
    raise exception 'Only a super admin reopens a check, never their own' using errcode = '42501';
  end if;
  v_is_held_by_vendor := v_record.method in ('digilocker', 'pan')
    and (v_record.status = 'needs_review'
         or (v_record.status = 'refused' and v_record.refusal in ('duplicate_aadhaar', 'duplicate_pan')))
    and private.kyc_at_the_club(v_record.venue_id, now());
  v_is_verified_in_person := v_record.status = 'verified' and v_record.method = 'manual';
  -- Otherwise only a duplicate done in person: under 18 and a reviewer's rejection stand.
  if not v_is_held_by_vendor and not v_is_verified_in_person
     and (v_record.status <> 'refused' or v_record.method <> 'manual' or v_record.refusal not in ('duplicate_aadhaar', 'duplicate_pan')) then
    raise exception 'Only a check done in person is reopened, or one the vendor held while the club checks identity'
      using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[0-9०-९]' then
    raise exception 'A reopening needs its reason, in words, with no digits' using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, null, p_member_id);
  -- The audit log keeps the reason with the change (private.audit reads rivr.audit_reason).
  perform set_config('rivr.audit_reason', trim(p_reason), true);
  if v_is_held_by_vendor then
    update public.kyc_record
    -- Stamped with the day their check began, not today: they registered then, so the bonus of that day is theirs.
    set status = 'started', refusal = null, verified_at = null, at_club_from = coalesce(at_club_from, created_at),
        date_of_birth = null, masked_aadhaar = null, pan = null, address = null, aadhaar_reference = null, identity_key = null,
        aadhaar_name = null, vendor_reference = null, liveness_score = null, face_match_score = null, same_face_as = null,
        digilocker_session_id = null, vendor_failure = null, vendor_failed_at = null, pan_recheck = null, pan_rechecked_at = null
    where id = v_record.id;
  elsif v_is_verified_in_person then
    -- What the desk entered may be someone else's: none of it stays. Its three files, the desk's photo and the two document
    -- photos, are listed to go from Storage at once (#931): the console asks the kyc-reopened-files Edge Function next. While
    -- the club checks identity at the desk they stay let into the app, as one whose selfie came in the day their check began.
    insert into private.kyc_reopened_file (path, venue_id, member_id)
    select f.path, v_record.venue_id, p_member_id
    from (select v_record.photo_path as path union all select d.path from public.kyc_document d where d.member_id = p_member_id) f
    where f.path is not null and starts_with(f.path, v_record.venue_id::text || '/' || p_member_id::text || '/') and position('..' in f.path) = 0
    on conflict (path) do nothing;
    update public.kyc_record
    set status = 'started', refusal = null, verified_at = null, date_of_birth = null, masked_aadhaar = null, pan = null,
        photo_path = null, pan_recheck = null, pan_rechecked_at = null,
        at_club_from = case when private.kyc_at_the_club(v_record.venue_id, now()) then coalesce(at_club_from, created_at) else at_club_from end
    where id = v_record.id;
    delete from public.kyc_document d where d.member_id = p_member_id;
  else
    -- The photo the desk took goes with the refusal, as the documents' would, and what the desk typed with it, which is
    -- another person's: the check that follows takes its own.
    update public.kyc_record
    set status = 'started', refusal = null, verified_at = null, photo_path = null, date_of_birth = null, masked_aadhaar = null, pan = null
    where id = v_record.id;
  end if;
  perform set_config('rivr.audit_reason', '', true);
end;
$function$;

-- The paths a reopening listed for this member, for a super admin of their venue (who alone reopens); refused otherwise.
create function private.reopened_kyc_files(p_member_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue uuid := (select m.venue_id from public.member m where m.id = p_member_id);
begin
  if v_venue is null or not private.has_permission(v_venue, 'members.override_features') then
    raise exception 'Only a super admin of the member''s venue removes a reopened check''s files' using errcode = '42501';
  end if;
  -- Nothing is removed while the venue or the member is frozen; the files stay listed (security review).
  perform private.assert_writable(v_venue, null, p_member_id);
  return coalesce((select array_agg(f.path order by f.path) from private.kyc_reopened_file f where f.member_id = p_member_id), '{}');
end;
$$;

-- Forgets the paths Storage removed; the same rule as reading them. Returns how many it forgot.
create function private.forget_reopened_kyc_files(p_member_id uuid, p_paths text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.reopened_kyc_files(p_member_id);
  delete from private.kyc_reopened_file f where f.member_id = p_member_id and f.path = any (p_paths);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.reopened_kyc_files(uuid), private.forget_reopened_kyc_files(uuid, text[]) from public, anon;
grant execute on function private.reopened_kyc_files(uuid), private.forget_reopened_kyc_files(uuid, text[]) to authenticated;

create function public.reopened_kyc_files(p_member_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select private.reopened_kyc_files(p_member_id);
$$;
create function public.forget_reopened_kyc_files(p_member_id uuid, p_paths text[])
returns integer
language sql
set search_path = ''
as $$
  select private.forget_reopened_kyc_files(p_member_id, p_paths);
$$;
revoke all on function public.reopened_kyc_files(uuid), public.forget_reopened_kyc_files(uuid, text[]) from public, anon;
grant execute on function public.reopened_kyc_files(uuid), public.forget_reopened_kyc_files(uuid, text[]) to authenticated;
