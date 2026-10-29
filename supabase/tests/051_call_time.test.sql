-- Call time (#78). From now, the Private Room's call time is 120 minutes and the cash tables' 60 (the seed's are
-- three hours, #634). 211 Ishaan and 212 Vihaan have finished their identity check; 103 is the floor; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select '00000000-0000-4000-8000-000000000001', 'call_time.minutes', c.code, jsonb_build_object('minutes', c.minutes), now(), 'Test'
from (values ('private_room', 120), ('nlh_50_100', 60), ('nlh_100_200', 60)) as c (code, minutes);

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
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.left_for(p_name text) returns integer language sql as $$
  select call_time_left from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = p_name;
$$;
grant execute on function pg_temp.left_for(text) to authenticated;

-- Seating fixes the call time of the table's type.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Private Room'), 1, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000212');
select is(pg_temp.left_for('Ishaan Verma'), 7200, 'seated in the Private Room: two hours to play');
select is(pg_temp.left_for('Vihaan Kapoor'), 3600, 'at 100/200: one hour');

-- Half an hour played, then 10 minutes away: they do not count.
reset role;
update public.seat_session set started_at = started_at - interval '30 minutes', seated_here_at = seated_here_at - interval '30 minutes'
where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.left_for('Ishaan Verma'), 5400, 'after half an hour, 90 minutes are left');
select lives_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), true) $$, 'Ishaan steps away');
reset role;
update public.seat_session set away_since = away_since - interval '10 minutes' where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.left_for('Ishaan Verma'), 6000, 'while he is away the clock stands at 20 minutes played');
select lives_ok($$ select public.set_seat_away((select id from ids where name = 'ishaan'), false) $$, 'and he is back');
select is((select away_seconds from public.seat_session where id = (select id from ids where name = 'ishaan')), 600, 'the 10 minutes away are kept');
select is(pg_temp.left_for('Ishaan Verma'), 6000, 'and do not count');

-- A move keeps the session and its call time, even to a table with another.
select lives_ok($$ select public.move_seat((select id from ids where name = 'ishaan'), pg_temp.t('Table 2'), 4) $$, 'Ishaan moves to Table 2');
select is(pg_temp.left_for('Ishaan Verma'), 6000, 'his clock runs on, with the Private Room''s two hours');

-- The tablet and the player read it too; call_time.view gates the player's.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'));
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is((select call_time_left from public.tablet_seats() where seat = 2), 3600, 'Table 3''s tablet sees Vihaan''s hour');
select is((select call_time_left from public.tablet_seats() where seat = 1), null::integer, 'and nothing for an open seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, seat, is_away, has_call_time, call_time_left from public.my_seat() $$,
  $$ values ('Table 2'::text, 4, false, true, 6000) $$, 'Ishaan sees his seat and his time left');
reset role;
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select venue_id, id, 'call_time.view', false, 'locked' from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, has_call_time, call_time_left from public.my_seat() $$,
  $$ values ('Table 2'::text, true, null::integer) $$, 'without call_time.view, his seat, and that it has call time, but not the time');
select throws_ok($$ select call_time_minutes, call_time_completed_at from public.seat_session $$, '42501', null,
  'nor can he read it from his sessions');
select is((select count(*)::integer from public.seat_session), 1, 'which he still sees');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.my_seat() $$, 'staff have no seat of their own');

-- Every minute: call_time.completed once per session, and the session reminder once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.set_session_reminder(4) $$, 'Vihaan asks for a reminder after 4 hours');
reset role;
update public.seat_session set started_at = started_at - interval '4 hours', seated_here_at = seated_here_at - interval '4 hours'
where id = (select id from ids where name = 'vihaan');
select lives_ok($$ select private.sweep_seated_time() $$, 'the minute''s sweep');
select lives_ok($$ select private.sweep_seated_time() $$, 'and the next');
select results_eq($$ select event_type, (payload ->> 'member_id')::uuid from public.outbox_event
                     where event_type in ('call_time.completed', 'session.reminder') order by event_type $$,
  $$ values ('call_time.completed'::text, '00000000-0000-4000-8000-000000000212'::uuid),
            ('session.reminder', '00000000-0000-4000-8000-000000000212'::uuid) $$,
  'Vihaan''s call time is complete and his reminder sent, each once; Ishaan has time left and no reminder');

-- Leaving within the minute of completing still emits call_time.completed, once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'mihir', public.seat_member(pg_temp.t('Table 3'), 5, '9000000213');
reset role;
update public.seat_session set started_at = started_at - interval '61 minutes', seated_here_at = seated_here_at - interval '61 minutes'
where id = (select id from ids where name = 'mihir');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.end_seat((select id from ids where name = 'mihir'), 'left') $$, 'Mihir leaves after 61 minutes, before any sweep');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213'), 1, 'his call time.completed is emitted as he leaves');
select lives_ok($$ select private.sweep_seated_time() $$, 'a sweep after');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213'), 1, 'emits it no second time');

-- Leaving early leaves a shortfall the cage and the door can read.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.end_seat((select id from ids where name = 'ishaan'), 'left') $$, 'Ishaan leaves early');
reset role;
select is(private.call_time_shortfall('00000000-0000-4000-8000-000000000211', now() + interval '2 hours'), 6000,
  'his shortfall stays what was left when he went');
select is(private.call_time_shortfall('00000000-0000-4000-8000-000000000212', now()), 0, 'Vihaan owes nothing');
select is(private.call_time_shortfall('00000000-0000-4000-8000-000000000204', now()), 0, 'nor does someone never seated');
select is(private.call_time_remaining('00000000-0000-4000-8000-000000000211', now()), null::integer, 'Ishaan, gone, has no seat to play out');
select is(private.call_time_remaining('00000000-0000-4000-8000-000000000212', now()), 0, 'Vihaan''s seat has none left');
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
select is(private.call_time_shortfall('00000000-0000-4000-8000-000000000211', now()), 0, 'once his visit is over, a past night''s shortfall is not owed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select private.call_time_shortfall('00000000-0000-4000-8000-000000000211', now()) $$, '42501', null,
  'the shortfall is read by the database, not by the apps');
reset role;

select * from finish();
rollback;
