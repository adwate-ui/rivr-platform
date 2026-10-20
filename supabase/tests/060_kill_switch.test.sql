-- The kill switch (#27; additions flow 15). 101 and 102 are super admins; 110 an admin. Tablet A is
-- fixed to Table 3, where the floor (103) seats Ishaan Verma (211). Kabir Sethi (202) is a member;
-- 104 a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.staff(p_person text) returns uuid language sql as $$
  select id from public.staff where user_id = p_person::uuid and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text), pg_temp.staff(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 9, '9000000211');

-- Who engages, and what each level needs.
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Dispute at Table 3') $$,
  '42501', null, 'an admin cannot engage the kill switch');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'no') $$, '22023', null, 'a reason is needed');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'feature_kill', 'Bank outage') $$, '22023', null,
  'switching a feature off names the feature');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'member_freeze', 'Dispute', null,
  '00000000-0000-4000-8000-000000000301') $$, '22023', null, 'a member freeze names a member of this venue');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'access_revoke', 'Lost phone', null, null,
  pg_temp.staff('00000000-0000-4000-8000-000000000101')) $$, '22023', null, 'a super admin never revokes their own access');

-- Flow 15: a super admin freezes the venue; a tablet buy-in is refused; a second releases it.
insert into ids select 'freeze', public.engage_control('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Dispute at Table 3');
select is(public.engage_control('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Again'), (select id from ids where name = 'freeze'),
  'freezing again gives the freeze already engaged');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.request_buy_in((select id from ids where name = 'ishaan'), 1000000, gen_random_uuid()) $$, 'RVFRZ', null,
  'while frozen, the tablet''s buy-in is refused');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select level::text, reason, engaged_by from public.engaged_controls('00000000-0000-4000-8000-000000000001') $$,
  $$ select 'venue_freeze'::text, 'Dispute at Table 3'::text, (select full_name from public.staff where id = pg_temp.staff('00000000-0000-4000-8000-000000000101')) $$,
  'the super admin sees it engaged, why and by whom');
select throws_ok($$ select public.release_control((select id from ids where name = 'freeze'), 'ok') $$, '22023', null, 'a release needs a reason');
select is(public.release_control((select id from ids where name = 'freeze'), 'Dispute settled'), 'awaiting_second', 'the first super admin asks');
select throws_ok($$ select public.release_control((select id from ids where name = 'freeze')) $$, 'RVTWO', null, 'and cannot release it alone');
select results_eq($$ select release_asked_by, release_reason from public.engaged_controls('00000000-0000-4000-8000-000000000001') $$,
  $$ select (select full_name from public.staff where id = pg_temp.staff('00000000-0000-4000-8000-000000000101')), 'Dispute settled'::text $$,
  'the ask shows who and why');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(public.release_control((select id from ids where name = 'freeze')), 'released', 'a second super admin releases it');
select is_empty($$ select * from public.engaged_controls('00000000-0000-4000-8000-000000000001') $$, 'and nothing is engaged');
select throws_ok($$ select public.release_control((select id from ids where name = 'freeze'), 'Twice') $$, '22023', null, 'a released control stays released');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select isnt(public.request_buy_in((select id from ids where name = 'ishaan'), 1000000, gen_random_uuid()), null, 'the tablet asks the cage again');
reset role;
select results_eq($$ select released_by_staff_id, release_second_staff_id from public.control_state where id = (select id from ids where name = 'freeze') $$,
  $$ select pg_temp.staff('00000000-0000-4000-8000-000000000101'), pg_temp.staff('00000000-0000-4000-8000-000000000102') $$,
  'two different super admins released it');

-- The other levels: one step to release, each with its target.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'credit', public.engage_control('00000000-0000-4000-8000-000000000001', 'feature_kill', 'Bank outage', 'credit');
insert into ids select 'kabir', public.engage_control('00000000-0000-4000-8000-000000000001', 'member_freeze', 'Chargeback', null,
  '00000000-0000-4000-8000-000000000202');
insert into ids select 'cashier', public.engage_control('00000000-0000-4000-8000-000000000001', 'access_revoke', 'Lost phone', null, null,
  pg_temp.staff('00000000-0000-4000-8000-000000000104'));
insert into ids select 'messages', public.engage_control('00000000-0000-4000-8000-000000000001', 'messaging_stop', 'Wrong offer sent');
select is((select count(*)::integer from public.engaged_controls('00000000-0000-4000-8000-000000000001')), 4, 'four engaged at once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.cage_members('00000000-0000-4000-8000-000000000001', 'Kabir') $$, 'the revoked cashier''s access has ended');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.release_control((select id from ids where name = 'credit'), 'Bank back'), 'released', 'a feature comes back on in one step');
select is(public.release_control((select id from ids where name = 'cashier'), 'Phone found'), 'released', 'and access comes back');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'control.engaged'), 5, 'control.engaged for each');
select is((select count(*)::integer from public.outbox_event where event_type = 'control.released'), 3, 'control.released for each release');
select is((select count(*)::integer from public.alert where kind like 'control.%'), 9, 'and the owner is alerted at every step, the freeze''s ask too');
select ok((select count(*) from public.audit_log where entity = 'control_state') >= 9, 'every change is in the audit log');

-- Never fewer than two super admins able to release a freeze: with only 101 and 102 left, neither
-- revokes the other, and with 101 alone no freeze is engaged.
reset role;
update public.staff s set is_active = false
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'super_admin'
  and s.user_id not in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'access_revoke', 'Lost phone', null, null,
  pg_temp.staff('00000000-0000-4000-8000-000000000102')) $$, 'RVLCK', null, 'the last two super admins cannot revoke each other');
reset role;
update public.staff set is_active = false where id = pg_temp.staff('00000000-0000-4000-8000-000000000102');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.engage_control('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Alone') $$, 'RVLCK', null,
  'and a lone super admin cannot freeze what nobody could release');
reset role;

select * from finish();
rollback;
