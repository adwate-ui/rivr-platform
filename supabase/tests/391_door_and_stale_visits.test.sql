-- The door tells members apart (audit F-020), someone who never checked in is not 'left' (F-097), and a visit from an
-- earlier club day closes without the member coming back (F-016), once any stop on it is released.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create function pg_temp.visit(p_id uuid, p_member uuid, p_opened timestamptz) returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at) values (p_id, '00000000-0000-4000-8000-000000000001', p_member, p_opened);
$$;

-- The door's rows.
create temp table black as
  select m.id, m.member_number from public.member m join public.tier t on t.id = m.tier_id
  where m.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Black card'
    and not exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null) limit 1;
grant select on black to authenticated;
select pg_temp.visit('00000000-0000-4000-8000-0000000c3901', (select id from black), now());
select pg_temp.visit('00000000-0000-4000-8000-0000000c3902', '00000000-0000-4000-8000-000000000213', now());
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select member_number, is_base_tier from public.door_board('00000000-0000-4000-8000-000000000001') where member_id = (select id from black) $$,
  $$ select member_number, false from black $$, 'a Black card member has their number and a tier worth saying');
select is((select is_base_tier from public.door_board('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000213'), true,
  'a member on the base tier does not');
reset role;

-- Today's players: someone who dropped off a list without checking in.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, status, left_at, left_reason)
select venue_id, '00000000-0000-4000-8000-000000000214', table_type_id, id, gen_random_uuid(), 'left', now(), 'left'
from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1';
select pg_temp.visit('00000000-0000-4000-8000-0000000c3903', '00000000-0000-4000-8000-000000000215', now());
update public.visit set closed_at = now(), close_reason = 'door' where id = '00000000-0000-4000-8000-0000000c3903';
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, status, left_at, left_reason)
select venue_id, '00000000-0000-4000-8000-000000000215', table_type_id, id, gen_random_uuid(), 'left', now(), 'left'
from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select status from public.todays_players('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000214'), 'never_arrived',
  'one who dropped off a list without checking in never arrived');
select is((select status from public.todays_players('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000215'), 'left',
  'one who checked in and went home left');
select is((select status from public.todays_players('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000213'), 'in_room',
  'one checked in with no seat or list is in the room');
reset role;
-- Checked in before 06:00 and gone after it: they arrived, on a visit that began the day before.
select pg_temp.visit('00000000-0000-4000-8000-0000000c3908', '00000000-0000-4000-8000-000000000217', private.tonight_began(now()) - interval '30 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', '00000000-0000-4000-8000-0000000c3908', g.id, 8,
       private.tonight_began(now()) + interval '1 second', private.tonight_began(now()) + interval '1 second', private.tonight_began(now()) + interval '2 seconds', 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4';
update public.visit set closed_at = private.tonight_began(now()) + interval '3 seconds', close_reason = 'door' where id = '00000000-0000-4000-8000-0000000c3908';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select status from public.todays_players('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000217'), 'left',
  'one whose visit ran across 06:00 arrived, and left');
reset role;

-- Visits from an earlier club day.
select pg_temp.visit('00000000-0000-4000-8000-0000000c3904', '00000000-0000-4000-8000-000000000216', now() - interval '2 days');
select pg_temp.visit('00000000-0000-4000-8000-0000000c3905', '00000000-0000-4000-8000-000000000290', now() - interval '2 days');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', '00000000-0000-4000-8000-0000000c3905', g.id, 9, now() - interval '2 days', now() - interval '2 days'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4';
select pg_temp.visit('00000000-0000-4000-8000-0000000c3906', '00000000-0000-4000-8000-000000000211', now());
select lives_ok($$ select private.close_stale_visits() $$, 'the morning''s job runs');
select results_eq($$ select closed_at = opened_at, close_reason from public.visit where id = '00000000-0000-4000-8000-0000000c3904' $$,
  $$ values (true, 'end_of_day'::text) $$, 'a visit with nothing open in it closes, at its last moment');
select ok((select closed_at is null from public.visit where id = '00000000-0000-4000-8000-0000000c3905'), 'one with a seat still open waits for the floor');
select ok((select closed_at is null from public.visit where id = '00000000-0000-4000-8000-0000000c3906'), 'one from tonight is left alone');
select isnt_empty($$ select 1 from cron.job where jobname = 'close-stale-visits' and schedule = '40 5 * * *' $$, 'pg_cron runs it at 11:10 IST');

-- A stop in force holds it, and it closes once the stop is released.
select pg_temp.visit('00000000-0000-4000-8000-0000000c3907', '00000000-0000-4000-8000-000000000212', now() - interval '2 days');
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id, engaged_at)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 391 freeze', s.id, now()
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select lives_ok($$ select private.close_stale_visits() $$, 'the job runs during a freeze');
select ok((select closed_at is null from public.visit where id = '00000000-0000-4000-8000-0000000c3907'), 'and closes nothing, as closing credits points');
update public.control_state set released_at = now(), release_reason = 'test 391 over', released_by_staff_id = engaged_by_staff_id,
  release_second_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where reason = 'test 391 freeze';
select lives_ok($$ select private.close_stale_visits() $$, 'the next run, once released');
select is((select close_reason from public.visit where id = '00000000-0000-4000-8000-0000000c3907'), 'end_of_day', 'closes it');

select * from finish();
rollback;
