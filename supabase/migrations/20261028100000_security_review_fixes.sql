-- Fixes from the October security review (#112; docs/security/2026-10-review.md, decision 0213).
--
-- 1. The control settings. Anyone with settings.manage (admins too) could add any setting, in force at once.
--    So one admin could raise the credit approval threshold and approve a large line alone (decision 0058),
--    raise the second-approver threshold and pay a withdrawal alone (0063), switch TDS off, or silence the
--    large-export and failed-delivery alerts. These keys now follow the AML settings (0234): only a super
--    admin adds or withdraws them, with a reason, and the owner is alerted on every change.
-- 2. A KYC reviewer never decides the check of a member they added or changed, as the in-person check
--    already refuses (20261018092600_kyc_in_person.sql): otherwise an admin could rename a member and then
--    approve that member's name mismatch alone.
-- 3. The sign-in code limit's alert is raised only when a code went out within the hour. The function that
--    asks for it is open to anyone signed out, and the hourly limit cannot be used up in an hour with no codes.
-- 4. The audit log keeps no hash and no KYC key (the export archive already leaves those columns out).

-- 1. The control settings.
create function private.guard_control_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.setting := case when tg_op = 'DELETE' then old else new end;
begin
  if (select auth.uid()) is null or coalesce(private.purging(v_row.venue_id), false) then
    return v_row;
  end if;
  if not private.has_permission(v_row.venue_id, 'venue.configure') then
    raise exception 'Only a super admin changes %', v_row.key using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and length(btrim(coalesce(new.reason, ''))) < 3 then
    raise exception 'A change to % needs a reason', v_row.key using errcode = '22023';
  end if;
  perform private.raise_alert(v_row.venue_id, 'settings.control_changed', jsonb_build_object('key', v_row.key, 'change', lower(tg_op)));
  return v_row;
end;
$$;
revoke execute on function private.guard_control_settings() from public, anon, authenticated;

create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds'))
  execute function private.guard_control_settings();

-- 2. As 20261018092300_kyc_review.sql, refusing a reviewer who added or changed the member.
create or replace function private.review_kyc(
  p_member_id uuid, p_approve boolean, p_reason text, p_date_of_birth date default null, p_pan text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
  v_status text;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'kyc.review') or private.is_own_kyc_check(p_member_id)
     or private.changed_member(p_member_id) then
    raise exception 'Only a KYC reviewer decides a check, never their own nor one for a member they added or changed'
      using errcode = '42501';
  end if;
  if v_record.status <> 'needs_review' then
    raise exception 'This check is not waiting for review' using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500
     or p_reason ~ '[0-9]{4}[^0-9]?[0-9]{4}[^0-9]?[0-9]{4}' or p_reason ~* '[a-z]{5}[0-9]{4}[a-z]'
     or (p_date_of_birth is not null and (v_record.date_of_birth is not null or p_date_of_birth not between '1900-01-01' and current_date))
     or (p_pan is not null and (v_record.pan is not null or upper(trim(p_pan)) !~ '^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$')) then
    raise exception 'A review needs its reason, with no document numbers, and a date of birth or PAN only where the check has none'
      using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, case when p_approve then 'kyc_signup'::public.killable_feature end, p_member_id);
  if p_approve and coalesce(v_record.date_of_birth, p_date_of_birth) is null then
    raise exception 'Enter the date of birth from the original document' using errcode = 'RVDOB';
  end if;
  if p_approve and coalesce(v_record.pan, p_pan) is null then
    raise exception 'Enter the PAN from the original PAN card' using errcode = 'RVPAN';
  end if;
  if p_approve then
    update public.kyc_record
    set date_of_birth = coalesce(date_of_birth, p_date_of_birth), pan = coalesce(pan, upper(trim(p_pan)))
    where id = v_record.id;
    v_status := private.settle_kyc(p_member_id, 'verified', true);
  else
    update public.kyc_record set status = 'refused', refusal = 'staff_rejected', verified_at = null where id = v_record.id;
    v_status := 'refused';
  end if;
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id)
  values (v_record.venue_id, p_member_id, case when p_approve then 'approved' else 'rejected' end, trim(p_reason),
          p_approve and p_date_of_birth is not null, p_approve and p_pan is not null, v_status,
          private.current_staff_id(v_record.venue_id));
  return v_status;
end;
$$;

-- 3. As 20261026234000_alerting.sql, only when a sign-in code went out within the hour.
create or replace function private.raise_sms_limit_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);
begin
  perform pg_advisory_xact_lock(hashtext('sms-limit-alert'));
  if v_venue_id is null
     or not exists (select 1 from private.sign_in_code_send s where s.sent_at > now() - interval '1 hour')
     or exists (
       select 1 from public.alert a
       where a.venue_id = v_venue_id and a.kind = 'auth.sms_rate_limit' and a.raised_at > now() - interval '15 minutes'
     ) then
    return;
  end if;
  perform private.raise_alert(v_venue_id, 'auth.sms_rate_limit',
    jsonb_build_object('note', 'Sign-in codes are being refused: the project''s hourly code limit is used up.'));
end;
$$;

-- 4. As 20261018090200_audit_log.sql, also leaving out every hash and the KYC keys the archive leaves out
--    (private.export_archive_tables): a device's token hash reached the audit log when a computer was claimed.
create or replace function private.redact(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select p_row - array(
    select k from jsonb_object_keys(p_row) as k
    where k like '%\_hash' or k in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id')
  );
$$;
