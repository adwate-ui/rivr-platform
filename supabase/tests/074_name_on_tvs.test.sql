-- A member may hide their name on the room's TVs (#326, decision 0070): on by default; with it off, the
-- TV's waitlist board gives their place and no name, and turning it back on restores the first name and
-- initial. Each change tells the venue's TVs to read the board again. The seed has Kabir Sethi (202),
-- Naina Kapoor (203) and Rohan Bhatia (204) waiting for 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.signals() returns integer language sql as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'tv:00000000-0000-4000-8000-000000000001' and m.event = 'waitlist' and m.inserted_at >= now();
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- A paired TV at the club on the waitlist board.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e741', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000741');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d741', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e741');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d741', '00000000-0000-4000-8000-000000000001', 'waitlist');
create temporary table hundreds on commit drop as
select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200';
grant select on hundreds to authenticated;

create function pg_temp.board() returns table (place integer, display_name text) language sql as $$
  select b.place, b.display_name from public.tv_waitlist_board() b where b.table_type_id = (select id from hundreds) order by b.place;
$$;
grant execute on function pg_temp.board() to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-00000000e741');
select results_eq($$ select * from pg_temp.board() $$, $$ values (1, 'Kabir S.'::text), (2, 'Naina K.'::text), (3, 'Rohan B.'::text) $$,
  'every name is on the board by default');
reset role;

-- Naina, with no preferences saved yet, turns it off.
select is((select count(*)::integer from public.member_preference where member_id = '00000000-0000-4000-8000-000000000203'), 0,
  'Naina has saved no preferences');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.set_my_name_on_tvs(false) $$, 'Naina hides her name on the TVs');
select is((select name_on_tvs from public.member_preference), false, 'and reads it back as off');
reset role;
select is(pg_temp.signals(), 1, 'the club''s TVs are told to read the board again');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e741');
select results_eq($$ select * from pg_temp.board() $$, $$ values (1, 'Kabir S.'::text), (2, null::text), (3, 'Rohan B.'::text) $$,
  'the TV gets her place and no name');
select ok(not exists (select 1 from public.tv_waitlist_board() b where b.display_name ilike 'Naina%' or b.display_name ilike '%Kapoor%'),
  'her name is nowhere on the board');
reset role;

-- Saving her games keeps it off.
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.save_my_preferences(array['nlh'], 10000, 20000) $$, 'Naina saves her games and stake');
select is((select name_on_tvs from public.member_preference), false, 'her name stays off the TVs');
reset role;
select is(pg_temp.signals(), 1, 'saving games is no change to the board');

-- Kabir, with preferences saved, turns it off and back on.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.save_my_preferences(array['plo']) $$, 'Kabir has saved his games');
select lives_ok($$ select public.set_my_name_on_tvs(false) $$, 'and hides his name');
select lives_ok($$ select public.set_my_name_on_tvs(false) $$, 'twice');
reset role;
select is(pg_temp.signals(), 2, 'one signal for the change, none for the same choice again');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e741');
select results_eq($$ select * from pg_temp.board() $$, $$ values (1, null::text), (2, null::text), (3, 'Rohan B.'::text) $$,
  'the TV gets Kabir''s place and no name');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.set_my_name_on_tvs(true) $$, 'Kabir shows his name again');
select results_eq($$ select games, name_on_tvs from public.member_preference $$, $$ values (array['plo'], true) $$,
  'with his games as they were');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e741');
select results_eq($$ select * from pg_temp.board() $$, $$ values (1, 'Kabir S.'::text), (2, null::text), (3, 'Rohan B.'::text) $$,
  'the TV shows his first name and initial again');
reset role;
select is(pg_temp.signals(), 3, 'and was told to read the board again');

-- Only a member has the choice, and only their own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_my_name_on_tvs(false) $$, '42501', 'Only a member has preferences', 'staff who are not members have no such choice');
reset role;
select throws_ok($$ select public.set_my_name_on_tvs(null) $$, '42501', 'Only a member has preferences', 'nor does the database owner without a member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select throws_ok($$ update public.member_preference set name_on_tvs = true $$, '42501', null, 'a member changes it only through the function');
select throws_ok($$ select public.set_my_name_on_tvs(null) $$, '23502', null, 'and says on or off');
reset role;
set local role anon;
select throws_ok($$ select public.set_my_name_on_tvs(false) $$, '42501', null, 'a signed-out caller is refused');
reset role;

select * from finish();
rollback;
