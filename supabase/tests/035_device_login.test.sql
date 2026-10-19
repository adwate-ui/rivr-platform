-- A dealer tablet's own login (#41): staff with devices.manage start pairing and fix the tablet to a
-- table; only device-pair (the service role) redeems a code and links the login; wrong codes are
-- limited by address and in all; Auth's hook gives a device login a token only by its password while
-- it is paired; a revoked device stays revoked and its login unlinked.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.event(user_id uuid, methods text[]) returns jsonb language sql as $$
  select jsonb_build_object('user_id', user_id, 'claims', jsonb_build_object('sub', user_id,
    'amr', (select jsonb_agg(jsonb_build_object('method', m, 'timestamp', 1760000000)) from unnest(methods) as m)));
$$;

create function pg_temp.as_staff(person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', person, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.table_id(venue_id uuid, table_name text) returns uuid language sql as $$
  select t.id from public.game_table t where t.venue_id = $1 and t.name = $2;
$$;
grant execute on function pg_temp.as_staff(text), pg_temp.table_id(uuid, text) to authenticated, service_role;

insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A'),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet B'),
  ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage PC'),
  ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV');
-- Logins as device-pair makes them: Tablet A's first, then a second.
insert into auth.users (id, instance_id, aud, role, phone, raw_app_meta_data) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001',
   '{"device_id": "00000000-0000-4000-8000-00000000d001"}'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000002',
   '{"device_id": "00000000-0000-4000-8000-00000000d001"}');

-- Enrolment: who added it is the caller, whatever is sent.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
insert into public.device (venue_id, kind, name, enrolled_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet E', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001';
reset role;
select is((select s.user_id from public.device d join public.staff s on s.id = d.enrolled_by_staff_id
           where d.name = 'Tablet E'), '00000000-0000-4000-8000-000000000103'::uuid,
  'a tablet is recorded as added by whoever added it, not by whom the console says');

-- Pairing: staff with devices.manage, for a tablet or a TV.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001') $$, '42501', null,
  'a dealer cannot start pairing a tablet');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d003') $$, '22023', null,
  'a cage computer is not paired: it has no login of its own');
select lives_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d004') $$, 'a TV is paired the same way');
create temporary table first_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
create temporary table second_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
grant select on first_code, second_code to service_role;
select ok((select code ~ '^[0-9]{6}$' and expires_at = now() + interval '10 minutes' from second_code), 'a six-digit code, for ten minutes');
select throws_ok($$ select count(*) from public.device_pairing $$, '42501', null, 'no one reads the codes, not even staff');
select throws_ok($$ select * from public.redeem_device_pairing('000000', 'staff') $$, '42501', null, 'staff cannot redeem a code');
select throws_ok($$ select public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000103') $$, '42501', null,
  'nor link a login to a device');
reset role;
select is((select count(*) from public.device_pairing where device_id = '00000000-0000-4000-8000-00000000d001' and expires_at > now())::int, 1,
  'pairing again leaves one live code');
select ok(not exists (select 1 from public.device_pairing p, second_code s where p.code_hash = s.code), 'the code is kept only as a hash');
select ok(exists (select 1 from public.audit_log where action = 'device.pairing_started' and entity_id = '00000000-0000-4000-8000-00000000d001'),
  'starting to pair is in the audit log');

-- Redeeming, as device-pair.
set local role service_role;
select results_eq($$ select refusal from public.redeem_device_pairing((select code from first_code), 'tablet') $$, $$ values ('wrong_code'::text) $$,
  'a code given out before is no longer good');
select results_eq($$ select device_id, previous_user_id, refusal from public.redeem_device_pairing((select code from second_code), 'tablet') $$,
  $$ values ('00000000-0000-4000-8000-00000000d001'::uuid, null::uuid, null::text) $$, 'the right code names the tablet, which has no login yet');
select results_eq($$ select refusal from public.redeem_device_pairing((select code from second_code), 'tablet') $$, $$ values ('wrong_code'::text) $$,
  'a code is good once');
select ok(public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000e001'), 'device-pair links the new login');
reset role;
select ok(exists (select 1 from public.audit_log where action = 'device.paired' and entity_id = '00000000-0000-4000-8000-00000000d001'),
  'pairing is in the audit log');

-- The device's login, at Auth's hook.
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e001', array['password'])) -> 'error', null,
  'the paired tablet gets its token by its password');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e001', array['otp'])) -> 'error' ->> 'http_code', '403',
  'never by a code, so its login moved onto a phone gets nothing');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e001', array['password', 'otp'])) -> 'error' ->> 'http_code', '403',
  'nor with a code added');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-000000000201', array['password'])) -> 'error' ->> 'http_code', '403',
  'a member''s password sign-in still gets none');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-000000000201', array['otp'])) -> 'error', null,
  'and a code sign-in still does');
select is(private.require_code_sign_in(jsonb_build_object('claims', jsonb_build_object('amr', '[{"method": "password"}]'::jsonb))) -> 'error' ->> 'http_code',
  '403', 'a password event without a user gets none');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000003');
insert into public.device (venue_id, kind, name, auth_user_id)
values ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet G', '00000000-0000-4000-8000-00000000e003');
insert into public.control_state (venue_id, level, device_id, reason)
select '00000000-0000-4000-8000-000000000001', 'access_revoke', id, 'Test' from public.device where name = 'Tablet G';
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e003', array['password'])) -> 'error' ->> 'http_code', '403',
  'a device whose access is revoked gets none');

-- Fixing the tablet to a table.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d001', pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 3')) $$,
  '42501', null, 'a dealer cannot fix a tablet to a table');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d001', pg_temp.table_id('00000000-0000-4000-8000-000000000002', 'Table 3')) $$,
  '22023', null, 'nor to another venue''s table');
select throws_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d004', pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 3')) $$,
  '22023', null, 'and a TV is fixed to no table');
select lives_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d001', pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 3')) $$,
  'a floor manager fixes Tablet A to Table 3');
select is_empty($$ select * from public.my_device() $$, 'staff are not a device');
select pg_temp.as_staff('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select name, table_name from public.my_device() $$, $$ values ('Tablet A'::text, 'Table 3'::text) $$,
  'the tablet knows its table');
select is((select count(*) from public.tablet_assignment)::int, 1, 'and sees only its own assignment');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.tablet_assignment $$, 'a member sees none');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d002', pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 3')) $$,
  'Tablet B takes Table 3');
select is_empty($$ select * from public.tablet_assignment where device_id = '00000000-0000-4000-8000-00000000d001' $$, 'which frees Tablet A');

-- Pairing again replaces only a login device-pair made for this device.
create temporary table again_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
grant select on again_code to service_role;
reset role;
set local role service_role;
select results_eq($$ select previous_user_id from public.redeem_device_pairing((select code from again_code), 'tablet') $$,
  $$ values ('00000000-0000-4000-8000-00000000e001'::uuid) $$, 'pairing again names the old login, for device-pair to remove');
select ok(public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000e002'), 'and links the new one');
reset role;

-- Guessing: five wrong codes from one address, or fifty in all, and redemptions wait.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table b_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d002');
grant select on b_code to service_role;
reset role;
set local role service_role;
select results_eq(format('select refusal from public.redeem_device_pairing(%L, %L)', lpad(((code::int + n) % 1000000)::text, 6, '0'), '203.0.113.7'),
  $$ values ('wrong_code'::text) $$, 'a wrong guess') from b_code, generate_series(1, 5) as n;
select results_eq($$ select refusal from public.redeem_device_pairing((select code from b_code), '203.0.113.7') $$, $$ values ('too_many'::text) $$,
  'after five wrong codes that address is refused, even the right code');
select results_eq($$ select device_id from public.redeem_device_pairing((select code from b_code), '198.51.100.2') $$,
  $$ values ('00000000-0000-4000-8000-00000000d002'::uuid) $$, 'but the code still works from the tablet''s own address');
reset role;
insert into private.device_pairing_miss (client) select 'guess-' || n from generate_series(1, 45) as n;
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table late_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d004');
grant select on late_code to service_role;
reset role;
set local role service_role;
select results_eq($$ select refusal from public.redeem_device_pairing((select code from late_code), '198.51.100.9') $$, $$ values ('too_many'::text) $$,
  'with fifty wrong codes in ten minutes from anywhere, every redemption waits');
reset role;
select ok(exists (select 1 from public.alert where kind = 'devices.pairing_guessed'), 'and the owner is alerted');
delete from private.device_pairing_miss;

-- Expired and revoked.
update public.device_pairing set expires_at = now() - interval '1 second' where device_id = '00000000-0000-4000-8000-00000000d004' and redeemed_at is null;
set local role service_role;
select results_eq($$ select refusal from public.redeem_device_pairing((select code from late_code), '198.51.100.9') $$, $$ values ('wrong_code'::text) $$,
  'an expired code is refused');
reset role;
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table revoked_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d002');
grant select on revoked_code to service_role;
update public.device set revoked_at = now(), revoked_reason = 'Lost' where id = '00000000-0000-4000-8000-00000000d002';
reset role;
select results_eq($$ select auth_user_id, (select count(*)::integer from public.tablet_assignment where device_id = d.id)
                     from public.device d where d.id = '00000000-0000-4000-8000-00000000d002' $$,
  $$ values (null::uuid, 0) $$, 'revoking a tablet unlinks its login and frees its table');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ update public.device set revoked_at = null, revoked_reason = null where id = '00000000-0000-4000-8000-00000000d002' $$,
  '22023', null, 'a revoked tablet stays revoked: it is enrolled again instead');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d002') $$, '22023', null,
  'and is not paired again');
update public.device set revoked_at = now(), revoked_reason = 'Lost' where id = '00000000-0000-4000-8000-00000000d001';
reset role;
set local role service_role;
select results_eq($$ select refusal from public.redeem_device_pairing((select code from revoked_code), 'tablet') $$, $$ values ('wrong_code'::text) $$,
  'a code it had is refused');
select ok(not public.link_device_login('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000e002'), 'nor a login linked to it');
reset role;
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e002', array['password'])) -> 'error' ->> 'http_code', '403',
  'and a revoked tablet''s login gets no new token');
select pg_temp.as_staff('00000000-0000-4000-8000-00000000e002');
select is_empty($$ select * from public.my_device() $$, 'and is nobody now');
reset role;

-- Who can call what.
select ok(not has_function_privilege('authenticated', 'private.redeem_device_pairing(text, text)', 'execute')
          and not has_function_privilege('anon', 'private.redeem_device_pairing(text, text)', 'execute')
          and not has_function_privilege('authenticated', 'private.link_device_login(uuid, uuid)', 'execute'),
  'only the service role redeems codes and links logins');
set local role anon;
select throws_ok($$ select * from public.my_device() $$, '42501', null, 'a visitor calls none of it');
reset role;

-- A venue freeze, last: a control is never deleted.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d004') $$, 'RVFRZ', null, 'no pairing while the venue is frozen');
select throws_ok($$ insert into public.device (venue_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet F') $$,
  'RVFRZ', null, 'nor a tablet added');
select throws_ok(format('select public.assign_tablet(%L, %L)', (select id from public.device where name = 'Tablet E'),
                        pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 2')),
  'RVFRZ', null, 'nor a table fixed');
reset role;

select * from finish();
rollback;
