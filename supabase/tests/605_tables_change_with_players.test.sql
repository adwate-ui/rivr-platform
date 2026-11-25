-- Tables change with players seated, and each stretch keeps its stake (the owner, 25 Nov; #1137, #1138). The floor sets up
-- tables; a stake changed with Ishaan (211) seated at Table 5 starts a new stretch for him, the play so far keeping the old
-- stake, for play-time Bonus, rake shares, the seat Bonus, the Players report and his sessions too; a move keeps the stake
-- of the stretch it ends; a stake games were played at stays; fewer seats than one taken is refused; a visit added
-- afterwards, a seat's end corrected to before the change, a late hand's rake and an undone leave keep the stake played;
-- and a table's stake at a past moment comes from the audit log. A host becomes the Floor member here, as the seed has none; 103 Aditya is a floor manager (admin).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null
                and h.user_id <> '00000000-0000-4000-8000-000000000108' order by h.user_id limit 1);
create temp table who on commit drop as
select (select min(s.user_id::text) from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'floor' and s.user_id is not null)::uuid as floor,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5') as t5,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3') as t3,
       (select table_type_id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5') as stake_a;
create temp table made (name text, id uuid) on commit drop;
grant select on who to authenticated;
grant select, insert on made to authenticated;
create function pg_temp.as_person(p_person uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.seat() returns uuid language sql security definer as $$
  select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
$$;
create function pg_temp.m(p_name text) returns uuid language sql as $$ select id from made where name = p_name $$;
grant execute on function pg_temp.as_person(uuid), pg_temp.seat(), pg_temp.m(text) to authenticated;

-- The floor sets up tables: two stakes of its own, ready to play.
select pg_temp.as_person((select floor from who));
insert into made select 'b', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 1000/2000 605', 100000, 200000, null, 120);
insert into made select 'c', public.add_table_type('00000000-0000-4000-8000-000000000001', 'NLH 2000/4000 605', 200000, 400000, null, 120);
select isnt(pg_temp.m('b'), null, 'the floor adds a stake');
select lives_ok(format('select public.add_game_table(%L, %L, %L, 9, 2000000)', '00000000-0000-4000-8000-000000000001', 'Table 605', pg_temp.m('b')),
  'and a table');

-- Ishaan sits at Table 5 two hours ago, at its stake.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select t5 from who), 2, '9000000211', p_call_minutes => 180);
reset role;
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours' where id = pg_temp.seat();
update public.visit set opened_at = now() - interval '2 hours' where id = (select visit_id from public.seat_session where id = pg_temp.seat());
select is((select table_type_id from public.seat_session where id = pg_temp.seat()), (select stake_a from who), 'a seat takes its table''s stake');

-- The floor changes Table 5's stake with him seated: he stays, and his play so far keeps the old stake.
select pg_temp.as_person((select floor from who));
select lives_ok(format('select public.set_game_table(%L, %L, %L, 9)', (select t5 from who), 'Table 5', pg_temp.m('b')),
  'a table''s stake changes with a player seated');
reset role;
select ok((select ended_at is null and table_type_id = pg_temp.m('b') and call_time_minutes = 180 from public.seat_session where id = pg_temp.seat()),
  'he stays seated, now at the new stake, with his minimum playing time');
select results_eq($$ select o_table_id, o_table_type_id from private.session_tables(pg_temp.seat()) order by o_from $$,
  $$ values ((select t5 from who), (select stake_a from who)), ((select t5 from who), pg_temp.m('b')) $$,
  'his seat is two stretches at Table 5: the old stake, then the new');
select is((select count(*)::integer from public.seat_move where session_id = pg_temp.seat()), 1, 'one stake change, on his seat');

-- Play-time Bonus at the old stake counts the two hours before; at the new stake, nothing yet.
create temp table rule on commit drop as
select jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text,
                          'timezone', 'Asia/Kolkata') as schedule;
select ok((select o_seconds from private.visit_schedule_time_at((select visit_id from public.seat_session where id = pg_temp.seat()), (select schedule from rule),
            jsonb_build_object('stakes', jsonb_build_array((select code from public.table_type where id = (select stake_a from who)))), now())) >= 7100,
  'play-time Bonus at the old stake counts the play before the change');
select is((select o_seconds from private.visit_schedule_time_at((select visit_id from public.seat_session where id = pg_temp.seat()), (select schedule from rule),
            jsonb_build_object('stakes', jsonb_build_array((select code from public.table_type where id = pg_temp.m('b')))), now())), 0::bigint,
  'and at the new stake none of it');

-- A hand sent late is raked by the stake its table had then: an hour ago, Table 5's rules were the old stake's, as Table 3's
-- (which plays it) still are; now they are b's, which has none.
select ok(exists (select 1 from private.rake_rules_at((select t5 from who), now() - interval '1 hour')), 'the old stake has rake rules');
select results_eq($$ select * from private.rake_rules_at((select t5 from who), now() - interval '1 hour') $$,
                  $$ select * from private.rake_rules_at((select t3 from who), now() - interval '1 hour') $$,
  'a hand sent late is raked by the stake its table had when it was played');
select is((select count(*)::integer from private.rake_rules_at((select t5 from who), now())), 0, 'and one played now by the new stake''s');

-- Rake shares go by the stretch's stake: a hand at Table 5 an hour ago at the old, one now at the new.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e605', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000006051');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d605', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet 605', '00000000-0000-4000-8000-00000000e605');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c605', '00000000-0000-4000-8000-000000000001', (select t5 from who), s.id,
       '00000000-0000-4000-8000-00000000d605', now() - interval '3 hours', now()
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at,
                         idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'holdem', x.rake * 20, x.rake, 0, false, x.at, x.k
from public.dealer_down d
cross join (values (100000::bigint, now() - interval '1 hour', 'stake-605-1'), (60000::bigint, now(), 'stake-605-2')) x (rake, at, k)
where d.id = '00000000-0000-4000-8000-00000000c605';
select results_eq(
  $$ select stake, share_paise from private.week_rake_shares('00000000-0000-4000-8000-000000000001', now() - interval '3 hours', now() + interval '1 hour')
     where member_id = '00000000-0000-4000-8000-000000000211' order by share_paise desc $$,
  $$ select code, 100000::bigint from public.table_type where id = (select stake_a from who)
     union all select code, 60000::bigint from public.table_type where id = pg_temp.m('b') $$,
  'rake shares go by the stake of the stretch each hand was played in');

-- A move keeps the stake of the stretch it ends: Vihaan (212) sits at Table 605, now at stake c, and moves to Table 3.
-- (Another member than Ishaan: in one transaction a move and his stake change would fall at the same moment.)
select pg_temp.as_person((select floor from who));
select public.set_game_table((select id from public.game_table where name = 'Table 605'), 'Table 605', pg_temp.m('c'), 9);
reset role;
update public.game_table set is_open = true where name = 'Table 605';
create function pg_temp.vihaan() returns uuid language sql security definer as $$
  select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
$$;
grant execute on function pg_temp.vihaan() to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where name = 'Table 605'), 1, '9000000212', p_call_minutes => 180);
select public.move_seat(pg_temp.vihaan(), (select t3 from who), 4);
reset role;
select is((select from_table_type_id from public.seat_move where session_id = pg_temp.vihaan()), pg_temp.m('c'),
  'a move keeps the stake of the stretch it ends');
select is((select table_type_id from public.seat_session where id = pg_temp.vihaan()), (select table_type_id from public.game_table where id = (select t3 from who)),
  'and the seat takes the new table''s stake');

-- A stake games were played at stays: Table 605 goes back to b, so c is used by no table but by Vihaan's history.
select pg_temp.as_person((select floor from who));
select public.set_game_table((select id from public.game_table where name = 'Table 605'), 'Table 605', pg_temp.m('b'), 9);
select throws_ok(format('select public.delete_table_type(%L)', pg_temp.m('c')), 'RVHST', null, 'a stake games were played at is not deleted');
select throws_ok(format('select public.set_game_table(%L, %L, %L, 3)', (select t3 from who), 'Table 3', (select table_type_id from public.game_table where id = (select t3 from who))),
  'RVOCC', null, 'fewer seats than one taken is refused');
reset role;

-- A visit added afterwards for a night before Table 5's stake change is played at the stake it had then, not at b.
create temp table added on commit drop as
select private.insert_added_visit('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', (select t5 from who),
  now() - interval '200 days', now() - interval '200 days' + interval '3 hours',
  (select id from public.staff where user_id = (select floor from who) and venue_id = '00000000-0000-4000-8000-000000000001')) as visit;
select is((select s.table_type_id from public.seat_session s where s.visit_id = (select visit from added)), (select stake_a from who),
  'a visit added for a night before a stake change keeps the stake the table had then');

-- The Players report: one row for his sitting at Table 5, the stake change going on in it.
select results_eq($$ select table_name from private.players_by_seat('00000000-0000-4000-8000-000000000001', private.club_day_of(now() - interval '2 hours'))
                     where member_id = '00000000-0000-4000-8000-000000000211' and table_name is not null $$,
  $$ values ('Table 5'::text) $$, 'the Players report shows one row a sitting at a table');

-- The replay of a seat Bonus sees the stake he sat down at, Table 5's first; so does the sweep's event, though Table 5
-- plays b now.
create temp table seat_version on commit drop as
select jsonb_populate_record(null::public.promotion_version, to_jsonb(v) || '{"reward": {"kind": "seat_bonus", "chips": 750}}') as v
from public.promotion_version v where v.venue_id = '00000000-0000-4000-8000-000000000001' limit 1;
select is((select e #>> '{event,stake}'
           from jsonb_array_elements(private.replay_version_events((select v from seat_version), now() - interval '3 hours', now() + interval '1 hour')) e
           where e #>> '{event,kind}' = 'seated' order by e #>> '{event,at}' limit 1),
  (select code from public.table_type where id = (select stake_a from who)), 'the replay weighs his seat at the stake he sat down at');
select is(private.promotion_event('seated', (select v from seat_version), jsonb_build_object(
            'member_id', '00000000-0000-4000-8000-000000000211', 'table_id', (select t5 from who), 'table_type_id', (select stake_a from who),
            'visit_id', (select visit_id from public.seat_session where id = pg_temp.seat()), 'key', 'seated:605', 'at', now() - interval '2 hours')) ->> 'stake',
  (select code from public.table_type where id = (select stake_a from who)), 'and so does the seat Bonus sweep''s event');

-- He leaves ten minutes after the change and the visit closes: his sessions show Table 5 at each stake played, two hours
-- at the old and ten minutes at the new, and the night added afterwards at the old.
create temp table his on commit drop as
select pg_temp.seat() as id, (select big_blind_paise from public.table_type where id = (select stake_a from who)) as old_blind,
       (select big_blind_paise from public.table_type where id = pg_temp.m('b')) as new_blind,
       (select md5(s.visit_id::text || ':' || s.table_id::text)::uuid from public.seat_session s where s.id = pg_temp.seat()) as table_row_id;
grant select on his to authenticated;
update public.seat_session set ended_at = now() + interval '10 minutes', end_reason = 'left' where id = (select id from his);
update public.visit set closed_at = now() + interval '10 minutes', close_reason = 'by_hand'
where id = (select visit_id from public.seat_session where id = (select id from his));
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, big_blind_paise, played_seconds from public.my_sessions() where kind = 'cash' order by opened_at, played_seconds desc $$,
  $$ values ('Table 5'::text, (select old_blind from his), 10800::bigint), ('Table 5', (select old_blind from his), 7200::bigint),
            ('Table 5', (select new_blind from his), 600::bigint) $$,
  'his sessions show Table 5 at each stake played');
select is((select big_blind_paise from public.my_sessions() where session_id = (select table_row_id from his)), (select old_blind from his),
  'the first stake keeps the id Table 5''s session always had, so one hidden stays hidden');
reset role;
-- His end corrected to half an hour before the change: his seat is one stretch at the old stake, to its end, and tonight
-- is one session there.
update public.seat_session set ended_at = now() - interval '30 minutes' where id = (select id from his);
select results_eq($$ select o_table_id, o_table_type_id, o_to - o_from from private.session_tables((select id from his)) $$,
  $$ values ((select t5 from who), (select stake_a from who), interval '90 minutes') $$,
  'a seat ended by a correction before a stake change is one stretch, to its end');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, big_blind_paise, played_seconds from public.my_sessions() where kind = 'cash' order by opened_at $$,
  $$ values ('Table 5'::text, (select old_blind from his), 10800::bigint), ('Table 5', (select old_blind from his), 5400::bigint) $$,
  'and his sessions show tonight at the old stake alone');
reset role;

-- Undo: a leave undone after the table's stake changed goes on at the new stake; a seat taken just before a stake change
-- is not undone. Kunal (216) sits at Table 3 and leaves; Table 3 changes to b; the floor undoes his leave.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select t3 from who), 7, '9000000216', p_call_minutes => 180);
reset role;
create temp table kunal on commit drop as
select id, table_type_id as was from public.seat_session where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null;
grant select on kunal to authenticated;
update public.seat_session set ended_at = now(), end_reason = 'left' where id = (select id from kunal);
select pg_temp.as_person((select floor from who));
select public.set_game_table((select t3 from who), 'Table 3', pg_temp.m('b'), 9);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok(format('select public.undo_leave(%L)', (select id from kunal)), 'a leave is undone after the table''s stake changed');
reset role;
select results_eq($$ select o_table_type_id from private.session_tables((select id from kunal)) order by o_from $$,
  $$ values ((select was from kunal)), (pg_temp.m('b')) $$, 'and his seat goes on at the new stake');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok(format('select public.undo_seat(%L)', pg_temp.vihaan()), '22023', null, 'a seat moved since is not undone');
select pg_temp.as_person((select floor from who));
select public.set_game_table((select t3 from who), 'Table 3', (select stake_a from who), 9);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok(format('select public.undo_seat(%L)', (select id from kunal)), '22023', null,
  'nor a seat whose table''s stake changed since');
reset role;
-- No stake of another venue on a seat.
select throws_ok(format('update public.seat_session set table_type_id = %L where id = %L',
  (select id from public.table_type where venue_id <> '00000000-0000-4000-8000-000000000001' limit 1), pg_temp.vihaan()),
  '23503', null, 'a seat''s stake is its own venue''s');

-- A table's stake at a past moment, from the audit log: what its latest change left by then; before any, what the first
-- change changed from.
insert into public.audit_log (venue_id, occurred_at, action, entity, entity_id, before, after)
values ('00000000-0000-4000-8000-000000000001', now() - interval '10 days', 'update', 'game_table', (select t3 from who)::text,
        jsonb_build_object('table_type_id', (select stake_a from who)), jsonb_build_object('table_type_id', pg_temp.m('c'))),
       ('00000000-0000-4000-8000-000000000001', now() - interval '5 days', 'update', 'game_table', (select t3 from who)::text,
        jsonb_build_object('table_type_id', pg_temp.m('c')), jsonb_build_object('table_type_id', pg_temp.m('b')));
select is(private.table_stake_at((select t3 from who), now() - interval '7 days'), pg_temp.m('c'), 'a table''s stake between two changes');
select is(private.table_stake_at((select t3 from who), now() - interval '6 hours'), pg_temp.m('b'), 'after the latest');
select is(private.table_stake_at((select t3 from who), now() - interval '400 days'), (select stake_a from who), 'before any, the stake the first change changed from');
-- A stake the history names but since deleted gives the table's stake now.
insert into public.audit_log (venue_id, occurred_at, action, entity, entity_id, before, after)
values ('00000000-0000-4000-8000-000000000001', now() - interval '2 hours', 'update', 'game_table', (select t3 from who)::text,
        jsonb_build_object('table_type_id', pg_temp.m('b')), jsonb_build_object('table_type_id', gen_random_uuid()));
select is(private.table_stake_at((select t3 from who), now() - interval '1 hour'), (select table_type_id from public.game_table where id = (select t3 from who)),
  'a stake since deleted gives the table''s stake now');

select * from finish();
rollback;
