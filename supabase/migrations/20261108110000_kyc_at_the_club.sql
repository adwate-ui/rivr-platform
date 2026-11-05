-- Identity checked at the club (the owner, 5 Nov 2026; decision 0502). Cashfree's checks are not available, so a super
-- admin can switch the venue to this: a new member takes a selfie in the app, kept as their sign-up photo with no vendor
-- call, and is let into the app; staff check their Aadhaar and PAN in person on their first visit (the check in person,
-- 20261018092600_kyc_in_person.sql). Play still waits for that check: private.is_kyc_complete is unchanged. Switching it
-- off brings back the app's check for new members; those already let in keep the app and still verify at the desk.
-- While it is on, a check in person is final: it earns the verification bonus at once, at the amount that stood when
-- the member took their selfie (so pre-registering before launch keeps it), and its PAN recheck waits until the switch
-- is off, when Cashfree is live.

-- The switch: only a super admin changes it, with a reason, and the owner is alerted (private.guard_control_settings).
insert into public.setting_key (key, description, scope, value_schema) values
  ('kyc.at_the_club',
   'Identity checked at the club: a new member takes a selfie in the app and is let in, and staff check their Aadhaar and PAN in person on their first visit, which is final while this is on. Off, members check in the app. None set is off. Only a super admin changes it, with a reason.',
   'venue',
   '{"type":"object","properties":{"enabled":{"type":"boolean"}},"required":["enabled"],"additionalProperties":false}');

-- As before (20261104330000_points_daily_cap.sql), with kyc.at_the_club a control setting too.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club'))
  execute function private.guard_control_settings();

-- Whether the venue checks identity at the club at a moment.
create function private.kyc_at_the_club(p_venue_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'kyc.at_the_club', '', p_at) ->> 'enabled')::boolean, false);
$$;

-- When the member's selfie came in while the venue checked identity at the club: they are let into the app, and their
-- check waits for the desk. Null for everyone else.
alter table public.kyc_record add column at_club_from timestamptz;
insert into private.member_export_column (table_name, column_name, kind) values ('kyc_record', 'at_club_from', 'owed');
-- The member reads it beside the rest of their own check (the columns 20261018091500_kyc_selfie_and_gate.sql grants).
grant select (at_club_from) on public.kyc_record to authenticated;

-- Whether a venue checks identity at the club now: with no venue, the signed-in member's, for their app; with one, for its
-- KYC reviewers, whose console then offers Reopen on a check the vendor held. False for anyone else.
create function public.kyc_at_the_club(p_venue_id uuid default null)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_venue_id is null then coalesce(private.kyc_at_the_club(private.current_member_venue_id(), now()), false)
    else private.has_permission(p_venue_id, 'kyc.review') and private.kyc_at_the_club(p_venue_id, now())
  end;
$$;

-- Asked as the member by the kyc Edge Function once it has stored their selfie as their sign-up photo (photo.jpg): while
-- the venue checks identity at the club, their check is marked to wait for the desk. True once it is marked, now or
-- before; false while the switch is off, without the photo, or for a check that has moved on. Refusals: 42501 not a
-- member, RVKIL/RVFRZ/RVMBR sign-up switched off, the venue or the member frozen.
create function private.take_kyc_at_the_club()
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
  insert into public.kyc_record (venue_id, member_id, at_club_from) values (v_venue_id, v_member_id, now())
  on conflict (member_id) do update set at_club_from = coalesce(public.kyc_record.at_club_from, excluded.at_club_from)
  where public.kyc_record.status = 'started';
  return exists (select 1 from public.kyc_record k where k.member_id = v_member_id and k.status = 'started' and k.at_club_from is not null);
end;
$$;
create function public.take_kyc_at_the_club()
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.take_kyc_at_the_club(); $$;

revoke execute on function private.kyc_at_the_club(uuid, timestamptz), public.kyc_at_the_club(uuid),
  private.take_kyc_at_the_club(), public.take_kyc_at_the_club() from public, anon;
grant execute on function private.kyc_at_the_club(uuid, timestamptz), public.kyc_at_the_club(uuid),
  private.take_kyc_at_the_club(), public.take_kyc_at_the_club() to authenticated;
grant execute on function private.kyc_at_the_club(uuid, timestamptz) to service_role;

-- As 20261103000200_kyc_in_person_at_the_desk.sql made it, with two changes. While the venue checks identity at the club,
-- a check in person earns the bonus at once: its PAN recheck waits for the switch to go off. And the amount is the one in
-- force when the member's selfie came in for the desk, if it did, so a member who pre-registered keeps it.
create or replace function private.give_verified_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key constant text := 'verified_bonus:' || new.member_id;
  v_points bigint;
  v_is_recheck_match constant boolean := new.method = 'manual' and new.pan_recheck = 'matched'
                                         and (tg_op = 'INSERT' or old.pan_recheck is distinct from 'matched');
  -- A reviewer's approval of a check waiting for review, such as one a recheck sent back.
  v_is_review_approval constant boolean := tg_op = 'UPDATE' and old.status = 'needs_review';
begin
  if (tg_op = 'UPDATE' and old.status = 'verified' and not v_is_recheck_match)
     or (new.method = 'manual' and new.pan_recheck is distinct from 'matched' and not v_is_review_approval
         and not private.kyc_at_the_club(new.venue_id, new.verified_at))
     or exists (select 1 from public.venue v where v.id = new.venue_id and v.is_practice)
     or exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.released_at is null
                and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = new.member_id)))
     or exists (select 1 from public.ledger_transaction t where t.venue_id = new.venue_id and t.idempotency_key = v_key) then
    return new;
  end if;
  v_points := coalesce((private.setting_at(new.venue_id, 'points.verified_bonus', '', coalesce(new.at_club_from, new.verified_at))
                        ->> 'points')::bigint, 0);
  if v_points > 0 then
    perform private.credit_points(new.venue_id, new.member_id, v_points, 'Bonus on verification', v_key);
  end if;
  return new;
end;
$$;

-- As 20261028394800_kyc_manual_recheck.sql made it, holding a venue's rechecks while it checks identity at the club:
-- they are asked once the switch is off.
create or replace function private.claim_kyc_rechecks(p_with_vendor boolean)
returns table (member_id uuid, full_name text, pan text, date_of_birth date, is_practice boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select k.member_id, m.full_name, k.pan, k.date_of_birth, v.is_practice
    from public.kyc_record k
    join public.member m on m.id = k.member_id
    join public.venue v on v.id = k.venue_id
    left join private.kyc_recheck_claim c on c.member_id = k.member_id
    where k.method = 'manual' and k.status = 'verified' and k.pan_rechecked_at is null
      and k.pan is not null and k.date_of_birth is not null
      and (v.is_practice or p_with_vendor)
      and not private.kyc_at_the_club(k.venue_id, now())
      and not exists (select 1 from public.control_state f
                      where f.venue_id = k.venue_id and f.released_at is null
                        and (f.level = 'venue_freeze' or (f.level = 'feature_kill' and f.feature = 'kyc_signup')))
      and (c.claimed_at is null or c.claimed_at < now() - least(interval '1 minute' * power(2, c.attempts), interval '1 hour'))
    order by k.verified_at
    limit 50
  ),
  claimed as (
    insert into private.kyc_recheck_claim as c (member_id, attempts, claimed_at)
    select due.member_id, 1, now() from due
    on conflict on constraint kyc_recheck_claim_pkey do update set attempts = c.attempts + 1, claimed_at = now()
    returning c.member_id
  )
  select due.member_id, due.full_name, due.pan, due.date_of_birth, due.is_practice from due join claimed on claimed.member_id = due.member_id;
end;
$$;

-- As 20261105110100_own_selfie_view_cap.sql made it, letting staff who check members in person (hosts and the floor) see a
-- member's sign-up photo, the selfie they compare with the face at the desk; their other KYC images stay with reviewers.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
  v_is_staff boolean := private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')
                        or (private.has_permission(v_venue_id, 'kyc.in_person')
                            and (p_name ~ '/photo\.jpg$'
                                 -- The selfie of a member reopened for the desk, who may have no sign-up photo.
                                 or exists (select 1 from public.kyc_record k where k.photo_path = p_name and k.status = 'started'
                                              and k.at_club_from is not null)));
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (v_is_staff
             or exists (select 1 from public.kyc_record k
                        where k.member_id = private.current_member_id() and k.venue_id = v_venue_id
                          and k.status = 'verified' and k.photo_path = p_name)) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  -- One of the member's views at a time, so calls made together cannot all count the same views and all pass.
  if not v_is_staff then
    perform pg_advisory_xact_lock(hashtextextended('kyc-view:' || (select auth.uid())::text, 0));
  end if;
  if not v_is_staff and (select count(*) from public.audit_log a
                         where a.entity = 'kyc_image' and a.entity_id = p_name and a.action = 'kyc_image.view'
                           and a.actor_user_id = (select auth.uid()) and a.occurred_at > now() - interval '1 minute') >= 10 then
    raise exception 'Ten views of your photo a minute at most. Try again shortly.' using errcode = 'RVRAT';
  end if;
  perform private.audit(v_venue_id, 'kyc_image.view', 'kyc_image', p_name);
end;
$$;

-- As 20261103000200_kyc_in_person_at_the_desk.sql made it, with the selfie of a member whose check waits for the desk, so
-- the console shows it beside the camera: their sign-up photo, or for one reopened with none, the app's KYC selfie.
drop function public.kyc_in_person_candidates(uuid, text);
drop function private.kyc_in_person_candidates(uuid, text);
create function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
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
    and (k.id is null or k.status = 'started')
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^[0-9]{4,10}$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;
create function public.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_in_person_candidates(p_venue_id, p_search);
$$;
grant execute on function private.kyc_in_person_candidates(uuid, text), public.kyc_in_person_candidates(uuid, text) to authenticated;

-- As 20261018092600_kyc_in_person.sql made it, clearing what a vendor left on the check from an earlier attempt: the
-- Aadhaar's name, reference and identity key, the address, the vendor's reference and scores. Cashfree's sandbox gives
-- every member one test identity: its name would otherwise become the member's once the desk verifies them
-- (private.take_aadhaar_name), and its reference would clash with every other such check. The desk's details replace them.
create or replace function private.check_kyc_in_person(
  p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text, p_pan text, p_consent boolean
)
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
  set method = 'manual', photo_path = excluded.photo_path, date_of_birth = excluded.date_of_birth,
      masked_aadhaar = excluded.masked_aadhaar, pan = excluded.pan, refusal = null, verified_at = null,
      aadhaar_name = null, aadhaar_reference = null, identity_key = null, address = null, vendor_reference = null,
      liveness_score = null, face_match_score = null, digilocker_session_id = null
  where public.kyc_record.status = 'started';
  if not found then
    raise exception 'This member''s check is decided, waits for review, or waits for their PAN' using errcode = 'RVKYC';
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

-- As 20261018092900_kyc_reopen.sql made it. While the venue checks identity at the club, a super admin also reopens a
-- check the app's vendor held, waiting for review or refused as a duplicate: Cashfree's sandbox gives every member the
-- same identity, so such checks clash with one another and with the first verified with it (the owner, 5 Nov: they move
-- to the selfie and the desk). The vendor's identity is cleared, the selfie kept for the desk to compare, and the check
-- waits for the desk as a selfie taken now would. A verified check is never reopened.
create or replace function private.reopen_kyc_check(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
  v_is_held_by_vendor boolean;
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
  -- Otherwise only a duplicate done in person: under 18 and a reviewer's rejection stand.
  if not v_is_held_by_vendor
     and (v_record.status <> 'refused' or v_record.method <> 'manual' or v_record.refusal not in ('duplicate_aadhaar', 'duplicate_pan')) then
    raise exception 'Only a duplicate done in person is reopened, or a check the vendor held while the club checks identity'
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
  else
    update public.kyc_record set status = 'started', refusal = null, verified_at = null where id = v_record.id;
  end if;
  perform set_config('rivr.audit_reason', '', true);
end;
$$;

-- As 20261018092900_kyc_reopen.sql made it: whoever reopened a held check never does the check that follows either.
create or replace function private.changed_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.audit_log a
                 where a.entity = 'member' and a.entity_id = p_member_id::text and a.actor_user_id = (select auth.uid()))
      or exists (select 1 from public.audit_log a
                 where a.entity = 'kyc_record' and a.actor_user_id = (select auth.uid())
                   and a.after ->> 'member_id' = p_member_id::text
                   and a.before ->> 'status' in ('refused', 'needs_review') and a.after ->> 'status' = 'started');
$$;

-- The practice venue's seed is taken again with the column this batch added (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
