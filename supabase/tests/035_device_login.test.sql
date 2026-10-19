-- A dealer tablet's own login (#41): staff with devices.manage start pairing and fix the tablet to a
-- table; only device-pair (the service role) redeems a code and links the login; guessing burns the
-- codes; Auth's hook gives a password session a token only for a paired device that is not revoked.
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
  ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage PC');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');

-- Pairing: staff with devices.manage, for a tablet or a TV.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001') $$, '42501', null,
  'a dealer cannot start pairing a tablet');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d003') $$, '42501', null,
  'a cage computer is not paired: it has no login of its own');
create temporary table first_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
create temporary table second_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
grant select on first_code, second_code to service_role;
select ok((select code ~ '^[0-9]{6}$' and expires_at = now() + interval '10 minutes' from second_code), 'a six-digit code, for ten minutes');
select throws_ok($$ select count(*) from public.device_pairing $$, '42501', null, 'no one reads the codes, not even staff');
reset role;
select is((select count(*) from public.device_pairing where device_id = '00000000-0000-4000-8000-00000000d001' and expires_at > now())::int, 1,
  'pairing again leaves one live code');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.redeem_device_pairing('000000') $$, '42501', null, 'staff cannot redeem a code');
select throws_ok($$ select public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000103') $$, '42501', null,
  'nor link a login to a device');
reset role;
select ok(not exists (select 1 from public.device_pairing p, second_code s where p.code_hash = s.code),
  'the code is kept only as a hash');

-- Redeeming, as device-pair.
set local role service_role;
select is_empty($$ select * from public.redeem_device_pairing((select code from first_code)) $$, 'a code given out before is no longer good');
reset role;
select is((select failed_attempts from public.device_pairing p join second_code s on p.code_hash = private.pairing_hash(s.code)), 1,
  'and the wrong code counts against the live one');
set local role service_role;
select results_eq($$ select * from public.redeem_device_pairing((select code from second_code)) $$,
  $$ values ('00000000-0000-4000-8000-00000000d001'::uuid, null::uuid) $$, 'the right code names the tablet, which has no login yet');
select is_empty($$ select * from public.redeem_device_pairing((select code from second_code)) $$, 'a code is good once');
select ok(public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000e001'), 'device-pair links the new login');
reset role;

-- The device's login, at Auth's hook.
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e001', array['password'])) -> 'error', null,
  'the paired tablet gets its token');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-000000000201', array['password'])) -> 'error' ->> 'http_code', '403',
  'a member''s password sign-in still gets none');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-000000000201', array['otp'])) -> 'error', null,
  'and a code sign-in still does');

-- Fixing the tablet to a table.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d001', pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 3')) $$,
  '42501', null, 'a dealer cannot fix a tablet to a table');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.assign_tablet('00000000-0000-4000-8000-00000000d001', pg_temp.table_id('00000000-0000-4000-8000-000000000002', 'Table 3')) $$,
  '22023', null, 'nor to another venue''s table');
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
reset role;

-- Guessing.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table b_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d002');
grant select on b_code to service_role;
reset role;
set local role service_role;
select is_empty(format('select * from public.redeem_device_pairing(%L)', lpad(((code::int + n) % 1000000)::text, 6, '0')), 'a wrong guess')
from b_code, generate_series(1, 5) as n;
select is_empty($$ select * from public.redeem_device_pairing((select code from b_code)) $$, 'after five wrong codes the right one is refused too');
reset role;

-- Expired and revoked.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table late_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d002');
grant select on late_code to service_role;
reset role;
update public.device_pairing set expires_at = now() - interval '1 second' where device_id = '00000000-0000-4000-8000-00000000d002' and redeemed_at is null;
set local role service_role;
select is_empty($$ select * from public.redeem_device_pairing((select code from late_code)) $$, 'an expired code is refused');
reset role;
select pg_temp.as_staff('00000000-0000-4000-8000-000000000103');
create temporary table revoked_code on commit drop as select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001');
grant select on revoked_code to service_role;
update public.device set revoked_at = now(), revoked_reason = 'Lost' where id = '00000000-0000-4000-8000-00000000d001';
select throws_ok($$ select * from public.start_device_pairing('00000000-0000-4000-8000-00000000d001') $$, '42501', null, 'a revoked tablet is not paired again');
reset role;
set local role service_role;
select is_empty($$ select * from public.redeem_device_pairing((select code from revoked_code)) $$, 'nor is a code it had redeemed');
select ok(not public.link_device_login('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000e001'), 'nor a login linked to it');
reset role;
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-00000000e001', array['password'])) -> 'error' ->> 'http_code', '403',
  'and its login gets no new token');
select pg_temp.as_staff('00000000-0000-4000-8000-00000000e001');
select is_empty($$ select * from public.my_device() $$, 'and is nobody now');
reset role;

set local role anon;
select throws_ok($$ select * from public.my_device() $$, '42501', null, 'a visitor calls none of it');
reset role;

select * from finish();
rollback;
