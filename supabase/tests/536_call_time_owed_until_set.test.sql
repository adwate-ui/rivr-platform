-- Call time set, extended and owed (#1076, the owner, 18 Nov): a seat with call time owes it until a call time has been set
-- and has run out; Set call time takes a time after the minimum the seat started with (the owner, 22 Nov); once set, a time
-- past the end extends it; the floor's Set counts as setting it; the floor is told when a member sets or extends. Ishaan (211)
-- Vihaan (212), Yash (214) and Ritika (215) sit at Table 5 with three hours, Mihir (213) with none; 103 Aditya is a floor
-- manager, 108 a host.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.seated(p_member text) returns public.seat_session language sql as $$
  select * from public.seat_session where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and ended_at is null;
$$;
-- Played p_minutes: the seat started then, and took this table no earlier than tonight's 06:00. A seat taken before 06:00
-- and let go after 08:00 counts as forgotten overnight and ends at 06:00 (private.seat_end_stamp), which a run between 08:00
-- and 09:20 IST would otherwise meet (#1086).
create function pg_temp.played(p_member text, p_minutes integer) returns void language sql as $$
  update public.seat_session set started_at = now() - make_interval(mins => p_minutes),
                                 seated_here_at = greatest(now() - make_interval(mins => p_minutes), private.tonight_began(now()))
  where id = (pg_temp.seated(p_member)).id;
$$;
create function pg_temp.floor_seat(p_member text) returns table (owes boolean, set_at timestamptz, ends_at timestamptz, after_at timestamptz, by_member boolean)
language sql as $$
  select owes_call_time, call_time_set_at, call_time_ends_at, call_time_after_at, call_time_set_by_member
  from public.floor_seats('00000000-0000-4000-8000-000000000001') where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid;
$$;
create function pg_temp.chimes() returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'callTimeSet'), 0)::integer;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.seated(text), pg_temp.floor_seat(text), pg_temp.chimes()
  to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 'call_time.view', true, 'test 536'
from unnest(array['211', '212', '213']) m;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 180);
select public.seat_member(pg_temp.table_id('Table 5'), 3, p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000212'), p_call_minutes => 180);
select public.seat_member(pg_temp.table_id('Table 5'), 4, p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000213'), p_call_minutes => 0);
select public.seat_member(pg_temp.table_id('Table 5'), 5, p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000214'), p_call_minutes => 180);
select public.seat_member(pg_temp.table_id('Table 5'), 6, p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000215'), p_call_minutes => 180);
reset role;

-- Set call time takes a time after the three hours.
select pg_temp.played('211', 100);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time_after_at from public.my_seat()), now() + interval '80 minutes', 'an hour and forty in, a time opens once the three hours end');
reset role;
select pg_temp.played('211', 190);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time_after_at from public.my_seat()), now(), 'past the three hours, any time ahead is open');

-- Never set, he owes his call time even once the countdown reached nought: the app puts him on the Leaving list.
select is((select call_time_left from public.my_seat()), 0, 'three hours ten in, the countdown is at nought');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select owes from pg_temp.floor_seat('211')), 'yet the floor sees him owe it: no call time set');
select is(pg_temp.chimes(), 0, 'nothing for the floor to hear yet');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.leave_my_seat(), 'leaving', 'leaving from the app, he goes on the Leaving list, owing');

-- He sets a time half an hour from now: three hours forty. The floor is told, and sees when he leaves.
select is(public.set_my_call_time(now() + interval '30 minutes', gen_random_uuid()), 220, 'half an hour from now makes three hours forty');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select owes and set_at is not null and by_member and ends_at between now() + interval '29 minutes' and now() + interval '31 minutes'
           from pg_temp.floor_seat('211')), 'the floor sees it set by him, ending in thirty minutes, still owed');
select is(pg_temp.chimes(), 1, 'and the floor''s chime has one to tell of');
reset role;
create temp table member_set on commit drop as
  select r.id from public.call_time_request r where r.member_id = '00000000-0000-4000-8000-000000000211' and r.decided_by_staff_id is null;
grant select on member_set to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_call_time((select id from member_set)) $$, '22023', null, 'the floor does not take back a member''s own set');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(pg_temp.chimes(), 1, 'a host on the floor hears it too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.set_my_call_time(now() + interval '90 minutes', gen_random_uuid()), 280, 'set, a time an hour past the end extends it to four hours forty');
reset role;

-- Run out, what he set is met: leaving from the app ends the seat, call time met.
select pg_temp.played('211', 290);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok(not (select owes from pg_temp.floor_seat('211')), 'run out, nothing is owed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.leave_my_seat(), 'left', 'he leaves from the app');
reset role;
select is((select leave_reason from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' order by started_at desc limit 1),
  'call_time_met', 'his call time met');

-- The floor's Set counts as setting it, and is no member's set: the floor is not told of its own.
select pg_temp.played('212', 170);
create temp table vihaan on commit drop as select (pg_temp.seated('212')).id as id;
grant select on vihaan to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select after_at from pg_temp.floor_seat('212')), now() + interval '10 minutes', 'two hours fifty in, the floor may pick a time after the three hours');
select throws_ok($$ select public.add_seat_call_time((select id from vihaan), now() + interval '5 minutes', gen_random_uuid()) $$, 'RVCTE', null,
  'nor one before them, unconfirmed');
select lives_ok($$ select public.add_seat_call_time((select id from vihaan), now() + interval '30 minutes', gen_random_uuid()) $$,
  'the floor sets a time half an hour from now');
select ok((select set_at is not null and not by_member from pg_temp.floor_seat('212')), 'which sets his call time, by the floor');
reset role;
select is((pg_temp.seated('212')).call_time_minutes, 200, 'three hours twenty: from now, as his own set would');

-- Never set, her seat ends at nought before any sweep: the seat's end counts her time for promotions and tells her nothing.
select pg_temp.played('215', 200);
create temp table ritika on commit drop as select (pg_temp.seated('215')).id as id;
grant select on ritika to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select id from ritika), 'left');
reset role;
select ok((select call_time_completed_at is not null from public.seat_session where id = (select id from ritika)), 'her time counts for promotions as her seat ends');
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed' and payload ->> 'session_id' = (select id from ritika)::text),
  0, 'and she is not told her call time is done');

-- Never set, the floor ends his seat at the table with the countdown at nought: he left owing, and the door asks for it until
-- the floor lets him go.
select pg_temp.played('214', 200);
create temp table yash on commit drop as select (pg_temp.seated('214')).id as id;
grant select on yash to authenticated;
-- The minute's sweep marks the time done for promotions, and its event goes so his lock screen stops counting, saying none
-- was set: he is not told it is done, as he still owes it.
select private.sweep_seated_time();
select ok((select call_time_completed_at is not null from public.seat_session where id = (select id from yash)), 'promotions count his time as before');
select is((select array_agg((payload ->> 'is_set')::boolean) from public.outbox_event where event_type = 'call_time.completed'
             and payload ->> 'session_id' = (select id from yash)::text), array[false], 'its event says none was set, so he is not told it is done');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select id from yash), 'left');
select ok(exists (select 1 from public.floor_requests('00000000-0000-4000-8000-000000000001')
                  where kind = 'left_owing' and member_id = '00000000-0000-4000-8000-000000000214'),
  'three hours twenty played, none set: he left owing, on the floor''s list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214') $$, 'RVCTS', null,
  'the door asks for the call time he owes');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'Played his three hours') $$,
  'the floor lets him go before call time');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'call_time.completed' and payload ->> 'session_id' = (select id from yash)::text),
  1, 'nor again as his seat ends');
select is((select shortfall_seconds from public.early_departure where member_id = '00000000-0000-4000-8000-000000000214'), 0,
  'with nought seconds short by the clock');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select array[call_time_met, left_early] from public.member_visits('00000000-0000-4000-8000-000000000001',
             '00000000-0000-4000-8000-000000000214', 1)), array[false, true], 'his visit shows he left early, not that he met his call time');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214') $$, 'then the door lets him go');

-- A seat with no call time owes none, and sets none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select not owes and after_at is null from pg_temp.floor_seat('213')), 'no call time: none owed, and no time to set');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is(public.leave_my_seat(), 'left', 'he leaves from the app at once');
reset role;

-- Members no longer ask the floor for more time.
select ok(to_regprocedure('public.request_call_time(integer, uuid)') is null and to_regprocedure('public.decide_call_time_request(uuid, boolean)') is null,
  'asking the floor for more time is gone');

select * from finish();
rollback;
