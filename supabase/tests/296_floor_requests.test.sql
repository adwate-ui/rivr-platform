-- The Live floor's requests (decision 0446): everything that waits on the floor in one read, oldest first, and the club's
-- targets for how long each may wait. At Table 5: Ishaan (211) asks for a top-up, Vihaan (212) for an hour more, Mihir
-- (213) is leaving, Yash (214) left owing call time, and Ritika (215) asks to join the list. 103 is a floor manager (admin),
-- 108 a host, 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.seat(p_member text, p_seat integer) returns uuid language sql as $$
  select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
    p_seat, p_member_number => (select member_number from public.member where id = p_member::uuid), p_call_minutes => 180);
$$;
create function pg_temp.kinds(p_venue text) returns text language sql as $$
  select string_agg(kind, ',' order by since, request_id) from public.floor_requests(p_venue::uuid);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.seat(text, integer), pg_temp.kinds(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table sess on commit drop as
  select pg_temp.seat('00000000-0000-4000-8000-000000000211', 2) as topping,
         pg_temp.seat('00000000-0000-4000-8000-000000000212', 3) as asking,
         pg_temp.seat('00000000-0000-4000-8000-000000000213', 4) as leaving,
         pg_temp.seat('00000000-0000-4000-8000-000000000214', 5) as gone;
select public.set_leaving((select leaving from sess), true);
reset role;
grant select on sess to authenticated;

-- Yash played ten minutes of three hours and left: owing, and nobody let him go yet.
update public.seat_session set started_at = now() - interval '10 minutes', seated_here_at = now() - interval '10 minutes'
where id = (select gone from sess);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select gone from sess), 'left');
reset role;
update public.seat_session set ended_at = now() - interval '1 minute' where id = (select gone from sess);
-- The others, each from a minute of its own, so the order is theirs.
update public.seat_session set top_up_requested_at = now() - interval '4 minutes' where id = (select topping from sess);
insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat, requested_at)
select venue_id, member_id, id, table_id, seat, now() - interval '4 minutes' from public.seat_session where id = (select topping from sess);
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key, requested_at)
select venue_id, member_id, id, 60, gen_random_uuid(), now() - interval '3 minutes' from public.seat_session where id = (select asking from sess);
update public.seat_session set leaving_at = now() - interval '2 minutes' where id = (select leaving from sess);
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at, approved_at)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, gen_random_uuid(), now() - interval '5 minutes', null
from public.game_table g where g.name = 'Table 5' and g.venue_id = '00000000-0000-4000-8000-000000000001';

-- The floor manager reads all five, oldest first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.kinds('00000000-0000-4000-8000-000000000001'), 'join,top_up,time,leaving,left_owing', 'every request, oldest first');
select is((select row(full_name, seat, top_up, call_time_left > 0)::text from public.floor_requests('00000000-0000-4000-8000-000000000001') where kind = 'top_up'),
  '("Ishaan Verma",2,requested,t)', 'a top-up: who, where, asked for, and the call time left');
select is((select row(full_name, minutes)::text from public.floor_requests('00000000-0000-4000-8000-000000000001') where kind = 'time'),
  '("Vihaan Kapoor",60)', 'a time request: the length asked');
select ok((select owed_seconds > 0 and request_id = '00000000-0000-4000-8000-000000000214' from public.floor_requests('00000000-0000-4000-8000-000000000001')
           where kind = 'left_owing'), 'left before call time: the member, and what is owed');
select is((select table_id from public.floor_requests('00000000-0000-4000-8000-000000000001') where kind = 'join'),
  (select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 'a join: the table asked for');

-- A host reads them but the left-owing, which only staff who let players go early see; a dealer and anon read nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(pg_temp.kinds('00000000-0000-4000-8000-000000000001'), 'join,top_up,time,leaving', 'a host: no left-owing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.floor_requests('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a dealer reads no requests');
select throws_ok($$ select * from public.floor_request_targets('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor the targets');
reset role;
set local role anon;
select throws_ok($$ select * from public.floor_requests('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'anon calls nothing');
reset role;

-- The practice venue's requests are its own, and reading them writes nothing anywhere.
create temp table before_read on commit drop as select count(*) as events from public.outbox_event;
grant select on before_read to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.floor_requests('00000000-0000-4000-8000-000000000002')
           where member_id::text like '00000000-0000-4000-8000-00000000021%'), 0, 'the practice venue reads none of the club''s');
reset role;
select is((select count(*) from public.outbox_event), (select events from before_read), 'reading sends nothing');

-- Targets: none set, both null (the domain's defaults apply); set, the club's; nothing outside the schema.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select row(top_up_seconds, other_seconds)::text from public.floor_request_targets('00000000-0000-4000-8000-000000000001')), '(,)',
  'none set: no targets of the club''s');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'floor.request_targets', '', '{"top_up_seconds": 180, "other_seconds": 300}', '-infinity', 'test 296');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'floor.request_targets', '', '{"top_up_seconds": 5, "other_seconds": 300}',
                            now() + interval '1 day', 'test 296') $$, null, null, 'five seconds is no target');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select row(top_up_seconds, other_seconds)::text from public.floor_request_targets('00000000-0000-4000-8000-000000000001')), '(180,300)',
  'the club''s targets');
select is((select row(top_up_seconds, other_seconds)::text from public.floor_request_targets('00000000-0000-4000-8000-000000000002')), '(,)',
  'the practice venue keeps its own');
reset role;

select * from finish();
rollback;
