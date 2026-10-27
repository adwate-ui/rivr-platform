-- CCTV references (#122; tech plan item 17; decision 0238). Aditya (103, an admin who manages devices) puts a camera
-- over Table 2 and one on the cage. A hand at Table 2 then carries Table 2's camera and its moment; a cash buy-in at
-- the cage the cage's; an incident the camera its logger chose. The reference answers only for a row the caller may
-- read. Sana (104, a cashier) keeps no cameras; Leela (154, a super admin at the club only) sees none of the practice
-- venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table tables as select id, name from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on tables to authenticated;

-- Cameras a local e2e run left at the club, retired so this test starts from none in use.
update public.camera set is_active = false where venue_id = '00000000-0000-4000-8000-000000000001';

-- Only staff who manage devices keep the cameras.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Table 2 overhead', '2', false, true) $$,
  '42501', null, 'a cashier adds no camera');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'table2', public.save_camera('00000000-0000-4000-8000-000000000001', 'Table 2 overhead', 'ch-2', false, true,
  p_table_id => (select id from tables where name = 'Table 2'));
insert into ids select 'cage', public.save_camera('00000000-0000-4000-8000-000000000001', 'Cage', 'ch-9', true, true);
select results_eq($$ select name, channel, table_name, is_cage from public.cameras('00000000-0000-4000-8000-000000000001') where is_active $$,
  $$ values ('Cage'::text, 'ch-9'::text, null::text, true), ('Table 2 overhead', 'ch-2', 'Table 2', false) $$,
  'a camera over Table 2 and one on the cage');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Second over Table 2', 'ch-22', false, true,
                                              p_table_id => (select id from tables where name = 'Table 2')) $$,
  '23505', null, 'a table has one active camera');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Bad channel', 'ch 2/3', false, true) $$,
  '22023', null, 'a channel is letters, digits and . _ : -');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Dots', '..', false, true) $$,
  '22023', null, 'and never dots alone');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Cage', 'ch-10', true, true, (select id from ids where name = 'cage')) $$,
  '22023', null, 'a camera keeps its channel, so what it filmed stays found');
select throws_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Elsewhere', 'ch-5', false, true,
                                              p_table_id => (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002' limit 1)) $$,
  '22023', null, 'and a table is this venue''s');

-- A hand at Table 2 carries its camera and its moment.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e140', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001401');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d140', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet CCTV', '00000000-0000-4000-8000-00000000e140');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c140', '00000000-0000-4000-8000-000000000001', g.id, s.id, '00000000-0000-4000-8000-00000000d140',
       '2026-01-04T20:00:00+05:30', '2026-01-04T22:00:00+05:30'
from public.staff s cross join tables g
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                         played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'holdem', 1000000, 50000, 10000, false, '2026-01-04T21:00:07+05:30', 'cctv-hand-1'
from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c140';
insert into ids select 'hand', id from public.hand where idempotency_key = 'cctv-hand-1';
select is((select camera_id from public.hand where id = (select id from ids where name = 'hand')), (select id from ids where name = 'table2'),
  'a hand carries its table''s camera');

-- A cash buy-in at the cage carries the cage's camera.
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'cctv-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001'
                                                      and code = 'venue.bank' and member_id is null), 'amount', '2000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211'
                                                      and code = 'member.cash'), 'amount', '-2000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from tables where name = 'Table 3'), 1, '9000000211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'buy_in', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash',
  '00000000-0000-4000-8000-0000000c0140');
select is((select camera_id from public.cage_transaction where id = (select id from ids where name = 'buy_in')), (select id from ids where name = 'cage'),
  'a cage transaction carries the cage''s camera');

-- An incident carries the camera its logger chose, of this venue only.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
insert into public.incident (venue_id, occurred_at, severity, summary, camera_id)
values ('00000000-0000-4000-8000-000000000001', '2026-01-04T21:30:15+05:30', 'low', 'Spilled drink at Table 2', (select id from ids where name = 'table2'));
reset role;
insert into ids select 'incident', id from public.incident where summary = 'Spilled drink at Table 2';
insert into public.camera (id, venue_id, name, channel) values ('00000000-0000-4000-8000-0000000ca140', '00000000-0000-4000-8000-000000000002', 'Practice cage', 'p-1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ insert into public.incident (venue_id, occurred_at, severity, summary, camera_id)
                    values ('00000000-0000-4000-8000-000000000001', now(), 'low', 'Another venue''s camera', '00000000-0000-4000-8000-0000000ca140') $$,
  '23503', null, 'an incident takes only this venue''s cameras');

-- The reference: the channel and the moment, for a row the caller may read.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select channel, camera_name, at, is_practice from public.cctv_reference('hand', (select id from ids where name = 'hand')) $$,
  $$ values ('ch-2'::text, 'Table 2 overhead'::text, '2026-01-04T21:00:07+05:30'::timestamptz, false) $$, 'a hand''s reference: Table 2 at 21:00:07');
select results_eq($$ select channel from public.cctv_reference('cage_transaction', (select id from ids where name = 'buy_in')) $$,
  $$ values ('ch-9'::text) $$, 'a buy-in''s: the cage');
select results_eq($$ select channel, at from public.cctv_reference('incident', (select id from ids where name = 'incident')) $$,
  $$ values ('ch-2'::text, '2026-01-04T21:30:15+05:30'::timestamptz) $$, 'an incident''s: the camera chosen, at the moment it happened');
select is_empty($$ select * from public.cctv_reference('hand', gen_random_uuid()) $$, 'nothing for no such row');
select is_empty($$ select * from public.cctv_reference('table', (select id from ids where name = 'hand')) $$, 'nor for another kind');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select is_empty($$ select * from public.cctv_reference('hand', (select id from ids where name = 'hand')) $$,
  'the front desk, who cannot read the hand, gets no reference to it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.cctv_reference('cage_transaction', (select id from ids where name = 'buy_in')) $$,
  'a member gets no reference to their own buy-in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000154');
select is_empty($$ select * from public.camera where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'staff of one venue see none of another''s cameras');

-- Retired, a camera films nothing new; the hand keeps the camera it had.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.save_camera('00000000-0000-4000-8000-000000000001', 'Table 2 overhead', 'ch-2', false, false,
                                             (select id from ids where name = 'table2'), (select id from tables where name = 'Table 2')) $$, 'a camera retired');
reset role;
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                         played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'holdem', 1000000, 50000, 10000, false, '2026-01-04T21:05:00+05:30', 'cctv-hand-2'
from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c140';
select is((select camera_id from public.hand where idempotency_key = 'cctv-hand-2'), null, 'a later hand has no camera');
select is((select camera_id from public.hand where id = (select id from ids where name = 'hand')), (select id from ids where name = 'table2'),
  'the earlier one keeps its');
select ok(exists (select 1 from public.audit_log where entity = 'camera' and action = 'update'), 'camera changes are audited');

select * from finish();
rollback;
