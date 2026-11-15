-- A stake's straddle on every read that names a stake (issue 990): the member's place on a list, seat and past sessions,
-- the TV's two boards and the dealer tablet's seats. The Private Room plays 100/200 with a 500 straddle (the seed);
-- Table 3 plays 100/200 with none. 103 Ishaan Grover is the floor; 211 Ishaan Verma sits, 212 Vihaan waits, 213 Mihir
-- played yesterday.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor is set aside, so this test seats its own players.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;

select is((select tt.straddle_paise from public.table_type tt join public.game_table g on g.table_type_id = tt.id where g.id = pg_temp.t('Private Room')),
  50000::bigint, 'the Private Room''s stake has a straddle of 500');
select is((select tt.straddle_paise from public.table_type tt join public.game_table g on g.table_type_id = tt.id where g.id = pg_temp.t('Table 3')),
  null, 'and Table 3''s has none');

-- A TV on each board and a dealer tablet at the Private Room.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e431', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000431'),
  ('00000000-0000-4000-8000-00000000e432', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000432'),
  ('00000000-0000-4000-8000-00000000e433', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000433');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d431', '00000000-0000-4000-8000-000000000001', 'tv', 'Waitlist TV', '00000000-0000-4000-8000-00000000e431'),
  ('00000000-0000-4000-8000-00000000d432', '00000000-0000-4000-8000-000000000001', 'tv', 'Call time TV', '00000000-0000-4000-8000-00000000e432'),
  ('00000000-0000-4000-8000-00000000d433', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet 433', '00000000-0000-4000-8000-00000000e433');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d431', '00000000-0000-4000-8000-000000000001', 'waitlist'),
  ('00000000-0000-4000-8000-00000000d432', '00000000-0000-4000-8000-000000000001', 'call_time');
insert into public.tablet_assignment (device_id, venue_id, table_id)
values ('00000000-0000-4000-8000-00000000d433', '00000000-0000-4000-8000-000000000001', pg_temp.t('Private Room'));

-- Yesterday Mihir played an hour at the Private Room.
with v as (
  insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
  values (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '26 hours', now() - interval '24 hours', 'door')
  returning id
)
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', v.id, pg_temp.t('Private Room'), 5,
       now() - interval '25 hours 30 minutes', now() - interval '25 hours 30 minutes', now() - interval '24 hours 30 minutes', 'left', 0
from v;

-- Tonight the floor seats Ishaan at the Private Room and Vihaan at Table 3, and puts Mihir on the Private Room's list.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.t('Private Room'), 1, '9000000211');
select public.seat_member(pg_temp.t('Table 3'), 2, '9000000212');
select public.add_to_waitlist(pg_temp.t('Private Room'), '9000000213', gen_random_uuid());

-- The member's seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, game, small_blind_paise, big_blind_paise, straddle_paise from public.my_seat() $$,
  $$ values ('Private Room', 'nlh', 10000::bigint, 20000::bigint, 50000::bigint) $$, 'a member''s seat carries its stake''s game and straddle');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select table_name, straddle_paise from public.my_seat() $$, $$ values ('Table 3', null::bigint) $$, 'and none where the stake has none');

-- The member's place on a list, and their past sessions.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select table_name, game, straddle_paise from public.my_waitlist() $$, $$ values ('Private Room', 'nlh', 50000::bigint) $$,
  'a member''s place on a list carries its stake''s game and straddle');
select results_eq($$ select table_name, small_blind_paise, big_blind_paise, straddle_paise from public.my_sessions() where kind = 'cash' and opened_at < now() - interval '20 hours' $$,
  $$ values ('Private Room', 10000::bigint, 20000::bigint, 50000::bigint) $$, 'a past session carries the straddle of the stake it was played at');

-- The TV's boards.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e431');
select results_eq($$ select distinct table_name, game, straddle_paise from public.tv_waitlist_board() where table_name in ('Private Room', 'Table 3') order by 1 $$,
  $$ values ('Private Room', 'nlh', 50000::bigint), ('Table 3', 'nlh', null::bigint) $$, 'the waitlist board carries each table''s game and straddle');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e432');
select results_eq($$ select table_name, game, small_blind_paise, big_blind_paise, straddle_paise from public.tv_call_time_board() order by 1 $$,
  $$ values ('Private Room', 'nlh', 10000::bigint, 20000::bigint, 50000::bigint), ('Table 3', 'nlh', 10000::bigint, 20000::bigint, null::bigint) $$,
  'the call time board carries each table''s game, blinds and straddle');

-- The dealer tablet.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e433');
select results_eq($$ select distinct small_blind_paise, big_blind_paise, straddle_paise from public.tablet_seats() $$,
  $$ values (10000::bigint, 20000::bigint, 50000::bigint) $$, 'the tablet''s seats carry the straddle beside the blinds');

-- Grants are as before: signed-in people only.
reset role;
select is(has_function_privilege('anon', 'public.my_seat()', 'execute'), false, 'no one signed out reads a seat');
select is(has_function_privilege('anon', 'public.tv_waitlist_board()', 'execute'), false, 'nor the TV''s board');
select is(has_function_privilege('authenticated', 'public.my_sessions()', 'execute'), true, 'a signed-in member still reads their sessions');

select * from finish();
rollback;
