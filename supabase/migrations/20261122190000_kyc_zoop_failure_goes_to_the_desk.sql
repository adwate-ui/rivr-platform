-- When Zoop does not verify a member, their check goes to the desk, as it does while the venue checks identity at the club
-- (the owner, 16 Nov 2026; decision 0678). record_kyc_digilocker_failed sent the member to a PAN check (needs_pan), whose
-- PAN alone then waited for a KYC reviewer while the member was kept out of the app. It now marks the check to wait for the
-- desk instead: still started, with at_club_from, so the member is let into the app, may join a waitlist, and the floor
-- checks their ID in person on the first visit (decisions 0502, 0503). The DigiLocker session ends with it, and so does
-- anything delivered for it (20261122170000's trigger).
--
-- Why the check is at the desk is kept with it, and the desk is told (the security review of #1039): above all when the
-- app's face check did not confirm the member against their Aadhaar photo, the one sign Zoop gives of someone using another
-- person's documents. A later, weaker reason never replaces that one; the reason goes once the check is decided.

alter table public.kyc_record add column desk_reason text
  check (desk_reason in ('face_unconfirmed', 'no_date_of_birth', 'digilocker_failed', 'not_started'));
insert into private.member_export_column (table_name, column_name, kind) values ('kyc_record', 'desk_reason', 'note');

-- A decided check (verified, refused, waiting for review, erased) is no longer at the desk: its reason goes.
create function private.kyc_desk_reason_ends()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.desk_reason := null;
  return new;
end;
$$;
create trigger kyc_record_desk_reason_ends before update of status on public.kyc_record
  for each row when (new.status <> 'started' and old.desk_reason is not null)
  execute function private.kyc_desk_reason_ends();
revoke execute on function private.kyc_desk_reason_ends() from public, anon, authenticated;

-- True when the check went to the desk. `p_reason`: face_unconfirmed (with Zoop's face match score, when it gave one),
-- no_date_of_birth, digilocker_failed or not_started.
drop function public.record_kyc_digilocker_failed(uuid);
create function public.record_kyc_digilocker_failed(
  p_member_id uuid, p_reason text default 'digilocker_failed', p_face_match_score integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set digilocker_session_id = null, at_club_from = coalesce(at_club_from, now()),
      desk_reason = case when desk_reason = 'face_unconfirmed' then desk_reason else p_reason end,
      face_match_score = case when p_reason = 'face_unconfirmed' then coalesce(p_face_match_score::smallint, face_match_score)
                              else face_match_score end
  where member_id = p_member_id and status = 'started';
  return found;
end;
$$;
revoke execute on function public.record_kyc_digilocker_failed(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_kyc_digilocker_failed(uuid, text, integer) to service_role;

-- As 20261110655000_kyc_documents.sql made them, with why each check is at the desk, so the desk is warned.
drop function public.kyc_in_person_candidates(uuid, text);
drop function private.kyc_in_person_candidates(uuid, text);
drop function public.kyc_due_tonight(uuid);
drop function private.kyc_due_tonight(uuid);
create function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[],
  desk_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status,
         case when k.at_club_from is not null then
           case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                then m.venue_id || '/' || m.id || '/photo.jpg'
                else k.photo_path end
         end,
         array(select d.kind from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         array(select d.retake_reason from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         k.desk_reason
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and m.erased_at is null
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now()))
         or exists (select 1 from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null))
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^([0-9]{4}|[0-9]{10})$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;

create function public.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[],
  desk_reason text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_in_person_candidates(p_venue_id, p_search);
$$;

create function private.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[],
  desk_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status,
         case when k.at_club_from is not null then
           case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                then m.venue_id || '/' || m.id || '/photo.jpg'
                else k.photo_path end
         end,
         array(select d.kind from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         array(select d.retake_reason from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         k.desk_reason
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and m.erased_at is null
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now()))
         or exists (select 1 from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null))
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and (private.current_visit(m.id) is not null
         or exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.left_at is null and e.seated_at is null))
  order by coalesce(k.at_club_from, k.created_at, m.created_at), m.full_name
  limit 50;
$$;

create function public.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[],
  desk_reason text)
language sql
stable
set search_path = ''
as $$ select * from private.kyc_due_tonight(p_venue_id); $$;

revoke execute on function private.kyc_in_person_candidates(uuid, text), public.kyc_in_person_candidates(uuid, text) from public, anon;
grant execute on function private.kyc_in_person_candidates(uuid, text), public.kyc_in_person_candidates(uuid, text) to authenticated;
revoke execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) from public, anon;
grant execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) to authenticated;

-- Checks held for a PAN check after a DigiLocker that failed wait for the desk instead, as a new failure now does, keeping
-- nothing from the attempt, as take_kyc_at_the_club does for them while the venue checks at the club (none on production
-- on 16 Nov 2026; staging's are test members).
update public.kyc_record
set status = 'started', method = 'digilocker', at_club_from = coalesce(at_club_from, now()), refusal = null, verified_at = null,
    date_of_birth = null, masked_aadhaar = null, pan = null, address = null, aadhaar_reference = null, identity_key = null,
    aadhaar_name = null, vendor_reference = null, liveness_score = null, face_match_score = null, digilocker_session_id = null,
    vendor_failure = null, vendor_failed_at = null, pan_recheck = null, pan_rechecked_at = null, desk_reason = 'digilocker_failed'
where status = 'needs_pan';
