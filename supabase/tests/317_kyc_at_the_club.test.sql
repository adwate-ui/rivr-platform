-- Identity checked at the club (decision 0502): a super admin switches it on; a new member's selfie, kept as their sign-up
-- photo, lets them into the app with their check waiting for the desk; a host checks them in person, final while the switch
-- is on: the bonus comes at once, at the amount in force when the selfie came in, and the PAN recheck waits for the switch
-- to go off. 101 Vikram (super admin), 103 (admin), 108 Karan (host); Meera is a new member made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000ac1b', 'authenticated', 'authenticated', '919000005021', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000ac1c', 'authenticated', 'authenticated', '919000005022', now(), now(), now());

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_user(uuid) to authenticated;

create function pg_temp.switch(p_enabled boolean, p_from timestamptz, p_reason text) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'kyc.at_the_club', '', jsonb_build_object('enabled', p_enabled), p_from, p_reason);
$$;
grant execute on function pg_temp.switch(boolean, timestamptz, text) to authenticated;

-- Meera joins; the switch is off, so her photo marks nothing.
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
insert into ids select 'meera', public.sign_up('Meera Joshi', '{}');
select is(public.kyc_at_the_club(), false, 'with the switch off, the app checks identity itself');
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', '00000000-0000-4000-8000-000000000001/' || id || '/photo.jpg' from ids where name = 'meera';
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
select is(public.take_kyc_at_the_club(), false, 'and a selfie lets no one in');
reset role;
select is((select at_club_from from public.kyc_record where member_id = (select id from ids where name = 'meera')), null,
  'nothing is marked');
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1c');
insert into ids select 'rhea', public.sign_up('Rhea Sen', '{}');
reset role;

-- Only a super admin switches it on, with a reason.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.switch(true, now() - interval '1 minute', 'Cashfree is not live') $$, '42501', null,
  'an admin may not switch identity checks to the club');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select pg_temp.switch(true, now() - interval '1 minute', '') $$, '22023', null, 'a super admin needs a reason');
select lives_ok($$ select pg_temp.switch(true, now() - interval '1 minute', 'Cashfree is not live') $$, 'and switches it on with one');
reset role;
select ok(exists (select 1 from public.alert a where a.kind = 'settings.control_changed' and a.detail ->> 'key' = 'kyc.at_the_club'),
  'and the owner is told');

-- A selfie lets a member in, once it is stored: Rhea has none yet, Meera's is in.
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1c');
select is(public.kyc_at_the_club(), true, 'the app now asks for a selfie only');
select is(public.take_kyc_at_the_club(), false, 'nothing is marked before the photo is stored');
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
select is(public.take_kyc_at_the_club(), true, 'with it stored, her check waits for the desk');
reset role;
select results_eq($$ select status, method, photo_path, at_club_from = now() from public.kyc_record where member_id = (select id from ids where name = 'meera') $$,
  $$ values ('started'::text, 'digilocker'::text, null::text, true) $$, 'started, with no KYC photo yet, and marked when the selfie came in');
-- As if the selfie came two days ago, before the bonus ended.
update public.kyc_record set at_club_from = now() - interval '2 days' where member_id = (select id from ids where name = 'meera');
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
select is(public.take_kyc_at_the_club(), true, 'asking again keeps her in');
reset role;
select is((select at_club_from from public.kyc_record where member_id = (select id from ids where name = 'meera')), now() - interval '2 days',
  'and keeps when her selfie came in');
select is(private.is_kyc_complete((select id from ids where name = 'meera')), false, 'she still cannot play: seating, the cage and money wait for the desk');
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
select is((select at_club_from is not null from public.kyc_record), true, 'she reads that her check waits for the desk');
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is(public.kyc_at_the_club('00000000-0000-4000-8000-000000000001'), true, 'a KYC reviewer sees the club checks identity at the desk');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is(public.kyc_at_the_club('00000000-0000-4000-8000-000000000001'), false, 'a host, who reviews no checks, is not told');
reset role;


-- At the desk: the host finds her, sees her selfie, and checks her originals.
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select results_eq($$ select full_name, status, app_selfie_path from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Meera Joshi') $$,
  format($$ values ('Meera Joshi'::text, 'started'::text, '00000000-0000-4000-8000-000000000001/%s/photo.jpg'::text) $$, (select id from ids where name = 'meera')),
  'the host finds Meera, with the selfie she took for the desk');
select lives_ok(format($$ select private.authorize_kyc_image('00000000-0000-4000-8000-000000000001/%s/photo.jpg') $$, (select id from ids where name = 'meera')),
  'and may see the selfie she took');
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg' from ids where name = 'meera';
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok(format($$ select private.authorize_kyc_image('00000000-0000-4000-8000-000000000001/%s/selfie.jpg') $$, (select id from ids where name = 'meera')),
  '42501', null, 'but no other KYC image');
reset role;

select set_config('request.jwt.claims', '', true);
delete from public.setting where key = 'points.verified_bonus';
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 500}', '-infinity', 'Bonus test'),
  ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 0}', now() - interval '1 day', 'Bonus test');
create function pg_temp.bonus(p_member uuid) returns bigint language sql as $$
  select coalesce(-private.account_balance(a.id), 0) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points'
$$;
-- The desk's check, with each member's own PAN and last Aadhaar digits (Meera's by default): one held by a verified member
-- is a duplicate.
create function pg_temp.desk_check(p_member_id uuid, p_pan text default 'MEEPJ7171K', p_aadhaar_last4 text default '7171')
returns text language plpgsql as $$
declare
  v_path text := public.authorize_in_person_kyc(p_member_id);
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_path), ('kyc', replace(v_path, '/in-person-', '/doc-pan-')), ('kyc', replace(v_path, '/in-person-', '/doc-aadhaar-'));
  set local role authenticated;
  return public.check_kyc_in_person(p_member_id, v_path, '1994-07-17', p_aadhaar_last4, p_pan, true, replace(v_path, '/in-person-', '/doc-pan-'), replace(v_path, '/in-person-', '/doc-aadhaar-'), true);
end;
$$;
grant execute on function pg_temp.desk_check(uuid, text, text), pg_temp.bonus(uuid) to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is(pg_temp.desk_check((select id from ids where name = 'meera')), 'verified', 'the host''s check verifies her');
reset role;
select is(private.is_kyc_complete((select id from ids where name = 'meera')), true, 'and she may play');
select is(pg_temp.bonus((select id from ids where name = 'meera')), 500::bigint,
  'the bonus comes at once, at the amount when her selfie came in, though it is 0 today');
select is_empty($$ select 1 from private.claim_kyc_rechecks(true) r where r.member_id = (select id from ids where name = 'meera') $$,
  'her PAN recheck waits while the club checks identity');

-- Members held on the sandbox (the owner, 5 Nov): Raghav's check waits for review and Jayesh's was refused as a duplicate,
-- each with the sandbox's one test identity. A super admin moves both to the desk.
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000410/selfie.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000412/selfie.jpg');
insert into public.kyc_record (venue_id, member_id, status, method, refusal, photo_path, date_of_birth, masked_aadhaar, pan,
                               aadhaar_name, aadhaar_reference, identity_key, vendor_reference, face_match_score, liveness_score)
select '00000000-0000-4000-8000-000000000001', m, s, 'digilocker', r,
       '00000000-0000-4000-8000-000000000001/' || m || '/selfie.jpg', '1990-01-01', 'XXXX XXXX 1111', 'ABCPS1111S',
       'SANDBOX TEST USER', 'sandbox-ref', 'sandbox-key', 'cf-sandbox', 99, 98
from (values ('00000000-0000-4000-8000-000000000410'::uuid, 'needs_review', null),
             ('00000000-0000-4000-8000-000000000412'::uuid, 'refused', 'duplicate_aadhaar')) as v (m, s, r);
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000410', 'Held on the sandbox') $$,
  '42501', null, 'an admin may not move a held check to the desk');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000410', 'Held on the sandbox') $$,
  'a super admin moves a check waiting for review to the desk');
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000412', 'Held on the sandbox') $$,
  'and one refused as the sandbox''s duplicate');
reset role;
select results_eq(
  $$ select status, refusal, at_club_from is not null, photo_path is not null, date_of_birth, masked_aadhaar, pan, aadhaar_name,
            aadhaar_reference, identity_key, vendor_reference, face_match_score
     from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000410' $$,
  $$ values ('started'::text, null::text, true, true, null::date, null::text, null::text, null::text, null::text, null::text, null::text, null::smallint) $$,
  'the sandbox''s identity is cleared, the selfie kept for the desk, and the check waits for it');
select is((select at_club_from = created_at from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000410'), true,
  'marked from the day his check began, so the bonus of that day is his');
select ok(exists (select 1 from public.audit_log a where a.entity = 'kyc_record' and a.reason = 'Held on the sandbox'
                    and a.before ->> 'status' = 'needs_review' and a.after ->> 'status' = 'started'),
  'the audit log keeps the reason and who moved it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is_empty($$ select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Raghav') $$,
  'whoever moved it never does the desk''s check');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select results_eq($$ select app_selfie_path from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Raghav') $$,
  $$ values ('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000410/selfie.jpg'::text) $$,
  'a host finds him, with the selfie he took in the app');
select lives_ok($$ select private.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000410/selfie.jpg') $$,
  'and may see it');
select is(pg_temp.desk_check('00000000-0000-4000-8000-000000000410', 'RAGPG4100G', '4100'), 'verified',
  'the desk verifies him: the sandbox''s identity no longer clashes');
reset role;
select is((select full_name from public.member where id = '00000000-0000-4000-8000-000000000410'), 'Raghav Grewal',
  'and the sandbox''s name never becomes his');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000410', 'Again') $$,
  'RVKYC', null, 'a verified check is never reopened');
reset role;
select is((select status from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000412'), 'started',
  'Jayesh, refused as the sandbox''s duplicate, waits for the desk too');

-- The practice venue: Rajat joins by selfie and Sunita checks him at the desk; nothing goes out, and no bonus is paid.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000002', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Practice the desk');
reset role;
insert into storage.objects (bucket_id, name)
values ('kyc', '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000302/photo.jpg');
select pg_temp.as_user('00000000-0000-4000-8000-000000000302');
select is(public.take_kyc_at_the_club(), true, 'a practice member''s selfie lets him in');
select pg_temp.as_user('00000000-0000-4000-8000-000000000124');
select is(pg_temp.desk_check('00000000-0000-4000-8000-000000000302', 'RAJPS3020S', '3020'), 'verified', 'and the practice desk verifies him');
reset role;
select is_empty($$ select 1 from public.outbox_event e where e.event_type = 'member.notice'
                    and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000302' $$,
  'the practice venue tells him nothing outside');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000302'), 0::bigint, 'and pays no bonus');

-- Switched off: her recheck is asked, she stays verified, and a match pays nothing more.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select pg_temp.switch(false, now(), 'Cashfree is live') $$, 'the super admin switches it off');
reset role;
select isnt_empty($$ select 1 from private.claim_kyc_rechecks(true) r where r.member_id = (select id from ids where name = 'meera') $$,
  'her PAN recheck is asked once it is off');
select private.record_kyc_recheck((select id from ids where name = 'meera'), 'matched');
select is(pg_temp.bonus((select id from ids where name = 'meera')), 500::bigint, 'a match pays no second bonus');
select pg_temp.as_user('00000000-0000-4000-8000-00000000ac1b');
select is(public.kyc_at_the_club(), false, 'new members check in the app again');
reset role;

select is(has_function_privilege('anon', 'public.kyc_at_the_club(uuid)', 'execute'), false, 'nobody signed out asks');
select is(has_function_privilege('anon', 'public.take_kyc_at_the_club()', 'execute'), false, 'or marks a check');

select * from finish();
rollback;
