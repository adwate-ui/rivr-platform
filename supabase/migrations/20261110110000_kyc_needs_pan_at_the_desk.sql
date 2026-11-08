-- Members held at "Needs a PAN" reach the desk (audit of 8 Nov 2026, F-010). Their check waits for a PAN check that
-- Cashfree no longer runs (owner, 5 Nov), and every desk path took only a check still 'started', so they could never be
-- verified. Now, while the club checks identity at the desk, the desk finds them and checks them in person, as any started
-- check, and a member's selfie in the app moves their check back to 'started', let in by it as any other member, with what
-- DigiLocker had kept cleared (the desk records it afresh). With the switch off, the app's own PAN step stands, as before.

-- As 20261103000200_kyc_in_person_at_the_desk.sql made it, a check waiting for its PAN taken in person too while the club
-- checks identity at the desk.
create or replace function private.assert_may_check_in_person(p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_status text := (select k.status from public.kyc_record k where k.member_id = p_member_id);
begin
  if v_venue_id is null
     or not (private.has_permission(v_venue_id, 'kyc.in_person') or private.has_permission(v_venue_id, 'kyc.review'))
     or private.is_own_kyc_check(p_member_id) or private.changed_member(p_member_id) then
    raise exception 'Only staff who check members in person do, never for themselves or a member they added or changed'
      using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup'::public.killable_feature, p_member_id);
  if v_status is not null and v_status <> 'started'
     and not (v_status = 'needs_pan' and private.kyc_at_the_club(v_venue_id, now())) then
    raise exception 'This member''s check is decided or waits for review' using errcode = 'RVKYC';
  end if;
end;
$$;

-- As 20261108110000_kyc_at_the_club.sql made it, a check waiting for its PAN completed at the desk too.
create or replace function private.check_kyc_in_person(p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text,
  p_pan text, p_consent boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_staff_id uuid;
  v_status text;
begin
  -- One check of a member at a time: a second waits here, then finds the first decided.
  select m.venue_id into v_venue_id from public.member m where m.id = p_member_id for no key update;
  perform private.assert_may_check_in_person(p_member_id);
  v_staff_id := private.current_staff_id(v_venue_id);
  if p_consent is not true or p_date_of_birth is null or p_date_of_birth not between '1900-01-01' and current_date
     or coalesce(p_aadhaar_last4, '') !~ '^[0-9]{4}$'
     or upper(trim(coalesce(p_pan, ''))) !~ '^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$' then
    raise exception 'A check in person needs consent, the date of birth, the last four Aadhaar digits and the PAN'
      using errcode = '22023';
  end if;
  -- This check's own photo, stored in the last ten minutes.
  if coalesce(p_photo_path, '') !~ ('^' || v_venue_id::text || '/' || p_member_id::text || '/in-person-[0-9a-f-]{36}\.jpg$')
     or not exists (select 1 from storage.objects o
                    where o.bucket_id = 'kyc' and o.name = p_photo_path and o.created_at > now() - interval '10 minutes') then
    raise exception 'Take the member''s photo first' using errcode = 'RVPHT';
  end if;
  insert into public.kyc_record (venue_id, member_id, status, method, photo_path, date_of_birth, masked_aadhaar, pan)
  values (v_venue_id, p_member_id, 'started', 'manual', p_photo_path, p_date_of_birth, 'XXXX XXXX ' || p_aadhaar_last4,
          upper(trim(p_pan)))
  on conflict (member_id) do update
  set status = 'started', method = 'manual', photo_path = excluded.photo_path, date_of_birth = excluded.date_of_birth,
      masked_aadhaar = excluded.masked_aadhaar, pan = excluded.pan, refusal = null, verified_at = null,
      aadhaar_name = null, aadhaar_reference = null, identity_key = null, address = null, vendor_reference = null,
      liveness_score = null, face_match_score = null, digilocker_session_id = null, pan_recheck = null, pan_rechecked_at = null
  where public.kyc_record.status in ('started', 'needs_pan');
  if not found then
    raise exception 'This member''s check is decided or waits for review' using errcode = 'RVKYC';
  end if;
  insert into public.consent (venue_id, member_id, purpose, recorded_by_staff_id)
  values (v_venue_id, p_member_id, 'kyc_verification', v_staff_id)
  on conflict (member_id, purpose) where withdrawn_at is null do nothing;
  v_status := private.settle_kyc(p_member_id, 'verified', false);
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id, method)
  values (v_venue_id, p_member_id, 'approved', 'Checked in person against the original documents at the club', true, true,
          v_status, v_staff_id, 'manual');
  return v_status;
end;
$$;

-- As 20261110000000_member_phones.sql made it, listing checks waiting for their PAN with the started ones.
create or replace function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text)
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
         end
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now())))
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

-- As 20261108110000_kyc_at_the_club.sql made it: a check waiting for its PAN starts again from the member's selfie, with
-- what DigiLocker kept cleared, as reopening a vendor-held check does, but for a face its selfie matched, which the desk's
-- gate still refuses.
create or replace function private.take_kyc_at_the_club()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null then
    raise exception 'Only a member takes a selfie' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup', v_member_id);
  if not private.kyc_at_the_club(v_venue_id, now())
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = v_venue_id || '/' || v_member_id || '/photo.jpg') then
    return false;
  end if;
  update public.kyc_record
  set status = 'started', refusal = null, verified_at = null, date_of_birth = null, masked_aadhaar = null, pan = null,
      address = null, aadhaar_reference = null, identity_key = null, aadhaar_name = null, vendor_reference = null,
      liveness_score = null, face_match_score = null, digilocker_session_id = null, vendor_failure = null,
      vendor_failed_at = null, pan_recheck = null, pan_rechecked_at = null
  where member_id = v_member_id and status = 'needs_pan';
  insert into public.kyc_record (venue_id, member_id, at_club_from) values (v_venue_id, v_member_id, now())
  on conflict (member_id) do update set at_club_from = coalesce(public.kyc_record.at_club_from, excluded.at_club_from)
  where public.kyc_record.status = 'started';
  return exists (select 1 from public.kyc_record k where k.member_id = v_member_id and k.status = 'started' and k.at_club_from is not null);
end;
$$;

-- Who the desk should check tonight (audit F-091): members in the room, or on a list, whose check is not done, the longest
-- waiting first; the same rows as the search, for the same staff. KYC review lists them under its search, so the desk need
-- not know the name.
create function private.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text)
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
         end
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and m.erased_at is null
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now())))
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and (private.current_visit(m.id) is not null
         or exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.left_at is null and e.seated_at is null))
  order by coalesce(k.at_club_from, k.created_at, m.created_at), m.full_name
  limit 50;
$$;

create function public.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text)
language sql
stable
set search_path = ''
as $$ select * from private.kyc_due_tonight(p_venue_id); $$;

revoke execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) from public, anon;
grant execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) to authenticated;
