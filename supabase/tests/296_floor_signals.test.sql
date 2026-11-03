-- The Live floor live (decision 0479): what the floor shows changing signals the venue's private floor topic, heard by
-- its floor only. 103 is a floor manager (admin), 108 a host, 106 a dealer, 107 marketing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.signals(p_venue text) returns integer language sql as $$
  select count(*)::integer from realtime.messages where topic = 'floor:' || p_venue and event = 'changed';
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table counted as select pg_temp.signals('00000000-0000-4000-8000-000000000001') as n,
  pg_temp.signals('00000000-0000-4000-8000-000000000002') as practice;
create function pg_temp.moved() returns boolean language plpgsql as $$
declare v_now integer := pg_temp.signals('00000000-0000-4000-8000-000000000001');
begin
  if v_now > (select n from counted) then update counted set n = v_now; return true; end if;
  return false;
end;
$$;

-- A seat taken, a top-up asked for, time asked for, the seat left, a join asked for, a table opened, a seat undone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table sess on commit drop as
  select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
    2, p_member_number => 7, p_call_minutes => 0) as id;
reset role;
select ok(pg_temp.moved(), 'a seat taken signals the club''s floor');
insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat)
select venue_id, member_id, id, table_id, seat from public.seat_session where id = (select id from sess);
select ok(pg_temp.moved(), 'a top-up asked for');
insert into public.call_time_request (venue_id, member_id, session_id, minutes, idempotency_key)
select venue_id, member_id, id, 60, gen_random_uuid() from public.seat_session where id = (select id from sess);
select ok(pg_temp.moved(), 'more time asked for');
update public.seat_session set leaving_at = now() where id = (select id from sess);
select ok(pg_temp.moved(), 'a player marked leaving');
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, approved_at)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, gen_random_uuid(), null
from public.game_table g where g.name = 'Table 5' and g.venue_id = '00000000-0000-4000-8000-000000000001';
select ok(pg_temp.moved(), 'a join asked for');
update public.game_table set is_open = true where name = 'Table 4' and venue_id = '00000000-0000-4000-8000-000000000001';
select ok(pg_temp.moved(), 'a table opened');
delete from public.call_time_request where session_id = (select id from sess);
delete from public.top_up_request where session_id = (select id from sess);
delete from public.seat_session where id = (select id from sess);
select ok(pg_temp.moved(), 'a seat undone');
select is(pg_temp.signals('00000000-0000-4000-8000-000000000002'), (select practice from counted), 'the practice venue''s floor hears none of the club''s');
select is((select count(*)::integer from realtime.messages where topic like 'floor:%' and (payload ? 'member_id' or payload ? 'session_id')),
  0, 'a signal names nobody');

-- Heard by the venue's floor: a floor manager and a host; not a dealer or marketing, nor a topic naming no venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select set_config('realtime.topic', 'floor:00000000-0000-4000-8000-000000000001', true);
select ok((select count(*) > 0 from realtime.messages where extension = 'broadcast'), 'the floor manager hears it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select ok((select count(*) > 0 from realtime.messages where extension = 'broadcast'), 'a host hears it');
select set_config('realtime.topic', 'floor:not-a-venue', true);
select is_empty($$ select * from realtime.messages where topic like 'floor:%' $$, 'a topic that names no venue is heard by nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select set_config('realtime.topic', 'floor:00000000-0000-4000-8000-000000000001', true);
select is_empty($$ select * from realtime.messages where topic like 'floor:%' $$, 'a dealer does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select * from realtime.messages where topic like 'floor:%' $$, 'nor marketing');
-- Another venue's floor does not hear the practice venue's: Imran (153) is an admin at the club alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000153');
select set_config('realtime.topic', 'floor:00000000-0000-4000-8000-000000000002', true);
select is_empty($$ select * from realtime.messages where topic like 'floor:%' $$, 'the club''s admin hears nothing of the practice floor');
reset role;

select * from finish();
rollback;
