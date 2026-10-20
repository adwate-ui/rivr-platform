-- TV pairing (#49): only device-pair (the service role) starts a TV's request and asks with its
-- secret; staff with devices.manage claim the code the TV shows, with its name and mode, once; the
-- TV is signed in once, sees its own screen and mode, and nothing once revoked; requests are
-- limited by address and in all.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

create function pg_temp.as_person(person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, service_role;

-- Two requests, as device-pair starts them for a TV.
set local role service_role;
create temporary table bar on commit drop as select * from public.start_tv_pairing('203.0.113.9');
create temporary table door on commit drop as select * from public.start_tv_pairing('203.0.113.9');
reset role;
grant select on bar, door to authenticated, service_role;
select ok((select code ~ '^[0-9]{6}$' and secret ~ '^[0-9a-f]{64}$' and expires_at = now() + interval '15 minutes' and refusal is null from bar),
  'a TV gets six digits to show and a secret to ask with, for fifteen minutes');
select ok((select b.code <> d.code from bar b, door d), 'no two live requests show the same code');
select ok(not exists (select 1 from private.tv_pairing p, bar b where p.code_hash = b.code or p.secret_hash = b.secret),
  'the code and the secret are kept only as hashes');

-- No one else starts or asks.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.start_tv_pairing('staff') $$, '42501', null, 'staff cannot start a TV''s request');
select throws_ok($$ select * from public.check_tv_pairing((select secret from bar)) $$, '42501', null, 'nor ask with its secret');
select throws_ok($$ select count(*) from private.tv_pairing $$, '42501', null, 'nor read the requests');
reset role;
set local role anon;
select throws_ok($$ select * from public.start_tv_pairing('anyone') $$, '42501', null, 'a signed-out caller cannot either');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', '000000', 'TV', 'waitlist') $$, '42501', null,
  'nor claim a code');
reset role;

-- Before the code is claimed.
set local role service_role;
select results_eq($$ select device_id, refusal from public.check_tv_pairing((select secret from bar)) $$,
  $$ values (null::uuid, 'waiting'::text) $$, 'a live request waits');
select results_eq($$ select refusal from public.check_tv_pairing(repeat('0', 64)) $$, $$ values ('expired'::text) $$,
  'an unknown secret is told to start again');
reset role;

-- Claiming the code.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from bar), 'Bar TV', 'waitlist') $$,
  '42501', null, 'a dealer cannot pair a TV');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from bar), 'Bar TV', 'waitlist') $$,
  '42501', null, 'nor can a member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001',
    lpad(((select code from bar)::int + 1)::text, 6, '0'), 'Bar TV', 'waitlist') $$, 'RVCOD', null,
  'a code no TV shows is refused');
create temporary table bar_tv on commit drop as
  select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from bar), '  Bar TV ', 'waitlist') as device_id;
grant select on bar_tv to authenticated, service_role;
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from bar), 'Bar TV', 'jackpot') $$,
  'RVCOD', null, 'a code is claimed once');
reset role;
select results_eq($$ select d.venue_id, d.kind, d.name, s.user_id, d.auth_user_id from public.device d
                     join public.staff s on s.id = d.enrolled_by_staff_id where d.id = (select device_id from bar_tv) $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, 'tv'::public.device_kind, 'Bar TV'::text,
             '00000000-0000-4000-8000-000000000103'::uuid, null::uuid) $$,
  'the TV is enrolled at the venue by whoever typed its code, with no login yet');
select results_eq($$ select mode from public.tv_screen where device_id = (select device_id from bar_tv) $$,
  $$ values ('waitlist'::public.tv_mode) $$, 'with the mode chosen');
select ok(exists (select 1 from public.audit_log where action = 'device.paired' and entity_id = (select device_id::text from bar_tv)),
  'pairing a TV is in the audit log');

-- The TV picks up its login: once, then again only if that sign-in failed, and only soon after the claim.
set local role service_role;
select results_eq($$ select device_id, previous_user_id, refusal from public.check_tv_pairing((select secret from bar)) $$,
  $$ select device_id, null::uuid, null::text from bar_tv $$, 'the TV''s next ask names its device, which has no login yet');
select results_eq($$ select refusal from public.check_tv_pairing((select secret from bar)) $$, $$ values ('waiting'::text) $$,
  'an ask while device-pair signs it in waits');
select results_eq($$ select refusal from public.check_tv_pairing((select secret from door)) $$, $$ values ('waiting'::text) $$,
  'another TV still waits');
reset role;
insert into auth.users (id, instance_id, aud, role, phone, raw_app_meta_data)
select '00000000-0000-4000-8000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       '999000000000101', jsonb_build_object('device_id', device_id) from bar_tv;
set local role service_role;
select ok(public.link_device_login((select device_id from bar_tv), '00000000-0000-4000-8000-00000000e101'), 'device-pair links its login');
reset role;
update private.tv_pairing set delivered_at = now() - interval '31 seconds' where secret_hash = private.pairing_hash((select secret from bar));
set local role service_role;
select results_eq($$ select device_id, previous_user_id from public.check_tv_pairing((select secret from bar)) $$,
  $$ select device_id, '00000000-0000-4000-8000-00000000e101'::uuid from bar_tv $$,
  'thirty seconds on, an ask names the device again with the login to replace, as that login never signed in');
reset role;
update private.tv_pairing set claimed_at = now() - interval '15 minutes', delivered_at = null
where secret_hash = private.pairing_hash((select secret from bar));
set local role service_role;
select results_eq($$ select device_id, refusal from public.check_tv_pairing((select secret from bar)) $$,
  $$ values (null::uuid, 'expired'::text) $$, 'fifteen minutes after the claim, the secret signs nothing in');
reset role;
update private.tv_pairing set claimed_at = now(), delivered_at = now() - interval '31 seconds'
where secret_hash = private.pairing_hash((select secret from bar));
update auth.users set last_sign_in_at = now() where id = '00000000-0000-4000-8000-00000000e101';
set local role service_role;
select results_eq($$ select device_id, refusal from public.check_tv_pairing((select secret from bar)) $$,
  $$ values (null::uuid, 'expired'::text) $$, 'and once the TV has signed in, the secret is spent: it cannot swap out a working TV''s login');
reset role;

-- What the TV and others see: its own screen, and not the venue's dealer downs.
insert into public.device (id, venue_id, kind, name)
values ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet T');
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select t.venue_id, t.id, s.id, '00000000-0000-4000-8000-00000000d101'
from public.game_table t
join public.staff s on s.venue_id = t.venue_id and s.user_id = '00000000-0000-4000-8000-000000000106'
where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 1';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select results_eq($$ select device_id, name, mode from public.my_tv_screen() $$,
  $$ select device_id, 'Bar TV'::text, 'waitlist'::public.tv_mode from bar_tv $$, 'the TV knows its name and mode');
select results_eq($$ select count(*)::int from public.tv_screen $$, $$ values (1) $$, 'and sees only its own screen');
select is_empty($$ select * from public.dealer_down $$, 'a TV sees none of the venue''s dealer downs, which are for its tablets');
select throws_ok($$ select public.set_tv_mode((select device_id from bar_tv), 'jackpot') $$, '42501', null, 'a TV cannot change its mode');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.tv_screen $$, 'a member sees no TV screens');
select is_empty($$ select * from public.my_tv_screen() $$, 'and is not a TV');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.my_tv_screen() $$, 'nor is staff');

-- Changing what it shows.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_tv_mode((select device_id from bar_tv), 'jackpot') $$, '42501', null, 'a dealer cannot change a TV''s mode');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tv_mode('00000000-0000-4000-8000-00000000d101', 'jackpot') $$, '22023', null,
  'a tablet has no display mode');
select lives_ok($$ select public.set_tv_mode((select device_id from bar_tv), 'jackpot') $$, 'a floor manager puts the jackpot on the bar TV');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select results_eq($$ select mode from public.my_tv_screen() $$, $$ values ('jackpot'::public.tv_mode) $$, 'which the TV reads next');

-- The practice venue pairs its own TVs, and a frozen venue pairs none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000002', (select code from door), 'Practice TV', 'call_time') $$,
  'staff pair a TV at the practice venue');
reset role;
select is((select d.venue_id from public.device d where d.name = 'Practice TV'), '00000000-0000-4000-8000-000000000002'::uuid,
  'which belongs to the practice venue');
set local role service_role;
create temporary table hall on commit drop as select * from public.start_tv_pairing('203.0.113.10');
reset role;
grant select on hall to authenticated;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV', 'waitlist') $$,
  'RVFRZ', null, 'a frozen venue pairs no TV');
select throws_ok($$ select public.set_tv_mode((select device_id from bar_tv), 'waitlist') $$, 'RVFRZ', null, 'nor changes a mode');
reset role;
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select s.id from public.staff s
                          where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
  release_second_staff_id = (select s.id from public.staff s
                             where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where venue_id = '00000000-0000-4000-8000-000000000001' and level = 'venue_freeze';

-- Unpairing: the TV is revoked, and from then on is nobody.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
update public.device set revoked_at = now(), revoked_reason = 'Moved to the bar' where id = (select device_id from bar_tv);
select pg_temp.as_person('00000000-0000-4000-8000-00000000e101');
select is_empty($$ select * from public.my_tv_screen() $$, 'an unpaired TV reads no screen, so it shows a new code');
select is_empty($$ select * from public.tv_screen $$, 'nor any other');
reset role;

-- A request runs out.
update private.tv_pairing set expires_at = now() - interval '1 second' where secret_hash = private.pairing_hash((select secret from hall));
set local role service_role;
select results_eq($$ select refusal from public.check_tv_pairing((select secret from hall)) $$, $$ values ('expired'::text) $$,
  'a request that has run out is told to start again');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV', 'waitlist') $$,
  'RVCOD', null, 'and its code cannot be claimed');
reset role;

-- Limits: thirty requests from one address in ten minutes (the hall TV's was the first), two hundred in all.
set local role service_role;
select results_eq($$ select refusal from public.start_tv_pairing('203.0.113.10') $$, $$ values (null::text) $$,
  'one address makes up to thirty requests') from generate_series(2, 30);
select results_eq($$ select refusal from public.start_tv_pairing('203.0.113.10') $$, $$ values ('too_many'::text) $$,
  'the thirty-first is refused');
select results_eq($$ select refusal from public.start_tv_pairing('198.51.100.20') $$, $$ values (null::text) $$,
  'another address still gets a code');
select results_eq(format('select refusal from public.start_tv_pairing(%L)', '2001:db8:1:2::' || n), $$ values (null::text) $$,
  'an IPv6 /64 makes up to thirty requests, whatever its last half') from generate_series(1, 30) as n;
select results_eq($$ select refusal from public.start_tv_pairing('2001:db8:1:2:ffff::9') $$, $$ values ('too_many'::text) $$,
  'so changing the last half does not get round the limit');
select results_eq($$ select refusal from public.start_tv_pairing('2001:db8:1:3::1') $$, $$ values (null::text) $$,
  'the next /64 counts apart');
reset role;
select is(private.pairing_client(' 203.0.113.10 '), '203.0.113.10', 'an IPv4 address counts by itself');
select is(private.pairing_client('::ffff:203.0.113.10'), '203.0.113.10', 'even written the IPv6 way');
select is(private.pairing_client('not:an address'), 'not:an address', 'and anything else as it came');
insert into private.tv_pairing (code_hash, secret_hash, client, expires_at)
select 'filler-' || n, 'filler-' || n, 'filler-' || n, now() + interval '15 minutes' from generate_series(1, 136) as n;
set local role service_role;
select results_eq($$ select refusal from public.start_tv_pairing('192.0.2.30') $$, $$ values ('too_many'::text) $$,
  'two hundred requests in ten minutes, and every address waits');
reset role;

select * from finish();
rollback;
