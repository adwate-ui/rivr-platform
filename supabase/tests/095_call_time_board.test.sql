-- The leaving list and the TV's call-time board (decision 0163). The floor (103) marks a seated player
-- leaving and takes it back; a dealer (106) cannot. A TV reads the call-time board, every seated player
-- as a first name and initial with their call time left, while it shows it as its main mode or in its
-- rotation, and only then; a hidden name stays hidden. A TV's rotation names each board once and never
-- its main one. Every table's call time is 180 minutes (seed, #634); 211 Ishaan
-- and 212 Vihaan have finished their identity check.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test seats its own players.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.signals(p_topic text, p_event text) returns integer language sql as $$
  select count(*)::integer from realtime.messages m where m.topic = p_topic and m.event = p_event and m.inserted_at >= now();
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- A paired TV at the club on the waitlist board.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e951', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000951');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d951', '00000000-0000-4000-8000-000000000001', 'tv', 'Rail TV', '00000000-0000-4000-8000-00000000e951');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d951', '00000000-0000-4000-8000-000000000001', 'waitlist');

-- The floor seats two players.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Private Room'), 1, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000212');

-- Leaving.
select lives_ok($$ select public.set_leaving((select id from ids where name = 'ishaan'), true) $$, 'the floor marks Ishaan leaving');
select ok((select leaving_at is not null from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma'),
  'the floor''s seat map says he is leaving');
reset role;
select is((select leaving_by_staff_id from public.seat_session where id = (select id from ids where name = 'ishaan')),
  (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001'),
  'and who marked it');
select ok(pg_temp.signals('tv:00000000-0000-4000-8000-000000000001', 'call_time') > 0, 'the venue''s TVs are told the call-time board changed');
create temp table marked on commit drop as select leaving_at from public.seat_session where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_leaving((select id from ids where name = 'ishaan'), true) $$, 'marking him again changes nothing');
reset role;
select is((select leaving_at from public.seat_session where id = (select id from ids where name = 'ishaan')), (select leaving_at from marked),
  'he keeps the time he was first marked');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_leaving((select id from ids where name = 'vihaan'), true) $$, '42501', null, 'a dealer cannot mark a player leaving');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_leaving(gen_random_uuid(), true) $$, '42501', null, 'nor anyone a seat that is not there');
select throws_ok($$ select public.set_leaving((select id from ids where name = 'vihaan'), null) $$, '22023', null, 'leaving is yes or no');

-- The call-time board, while a TV shows it.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select is_empty($$ select * from public.tv_call_time_board() $$, 'a TV on the waitlist board reads no call-time board');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-00000000d951', array['call_time', 'promotions']::public.tv_mode[]) $$,
  'the floor manager has the TV turn to the call-time board and the promotions after the waitlist');
select throws_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-00000000d951', array['waitlist']::public.tv_mode[]) $$, '22023', null,
  'a rotation never names the main board');
select throws_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-00000000d951', array['jackpot', 'jackpot']::public.tv_mode[]) $$, '22023', null,
  'nor a board twice');
select throws_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-00000000d951', null) $$, '22023', null, 'and is a list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-00000000d951', '{}') $$, '42501', null, 'a dealer cannot change a TV''s rotation');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select results_eq($$ select mode, rotation from public.my_tv_screen() $$,
  $$ values ('waitlist'::public.tv_mode, array['call_time', 'promotions']::public.tv_mode[]) $$, 'the TV reads what it turns to');
select results_eq($$ select table_name, seat, display_name, call_time_left, is_away, leaving_at is not null from public.tv_call_time_board() $$,
  $$ values ('Table 3'::text, 2, 'Vihaan K.'::text, 10800, false, false), ('Private Room', 1, 'Ishaan V.', 10800, false, true) $$,
  'in its rotation, the TV reads every seated player by table: a first name and initial, call time left, and who is leaving');
select ok(exists (select 1 from public.tv_waitlist_board()), 'and still its waitlist board');
select ok(not exists (select 1 from public.tv_call_time_board() where display_name in ('Ishaan Verma', 'Vihaan Kapoor')), 'never a full name');
-- Vihaan's three hours are played: not leaving, he is not on the board.
reset role;
update public.seat_session set started_at = started_at - interval '181 minutes' where id = (select id from ids where name = 'vihaan');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select is_empty($$ select * from public.tv_call_time_board() where seat = 2 $$, 'a player whose call time is done, not leaving, is not sent to the TV');
reset role;
update public.seat_session set started_at = started_at + interval '181 minutes' where id = (select id from ids where name = 'vihaan');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');

-- A hidden name stays hidden.
reset role;
insert into public.member_preference (member_id, venue_id, name_on_tvs)
select m.id, m.venue_id, false from public.member m where m.full_name = 'Vihaan Kapoor' and m.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict (member_id) do update set name_on_tvs = false;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select is((select display_name from public.tv_call_time_board() where seat = 2), null, 'a member who hid their name is only their seat');

-- The main mode moved to a board in the rotation leaves the rotation.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tv_mode('00000000-0000-4000-8000-00000000d951', 'call_time') $$, 'the call-time board becomes the main one');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select results_eq($$ select mode, rotation from public.my_tv_screen() $$,
  $$ values ('call_time'::public.tv_mode, array['promotions']::public.tv_mode[]) $$, 'and leaves the rotation');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'the waitlist is no longer on the TV, so it reads no names there');
select is((select count(*)::integer from public.tv_call_time_board()), 2, 'but reads the call-time board');

-- Taken back, and gone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_leaving((select id from ids where name = 'ishaan'), false) $$, 'the floor takes the leaving back');
select ok((select leaving_at is null from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma'),
  'and the seat map no longer says it');
select lives_ok($$ select public.end_seat((select id from ids where name = 'vihaan'), 'left') $$, 'Vihaan leaves');
select throws_ok($$ select public.set_leaving((select id from ids where name = 'vihaan'), true) $$, '22023', null,
  'a player no longer seated cannot be marked leaving');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e951');
select results_eq($$ select display_name from public.tv_call_time_board() $$, $$ values ('Ishaan V.'::text) $$, 'the board shows only who is seated');

-- Nobody but a TV reads it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.tv_call_time_board() $$, 'staff read no TV board');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.tv_call_time_board() $$, 'nor does a member');

select * from finish();
rollback;
