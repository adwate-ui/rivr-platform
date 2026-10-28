-- Fixes from the October security review (#112; docs/security/2026-10-review.md, decision 0213).
-- 101 Vikram is a super admin, 103 Aditya an admin (settings.manage, kyc.review, members.manage, not venue.configure).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table control (key text primary key, value jsonb);
insert into control values
  ('credit.config', '{"approval_threshold_paise": 100000000, "minimum_visits": 0, "exposure_cap_paise": 1000000000}'),
  ('cage.second_approver_threshold', '{"threshold_paise": 1000000000}'),
  ('tds.config', '{"enabled": false, "section": "194B", "rate_basis_points": 0, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": false, "no_pan_rate_basis_points": 0}'),
  ('exports.alert_rows', '{"rows": 1000000}'),
  ('alert.thresholds', '{"failed_deliveries": 1000, "window_minutes": 5}');
grant select on control to authenticated;
create function pg_temp.set_control(p_key text, p_reason text, p_from timestamptz default now()) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  select '00000000-0000-4000-8000-000000000001', c.key, '', c.value, p_from, p_reason from control c where c.key = p_key;
$$;
grant execute on function pg_temp.set_control(text, text, timestamptz) to authenticated;

-- After "reset role" and empty claims below, the database itself writes, as a migration or the seed does.

-- 1. The control settings: an admin who manages settings changes none of them, at once or later.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok(format($$ select pg_temp.set_control(%L, 'Raised') $$, key), '42501', null, 'an admin does not change ' || key)
from control order by key;
select throws_ok($$ select pg_temp.set_control('cage.second_approver_threshold', 'Raised from tomorrow', now() + interval '1 day') $$, '42501', null,
  'nor schedules a change');
select lives_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 12}', now() + interval '1 day', 'Busier nights') $$,
  'while other settings stay the admin''s');

-- A super admin does, with a reason, and the owner is alerted each time.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select pg_temp.set_control('credit.config', ' ') $$, '22023', null, 'a super admin gives a reason');
select lives_ok(format($$ select pg_temp.set_control(%L, 'Owner''s new limits', now() + interval '1 day') $$, key), 'a super admin changes ' || key)
from control order by key;
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select detail ->> 'key', detail ->> 'change' from public.alert where kind = 'settings.control_changed' order by detail ->> 'key' $$,
  $$ select key, 'insert'::text from control order by key $$, 'and the owner is alerted for each, with the key and no reason');

-- Withdrawing a change not yet in force is the super admin's too: a cut withdrawn is a raise.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ delete from public.setting where key = 'cage.second_approver_threshold' and effective_from > now() $$, '42501', null,
  'an admin does not withdraw one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ delete from public.setting where key = 'cage.second_approver_threshold' and effective_from > now() $$, 'a super admin does');
reset role;
select set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from public.alert where kind = 'settings.control_changed' and detail = '{"key": "cage.second_approver_threshold", "change": "delete"}'),
  'and the owner hears of that too');
select lives_ok($$ select pg_temp.set_control('exports.alert_rows', 'Seed') $$, 'the database itself (a migration, the seed) is not stopped');

-- 2. A KYC reviewer never decides the check of a member they added or changed.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000002c1', '00000000-0000-4000-8000-000000000001', 'Rana Kohli', '+919000000391');
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000002c1';
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002c1', 'needs_review', 'pan', '1990-04-04', 'ABCPK8888K',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002c1/selfie.jpg');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
update public.member set full_name = 'Rana Kohli Sharma' where id = '00000000-0000-4000-8000-0000000002c1';
select throws_ok($$ select public.review_kyc('00000000-0000-4000-8000-0000000002c1', true, 'Name matches the PAN card') $$, '42501', null,
  'Aditya renamed the member, so he does not approve the name on their check');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.review_kyc('00000000-0000-4000-8000-0000000002c1', true, 'Name matches the PAN card'), 'verified',
  'another reviewer does');

-- 3. The sign-in code limit's alert only when a code went out within the hour.
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.alert where kind = 'auth.sms_rate_limit';
delete from private.sign_in_code_send;
insert into private.sign_in_code_send (phone_hash, sent_at) values ('earlier', now() - interval '61 minutes');
set local role service_role;
select public.raise_sms_limit_alert();
reset role;
select is_empty($$ select 1 from public.alert where kind = 'auth.sms_rate_limit' $$,
  'no code went out within the hour, so the limit cannot be used up: anyone signed out asking raises nothing');
insert into private.sign_in_code_send (phone_hash, sent_at) values ('now', now() - interval '5 minutes');
set local role service_role;
select public.raise_sms_limit_alert();
reset role;
select is((select count(*)::integer from public.alert where kind = 'auth.sms_rate_limit'), 1, 'with codes going out, it alerts');

-- 4. The audit log keeps no hash and no KYC key.
select is(private.redact('{"id": 1, "label": "Cage 1", "token_hash": "t", "pin_hash": "p", "code_hash": "c", "encrypted_password": "e",
                           "identity_key": "i", "aadhaar_reference": "a", "vendor_reference": "v", "digilocker_session_id": "d"}'),
  '{"id": 1, "label": "Cage 1"}'::jsonb, 'every hash and KYC key is left out of an audited row');
select is(private.redact(null), null, 'and a missing row stays missing');

-- 5. The export archive (decision 0232) leaves out every column that could hold a secret. Its rule is a deny-list,
--    so a new column whose name suggests a secret fails here until it is left out or reviewed as safe below.
select is_empty($$
  select a.table_name || '.' || c
  from private.export_archive_tables(false) a, unnest(a.column_names) c
  where c ~ '(hash|token|secret|otp|pin|password|passcode|key|reference|session|code|salt|signature|credential|private|cert)'
    and c not in (
      -- Reviewed as safe in #112: ids, names of things, and keys that only make a write happen once.
      'idempotency_key', 'payout_key', 'session_id', 'key', 'feature_key', 'template_key', 'source_key', 'answer_key',
      'code', 'sac_code', 'account_code', 'creator_code', 'referral_code', 'cctv_reference', 'signature_svg', 'session_reminder_hours',
      -- Reviewed as safe in #131 and #132: an encoding's fingerprint, and the name of a drill spot.
      'source_hash', 'card_key',
      -- Reviewed as safe in #129: a website draft's preview token, which shows only that unpublished draft.
      'preview_token')
$$, 'no column that may hold a secret reaches the export archive unreviewed');

select * from finish();
rollback;
