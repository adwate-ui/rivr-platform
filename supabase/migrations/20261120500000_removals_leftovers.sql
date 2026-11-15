-- What the removals left in the database with no user (issue 1012; decision 0650).

-- The owner dashboard went with the removals (20261117210000), and nothing listens on `owner:<venue>` now: its eight
-- signals, among them one for every ledger insert, their function, and the policy that let a dashboard hear them.
drop trigger hand_owner_signal on public.hand;
drop trigger alert_owner_signal on public.alert;
drop trigger ledger_entry_owner_signal on public.ledger_entry;
drop trigger game_table_owner_signal on public.game_table;
drop trigger seat_session_owner_signal on public.seat_session;
drop trigger seat_session_owner_signal_end on public.seat_session;
drop trigger visit_owner_signal on public.visit;
drop trigger visit_owner_signal_close on public.visit;
drop function private.signal_owner_dashboard();
drop policy "a venue's owner dashboards hear its signals" on realtime.messages;

-- A purge in hand: as 20261021130000_practice_reset.sql made it, and now by the session's own role too, as the ledger's
-- guard asks (private.ledger_append_only). No function sets `rivr.purge` since the purge and the practice reset went; the
-- database's owner still may, in a session of their own, to remove a venue's rows by hand, and the guards that ask this
-- stand aside for that alone. `current_user` is postgres inside every security definer function, whoever called it, so
-- without the session's role a caller who got the setting set would have passed.
create or replace function private.purging(p_venue_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user = 'postgres' and session_user = 'postgres' and current_setting('rivr.purge', true) = 'on'
     and current_setting('rivr.purge_venue', true) = p_venue_id::text;
$$;

-- Reopening a refused duplicate done in person clears its photo's path too (the security review of the member's own selfie
-- read, 20261117220000): the member reads their own photo by that path, and the refused check's is not theirs to keep. As
-- 20261114194506_kyc_reopen_a_check_on_the_wrong_member.sql made it, with that one column more.
create or replace function private.reopen_kyc_check(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    -- What the desk entered may be someone else's: none of it stays, and the files go at the member's next check. While the
    -- club checks identity at the desk they stay let into the app, as one whose selfie came in the day their check began.
    update public.kyc_record
    set status = 'started', refusal = null, verified_at = null, date_of_birth = null, masked_aadhaar = null, pan = null,
        photo_path = null, pan_recheck = null, pan_rechecked_at = null,
        at_club_from = case when private.kyc_at_the_club(v_record.venue_id, now()) then coalesce(at_club_from, created_at) else at_club_from end
    where id = v_record.id;
    delete from public.kyc_document d where d.member_id = p_member_id;
  else
    -- The photo the desk took goes with the refusal, as the documents' would: the check that follows takes its own.
    update public.kyc_record set status = 'started', refusal = null, verified_at = null, photo_path = null where id = v_record.id;
  end if;
  perform set_config('rivr.audit_reason', '', true);
end;
$$;
