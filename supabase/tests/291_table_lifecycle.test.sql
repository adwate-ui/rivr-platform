-- Tables come and go (decision 0466). The super admin (101 Vikram) and an admin (103 Aditya) hold tables.manage; a host
-- (111 Zoya) and another venue's admin do not. A table is deactivated or deleted only with nobody seated at it (RVSTD) and
-- nobody on its list (RVWTG), seated first, as @rivr/domain tableRetireRefusal says. Deactivated, it is gone from every live
-- read and comes back closed; deleted, setup lists it no more and reports keep it. Ishaan (211) and Vihaan (212) have
-- finished the check; Table 5 is open and empty at 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716), as in 029.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into ids values ('table 5', pg_temp.table_id('Table 5'));

-- Another venue's admin; Ishaan sees the floor and joins lists whatever his tier says; a TV at the club on the waitlist board.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000e291', 'authenticated', 'authenticated', '999000000000291', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', f, true, 'test 291'
from unnest(array['waitlist.join', 'floor.live_view']) f
on conflict do nothing;
insert into public.device (id, venue_id, kind, name, auth_user_id)
values ('00000000-0000-4000-8000-00000000d291', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e291');
insert into public.tv_screen (device_id, venue_id, mode) values ('00000000-0000-4000-8000-00000000d291', '00000000-0000-4000-8000-000000000001', 'waitlist');

-- Who may: nobody but tables.manage at the venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, '42501', null, 'a host takes no table away');
select throws_ok($$ select public.delete_game_table((select id from ids where name = 'table 5')) $$, '42501', null, 'nor deletes one');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, '42501', null,
  'another venue''s admin takes none of the club''s away');
reset role;
select is(has_function_privilege('anon', 'public.delete_game_table(uuid)', 'execute'), false, 'nobody signed out deletes a table');

-- In play: Ishaan sits at Table 5 and Vihaan waits on its list. Seated is the first reason, then waiting.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_must_move(pg_temp.table_id('Table 3'), (select id from ids where name = 'table 5')) $$, 'Table 3 feeds Table 5');
insert into ids select 'seat', public.seat_member((select id from ids where name = 'table 5'), 2, '9000000211');
insert into ids select 'vihaan', public.add_to_waitlist((select id from ids where name = 'table 5'), '9000000212', gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, 'RVSTD', null,
  'no table is taken away with a player seated at it');
select throws_ok($$ select public.delete_game_table((select id from ids where name = 'table 5')) $$, 'RVSTD', null, 'nor deleted');
reset role;
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from ids where name = 'seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, 'RVWTG', null,
  'nor with a place waiting on its list');
select throws_ok($$ select public.delete_game_table((select id from ids where name = 'table 5')) $$, 'RVWTG', null, 'nor deleted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.leave_waitlist((select id from ids where name = 'vihaan')) $$, 'the floor takes Vihaan off the list');

-- Deactivated: inactive and closed, feeding nothing and fed by nothing, its history kept.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, 'the super admin deactivates Table 5');
select lives_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, 'again is nothing');
reset role;
select results_eq($$ select active, is_open, deleted_at is null from public.game_table where id = (select id from ids where name = 'table 5') $$,
  $$ values (false, false, true) $$, 'Table 5 is inactive and closed');
select is((select must_move_to_table_id from public.game_table where id = pg_temp.table_id('Table 3')), null, 'and Table 3 feeds it no more');
select ok((select closed_at is not null from public.table_run where table_id = (select id from ids where name = 'table 5') order by opened_at desc limit 1),
  'its run tonight is closed and kept');

-- Gone from every live read.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.game_table where id = (select id from ids where name = 'table 5') $$, 'the player app''s tables leave it out');
select is_empty($$ select 1 from public.waitlist_lengths() where table_id = (select id from ids where name = 'table 5') $$, 'and its wait');
select is_empty($$ select 1 from public.floor_open_seats() where table_id = (select id from ids where name = 'table 5') $$, 'and its open seats');
select throws_ok($$ select public.join_waitlist_at((select id from ids where name = 'table 5'), gen_random_uuid()) $$, '22023', null,
  'and nobody joins its list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.floor_tonight('00000000-0000-4000-8000-000000000001') where table_id = (select id from ids where name = 'table 5') $$,
  'the live floor leaves it out');
select is_empty($$ select 1 from public.interest_lists('00000000-0000-4000-8000-000000000001') where table_id = (select id from ids where name = 'table 5') $$,
  'and the interest lists');
select throws_ok($$ select public.add_to_waitlist((select id from ids where name = 'table 5'), '9000000212', gen_random_uuid()) $$, '22023', null,
  'the floor adds nobody to its list');
select throws_ok($$ select public.set_table_open((select id from ids where name = 'table 5'), true) $$, '22023', null, 'nor opens it');
select throws_ok($$ select public.set_must_move(pg_temp.table_id('Table 3'), (select id from ids where name = 'table 5')) $$, '22023', null,
  'nor has a table feed it');
select results_eq($$ select active from public.game_table where id = (select id from ids where name = 'table 5') $$, $$ values (false) $$,
  'while setup still lists it, marked inactive');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e291');
select is_empty($$ select 1 from public.tv_waitlist_board() where table_id = (select id from ids where name = 'table 5') $$, 'the TVs leave it out');
reset role;
select is_empty($$ select 1 from public.public_table_status where table_name = 'Table 5' and venue_slug = (select slug from public.venue
                   where id = '00000000-0000-4000-8000-000000000001') $$, 'and so does the website');

-- Reactivated: back, closed until the floor opens it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.reactivate_game_table((select id from ids where name = 'table 5')) $$, 'an admin reactivates Table 5');
select results_eq($$ select active, is_open from public.game_table where id = (select id from ids where name = 'table 5') $$,
  $$ values (true, false) $$, 'it is back, closed');
select lives_ok($$ select public.set_table_open((select id from ids where name = 'table 5'), true) $$, 'and the floor may open it again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select isnt_empty($$ select 1 from public.game_table where id = (select id from ids where name = 'table 5') $$, 'the player app shows it again');

-- Deleted: for good, out of setup, its history kept for reports.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.delete_game_table((select id from ids where name = 'table 5')) $$, 'the super admin deletes Table 5');
select lives_ok($$ select public.delete_game_table((select id from ids where name = 'table 5')) $$, 'again is nothing');
select is_empty($$ select 1 from public.game_table where id = (select id from ids where name = 'table 5') $$, 'setup lists it no more');
select throws_ok($$ select public.reactivate_game_table((select id from ids where name = 'table 5')) $$, '22023', null, 'a deleted table never comes back');
select throws_ok($$ select public.deactivate_game_table((select id from ids where name = 'table 5')) $$, '22023', null, 'nor is it deactivated');
select throws_ok($$ select public.set_game_table((select id from ids where name = 'table 5'), 'Table 5', pg_temp.table_id('Table 2'), 9) $$,
  '22023', null, 'nor changed');
select ok(exists (select 1 from public.games_history('00000000-0000-4000-8000-000000000001', current_date - 30, current_date + 1)
                  where table_id = (select id from ids where name = 'table 5')), 'the games history keeps its runs');
reset role;
select results_eq($$ select active, is_open, deleted_at is not null from public.game_table where id = (select id from ids where name = 'table 5') $$,
  $$ values (false, false, true) $$, 'the row stays, inactive, closed and deleted, for its hands, seats and runs');
select throws_ok($$ update public.game_table set active = true where id = (select id from ids where name = 'table 5') $$, '23514', null,
  'and nothing makes a deleted table active again');

-- Not while the venue is frozen.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.deactivate_game_table(pg_temp.table_id('Table 4')) $$, 'RVFRZ', null, 'nobody takes a table away while frozen');
reset role;

select * from finish();
rollback;
