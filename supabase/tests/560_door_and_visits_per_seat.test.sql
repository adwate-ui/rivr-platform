-- The door and Reports › Players visits a row per seat (the owner, 19 Nov). Ritika (215) waited on a list from before she
-- checked in, sat at Table 1 and moved to Table 2: two rows, each with its table, when she sat and left, its time played and
-- away, and the wait only from her check-in. Kunal (216) is on a list from the app, not in: one row, no wait. Yash (214)
-- checked in and then joined a list: one row, waiting since he joined. 103 Aditya is an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Moments tonight, as shares of the time since the club day began, so the test holds at any hour.
create temporary table at_ on commit drop as
select b + (now() - b) * 0.1 as joined, b + (now() - b) * 0.2 as checked_in, b + (now() - b) * 0.4 as seated, b + (now() - b) * 0.7 as moved,
       b + (now() - b) * 0.5 as yash_in, b + (now() - b) * 0.6 as yash_joined, private.club_day_of(now()) as today
from (select private.tonight_began(now()) as b) s;
grant select on at_ to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215') $$, 'Ritika is checked in');
select lives_ok($$ select public.move_seat(public.seat_member(
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6, '9000000215'),
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 3) $$,
  'sits at Table 1 and moves to Table 2');
reset role;

-- Her evening's times, set back from now; a tenth of her seat's time away.
update public.visit set opened_at = (select checked_in from at_) where member_id = '00000000-0000-4000-8000-000000000215' and closed_at is null;
update public.seat_session set started_at = (select seated from at_), seated_here_at = (select moved from at_),
  away_seconds = floor(extract(epoch from now() - (select seated from at_)) / 10)
where member_id = '00000000-0000-4000-8000-000000000215' and ended_at is null;
-- The move's time too: its table is append-only, so its guard is off for this test alone.
alter table public.seat_move disable trigger seat_move_never_changed;
update public.seat_move m set created_at = (select moved from at_)
from public.seat_session s where s.id = m.session_id and s.member_id = '00000000-0000-4000-8000-000000000215' and s.ended_at is null;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, status, joined_at, seated_at,
  called_at, hold_until, call_table_id, call_seat)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, gen_random_uuid(), 'seated', at_.joined, at_.seated,
       at_.seated, at_.seated, g.id, 6
from public.game_table g, at_ where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at)
select g.venue_id, '00000000-0000-4000-8000-000000000216', g.table_type_id, g.id, gen_random_uuid(), at_.joined
from public.game_table g, at_ where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';
insert into public.visit (venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', yash_in from at_;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at)
select g.venue_id, '00000000-0000-4000-8000-000000000214', g.table_type_id, g.id, gen_random_uuid(), at_.yash_joined
from public.game_table g, at_ where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';

select is(private.wait_after_check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - interval '1 hour', now()),
  null, 'a wait with no check-in in it is no wait');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table door on commit drop as
select * from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}');
create temporary table ritika on commit drop as
select row_number() over (order by seated_at) as n, door.* from door
where member_id = '00000000-0000-4000-8000-000000000215';

select results_eq($$ select table_name, left_at is null from ritika r cross join lateral (select r.tables -> 0 ->> 'table' as table_name) t order by n $$,
  $$ values ('Table 1', false), ('Table 2', true) $$, 'a visit with a move is two rows, in the order sat, the seat she is in not left');
select results_eq($$ select seated_at, left_at from ritika where n = 1 $$, $$ select seated, moved from at_ $$, 'the first seat from when she sat to the move');
select is((select seated_at from ritika where n = 2), (select moved from at_), 'the second from the move');
select ok((select bool_and(checked_in_at = (select checked_in from at_) and checked_out_at is null) from ritika), 'each row with the visit''s check-in');
select is((select waiting_seconds from ritika where n = 1), (select floor(extract(epoch from seated - checked_in))::integer from at_),
  'the wait that ended in a seat counts from check-in, not from joining the list');
select is((select waiting_seconds from ritika where n = 2), null, 'a seat taken by a move had no wait');
select ok((select bool_and(played_seconds = (tables -> 0 ->> 'seconds')::bigint) from ritika), 'each row''s table has that seat''s time played');

create temporary table one_row on commit drop as
select member_id, count(*)::int as rows, bool_and(seated_at is null) as seatless, max(waiting_seconds) as waited, max(status) as status
from door where member_id in ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000214') group by member_id;
select results_eq($$ select rows, seatless, waited, status from one_row where member_id = '00000000-0000-4000-8000-000000000216' $$,
  $$ values (1, true, null::integer, 'expected') $$, 'one on a list who never checked in: one row, no seat, no wait');
select results_eq($$ select rows, seatless, waited from one_row where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ select 1, true, floor(extract(epoch from now() - yash_joined))::integer from at_ $$, 'one waiting since check-in: his wait so far');

select is((select members::int from public.list_choices('door', '00000000-0000-4000-8000-000000000001', '{}')
           where column_key = 'status' and value = 'playing'),
  (select count(distinct member_id)::int from door where status = 'playing'), 'the door''s menus and chips count players, not rows');
select ok((select bool_and(total = (select count(*) from door)) from door), 'the page''s total counts rows');

create temporary table visits on commit drop as
select * from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select today from at_), 'to', (select today from at_)), 'page_size', 1000));
select is((select count(*)::int from visits where member_id = '00000000-0000-4000-8000-000000000215'), 2, 'Players visits has her two seats');
select ok((select bool_and(played_seconds + away_seconds = floor(extract(epoch from coalesce(left_at, now()) - seated_at)))
           from visits where member_id = '00000000-0000-4000-8000-000000000215'), 'each seat''s time is its time played and its time away');
select ok((select sum(visits.away_seconds) between s.away_seconds - 1 and s.away_seconds
           from visits, public.seat_session s
           where visits.member_id = '00000000-0000-4000-8000-000000000215' and s.member_id = visits.member_id and s.ended_at is null
           group by s.away_seconds), 'the seats'' time away is the session''s, shared out');
select is((select count(*)::int from visits where member_id = '00000000-0000-4000-8000-000000000216'), 0, 'one never in is still no visit');
select is((select sum(members)::int from public.list_choices('player_visits', '00000000-0000-4000-8000-000000000001',
             jsonb_build_object('scope', jsonb_build_object('from', (select today from at_), 'to', (select today from at_))))
           where column_key = 'tier'),
  (select count(distinct member_id)::int from visits), 'its tier menu counts visits, not rows');
select results_eq($$ select page.away_seconds from public.player_visits_page('00000000-0000-4000-8000-000000000001',
    jsonb_build_object('scope', jsonb_build_object('from', (select today from at_), 'to', (select today from at_)),
                       'filters', jsonb_build_object('player', jsonb_build_object('kind', 'text', 'typed', 'Ritika')),
                       'sort', jsonb_build_object('key', 'away', 'direction', 'descending'))) page $$,
  $$ select away_seconds from visits where member_id = '00000000-0000-4000-8000-000000000215' order by away_seconds desc $$,
  'Away sorts on the server');
reset role;

select * from finish();
rollback;
