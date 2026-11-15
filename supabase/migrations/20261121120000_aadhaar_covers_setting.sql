-- The Aadhaar bars become a venue setting, off (the owner, 15 Nov night, decision 0663): "Remove the black box requirement
-- for staff (temp issue) but slowing down staff." While kyc.aadhaar_covers is off, the desk photographs the Aadhaar front
-- without the bars over its first eight digits and QR code, and gives no word that they are hidden: the photo is kept
-- unmasked, for super admins alone, as every PAN and Aadhaar photo is (private.authorize_kyc_image, unchanged). Turned on,
-- the bars and the word come back with no deploy. Only a super admin changes it, with a reason, and the owner is alerted.

insert into public.setting_key (key, description, scope, value_schema) values
  ('kyc.aadhaar_covers',
   'Aadhaar bars at the desk: staff photograph the Aadhaar front under bars that hide its first eight digits and QR code, and say they do. Off, the photo is kept unmasked, for super admins alone. None set is off. Only a super admin changes it, with a reason.',
   'venue',
   '{"type":"object","properties":{"enabled":{"type":"boolean"}},"required":["enabled"],"additionalProperties":false}');

-- As 20261117210000_card_social_cage_and_older_screens_removed.sql, with kyc.aadhaar_covers a control setting too.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap', 'kyc.aadhaar_covers'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap', 'kyc.aadhaar_covers'))
  execute function private.guard_control_settings();

-- Whether the venue's desk puts the bars on the Aadhaar front now. None set is off.
create function private.kyc_aadhaar_covers(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'kyc.aadhaar_covers', '', now()) ->> 'enabled')::boolean, false);
$$;

-- The same, for the staff who photograph the documents at that venue; false for anyone else.
create function public.kyc_aadhaar_covers(p_venue_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.has_permission(p_venue_id, 'kyc.in_person') and private.kyc_aadhaar_covers(p_venue_id); $$;
revoke execute on function private.kyc_aadhaar_covers(uuid), public.kyc_aadhaar_covers(uuid) from public, anon;
grant execute on function private.kyc_aadhaar_covers(uuid), public.kyc_aadhaar_covers(uuid) to authenticated;

-- An Aadhaar photo taken while the bars were not asked for has no one's word on them; a PAN never has.
alter table public.kyc_document drop constraint kyc_document_check;
alter table public.kyc_document add constraint kyc_document_covers_only_on_aadhaar
  check (kind = 'aadhaar_front' or covers_confirmed_by_staff_id is null);

-- As 20261110655000_kyc_documents.sql made it, the word on the bars asked for, and kept, only while the venue asks for them.
create or replace function private.check_kyc_in_person(p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text,
  p_pan text, p_consent boolean,
  p_pan_photo_path text default null, p_aadhaar_photo_path text default null, p_covers_confirmed boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_staff_id uuid;
  v_status text;
  v_covers boolean;
begin
  -- One check of a member at a time: a second waits here, then finds the first decided.
  select m.venue_id into v_venue_id from public.member m where m.id = p_member_id for no key update;
  perform private.assert_may_check_in_person(p_member_id);
  v_staff_id := private.current_staff_id(v_venue_id);
  v_covers := private.kyc_aadhaar_covers(v_venue_id);
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
  if not (private.kyc_document_is_stored(p_member_id, v_venue_id, 'pan', p_pan_photo_path)
          and private.kyc_document_is_stored(p_member_id, v_venue_id, 'aadhaar_front', p_aadhaar_photo_path)) then
    raise exception 'Photograph the PAN and the Aadhaar first' using errcode = 'RVPHT';
  end if;
  if v_covers and p_covers_confirmed is not true then
    raise exception 'Say the bars hide the first eight digits and the QR code' using errcode = '22023';
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
  insert into public.kyc_document (venue_id, member_id, kind, path, taken_by_staff_id, covers_confirmed_by_staff_id)
  values (v_venue_id, p_member_id, 'pan', p_pan_photo_path, v_staff_id, null),
         (v_venue_id, p_member_id, 'aadhaar_front', p_aadhaar_photo_path, v_staff_id, case when v_covers then v_staff_id end)
  on conflict (member_id, kind) do update
  set path = excluded.path, taken_at = now(), taken_by_staff_id = excluded.taken_by_staff_id, covers_confirmed_by_staff_id = excluded.covers_confirmed_by_staff_id,
      retake_asked_at = null, retake_asked_by_staff_id = null, retake_reason = null;
  v_status := private.settle_kyc(p_member_id, 'verified', false);
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id, method)
  values (v_venue_id, p_member_id, 'approved', 'Checked in person against the original documents at the club', true, true,
          v_status, v_staff_id, 'manual');
  return v_status;
end;
$$;

-- As 20261110655000_kyc_documents.sql made it, with the bars as the check takes them.
create or replace function private.record_kyc_document_retake(p_member_id uuid, p_kind text, p_path text, p_covers_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.assert_may_retake_kyc_document(p_member_id, p_kind);
  v_staff_id uuid := private.current_staff_id(v_venue_id);
  v_covers boolean := p_kind = 'aadhaar_front' and private.kyc_aadhaar_covers(v_venue_id);
begin
  if not private.kyc_document_is_stored(p_member_id, v_venue_id, p_kind, p_path) then
    raise exception 'Take the photo first' using errcode = 'RVPHT';
  end if;
  if v_covers and p_covers_confirmed is not true then
    raise exception 'Say the bars hide the first eight digits and the QR code' using errcode = '22023';
  end if;
  update public.kyc_document
  set path = p_path, taken_at = now(), taken_by_staff_id = v_staff_id, covers_confirmed_by_staff_id = case when v_covers then v_staff_id end,
      retake_asked_at = null, retake_asked_by_staff_id = null, retake_reason = null
  where member_id = p_member_id and kind = p_kind;
end;
$$;
