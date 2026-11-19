-- A member's own Set or Extend call time stays in the floor's Requests until the floor marks it seen (#1090, the owner,
-- 19 Nov): one item for the seat, its latest change, counted for the chime and the header until Seen or the seat ends. The
-- floor's own Set or Extend is never one. Ishaan (211) and Vihaan (212) sit at Table 5 with three hours, 190 minutes in; 103
-- Aditya is a floor manager, 106 Pema a dealer, e9 staff of another venue.
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
create function pg_temp.free_seat() returns integer language sql as $$
  select min(n)::integer from generate_series(1, 10) n
  where not exists (select 1 from public.seat_session s where s.table_id = pg_temp.table_id('Table 5') and s.seat = n and s.ended_at is null);
$$;
-- The floor's call time items, by member number's last three digits: the request and its minutes.
create function pg_temp.items() returns table (who text, request_id uuid, minutes integer) language sql as $$
  select right(member_id::text, 3), request_id, minutes from public.floor_requests('00000000-0000-4000-8000-000000000001')
  where kind = 'call_time_set' order by 1;
$$;
create function pg_temp.chimes() returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'callTimeSet'), 0)::integer;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.free_seat(), pg_temp.items(), pg_temp.chimes() to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 'call_time.view', true, 'test 540'
from unnest(array['211', '212']) m;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_id('Table 5'), pg_temp.free_seat(), p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000211'), p_call_minutes => 180);
select public.seat_member(pg_temp.table_id('Table 5'), pg_temp.free_seat(), p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000212'), p_call_minutes => 180);
reset role;
update public.seat_session set started_at = now() - interval '190 minutes',
                               seated_here_at = greatest(now() - interval '190 minutes', private.tonight_began(now()))
where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212') and ended_at is null;
create temp table seats on commit drop as
select right(member_id::text, 3) as who, id from public.seat_session
where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212') and ended_at is null;
grant select on seats to authenticated;

-- Nothing yet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from pg_temp.items() $$, 'no call time items before anyone sets one');
select is(pg_temp.chimes(), 0, 'and nothing counted');

-- Ishaan sets an hour from his app: one item, counted.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.set_my_call_time(60, gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, minutes from pg_temp.items() $$, $$ values ('211'::text, 60) $$, 'his set is an item on the floor''s Requests');
select is(pg_temp.chimes(), 1, 'counted for the chime and the header');
-- A minute ago, so his next change is later by the clock (one transaction is one moment).
reset role;
update public.call_time_request set requested_at = requested_at - interval '1 minute', decided_at = decided_at - interval '1 minute'
where session_id = (select id from seats where who = '211');
create temp table first_set on commit drop as select id from public.call_time_request where session_id = (select id from seats where who = '211');
grant select on first_set to authenticated;
-- He extends by 30 before the floor looks: still one item, now his latest.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.set_my_call_time(30, gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, minutes from pg_temp.items() $$, $$ values ('211'::text, 30) $$, 'his extend updates the one item for his seat');
select is(pg_temp.chimes(), 1, 'still one seat counted');
-- The floor's own Set for Vihaan is no item.
select public.add_seat_call_time((select id from seats where who = '212'), 60, gen_random_uuid());
select is((select count(*)::integer from pg_temp.items() where who = '212'), 0, 'the floor''s own Set is never an item');
-- Seen stops at the change it is given: his first set seen, his later extend is still the item.
select lives_ok($$ select public.mark_call_time_seen((select id from first_set)) $$, 'the floor marks his first set seen');
select results_eq($$ select who, minutes from pg_temp.items() $$, $$ values ('211'::text, 30) $$, 'his later extend is still an item');
select is(pg_temp.chimes(), 1, 'still counted');

-- Who may mark it seen.
create temp table item on commit drop as select request_id from pg_temp.items() where who = '211';
grant select on item to authenticated;
create temp table outbox_before on commit drop as select count(*) as n from public.outbox_event;
grant select on outbox_before to authenticated;
reset role;
create temp table floor_made on commit drop as select r.id from public.call_time_request r
where r.session_id = (select id from seats where who = '212') and r.decided_by_staff_id is not null limit 1;
grant select on floor_made to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.mark_call_time_seen((select request_id from item)) $$, '42501', null, 'not a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e9');
select throws_ok($$ select public.mark_call_time_seen((select request_id from item)) $$, '42501', null, 'nor staff of another venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.mark_call_time_seen((select request_id from item)) $$, '42501', null, 'nor the member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.mark_call_time_seen((select id from floor_made)) $$, '22023', null, 'the floor''s own change is not one to mark seen');

-- The floor marks it seen: gone, uncounted, both his changes seen and by whom; again, nothing happens.
select lives_ok($$ select public.mark_call_time_seen((select request_id from item)) $$, 'the floor marks it seen');
select is_empty($$ select * from pg_temp.items() $$, 'his item leaves Requests');
select is(pg_temp.chimes(), 0, 'and the count');
reset role;
select results_eq($$ select count(*)::integer, bool_and(r.seen_by_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103'
                                                                               and s.venue_id = r.venue_id))
                     from public.call_time_request r where r.session_id = (select id from seats where who = '211') and r.seen_at is not null $$,
  $$ values (2, true) $$, 'both his changes are marked seen, by the floor manager');
select is((select count(*) from public.outbox_event), (select n from outbox_before), 'marking seen sends nothing outside');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.mark_call_time_seen((select request_id from item)) $$, 'marking it again does nothing');

-- He extends again: a new item. His seat ends: no item.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.set_my_call_time(30, gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, minutes from pg_temp.items() $$, $$ values ('211'::text, 30) $$, 'a new extend is a new item');
select public.end_seat((select id from seats where who = '211'), 'left');
select is_empty($$ select * from pg_temp.items() $$, 'his seat ended, his item goes with it');
select is(pg_temp.chimes(), 0, 'and is no longer counted');
reset role;

select * from finish();
rollback;
