-- Three fixes from the review of the redesign's last part (pull request 1016).

-- A TV still on the display build before this release reads `mode` and `rotation` from my_tv_screen, which
-- 20261120210100 replaced with `boards` and `seconds`: such a TV failed its next read and showed stale boards until it
-- was reloaded. Both come back as the last two columns, as they were, for this release only; a later release drops them
-- once every TV runs the build that reads `boards`.
drop function public.my_tv_screen();
drop function private.my_tv_screen();
create function private.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[], mode public.tv_mode, rotation public.tv_mode[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, b.boards,
         array(select private.tv_board_seconds(d.venue_id, t.board) from unnest(b.boards) with ordinality as t (board, n) order by t.n),
         s.mode, s.rotation
  from public.device d
  join public.tv_screen s on s.device_id = d.id
  cross join lateral (select private.tv_boards(d.venue_id, s.mode, s.rotation) as boards) b
  where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;
create function public.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[], mode public.tv_mode, rotation public.tv_mode[])
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tv_screen(); $$;
revoke execute on function private.my_tv_screen(), public.my_tv_screen() from public, anon;
grant execute on function private.my_tv_screen(), public.my_tv_screen() to authenticated;

-- A refused duplicate done in person, reopened, keeps nothing the desk typed for it: its PAN, Aadhaar digits and date of
-- birth are another person's, which the member would otherwise read on their own record. As 20261120500000 left it, with
-- those three cleared in its last branch as the verified branch clears them.
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
    -- The photo the desk took goes with the refusal, as the documents' would, and what the desk typed with it, which is
    -- another person's: the check that follows takes its own.
    update public.kyc_record
    set status = 'started', refusal = null, verified_at = null, photo_path = null, date_of_birth = null, masked_aadhaar = null, pan = null
    where id = v_record.id;
  end if;
  perform set_config('rivr.audit_reason', '', true);
end;
$$;

-- Players see no counts (the owner, 8 and 15 Nov; redesign RD-20). How many wait for each game was still readable by
-- anyone signed out (20261019090200), though nothing reads it: the website shows no count. It goes.
drop view public.public_waitlist_length;
drop function private.public_waitlist_length_rows();
