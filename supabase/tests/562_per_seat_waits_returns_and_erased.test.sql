-- The door's and Players visits' rows a seat each, as the review of the pull request asked. Kunal (216) waited on a list
-- from before he checked in, and the floor seated him by number (public.seat_member, which ends his place on the list as
-- seated): his seat's wait counts from check-in. Yash (214) played on his first visit and is back, checked in, with no
-- seat: that visit has its own row, with no check-out. Rohan (204), on a list from the app, is erased: his name links
-- nowhere. Each row says its seat session and its visit. 103 Aditya is an admin.
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
select b + (now() - b) * 0.1 as yash_in, b + (now() - b) * 0.15 as yash_sat, b + (now() - b) * 0.35 as yash_rose, b + (now() - b) * 0.4 as yash_out,
       b + (now() - b) * 0.6 as yash_back, b + (now() - b) * 0.7 as kunal_joined, b + (now() - b) * 0.8 as kunal_in,
       private.club_day_of(now()) as today
from (select private.tonight_began(now()) as b) s;
grant select on at_ to authenticated;

insert into public.visit (venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', kunal_in from at_;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at)
select g.venue_id, '00000000-0000-4000-8000-000000000216', g.table_type_id, g.id, gen_random_uuid(), at_.kunal_joined
from public.game_table g, at_ where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';
with first_visit as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', yash_in, yash_out, 'door' from at_ returning id)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', first_visit.id,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 4,
       at_.yash_sat, at_.yash_sat, at_.yash_rose, 'left', 0, 0
from first_visit, at_;
insert into public.visit (venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', yash_back from at_;
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null, known_as = null
where id = '00000000-0000-4000-8000-000000000204';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 2, '9000000216') $$,
  'the floor seats Kunal by number, off his list');
create temporary table door on commit drop as select * from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}');

select results_eq($$ select waiting_seconds, session_id is not null, visit_id = (select id from public.visit v where v.member_id = d.member_id and v.closed_at is null)
                     from door d where member_id = '00000000-0000-4000-8000-000000000216' $$,
  $$ select floor(extract(epoch from now() - kunal_in))::integer, true, true from at_ $$,
  'a member seated by number keeps the wait that ended in his seat, from his check-in, and his row its seat session and visit');

select results_eq($$ select tables -> 0 ->> 'table', checked_in_at, checked_out_at, session_id is null from door
                     where member_id = '00000000-0000-4000-8000-000000000214' order by seated_at nulls last $$,
  $$ select 'Table 2'::text, yash_in, yash_out, false from at_ union all select null, yash_back, null, true from at_ $$,
  'a member back the same night: his first visit''s seat, then his visit now on a row of its own, still in');
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
             jsonb_build_object('scope', jsonb_build_object('from', (select today from at_), 'to', (select today from at_)), 'page_size', 1000))
           where member_id = '00000000-0000-4000-8000-000000000214'), 2, 'and Players visits has both visits');

select results_eq($$ select member_id is not null, linked_member_id from door where member_id = '00000000-0000-4000-8000-000000000204' $$,
  $$ values (true, null::uuid) $$, 'an erased member''s row links to no account');
select ok((select bool_and(linked_member_id = member_id) from door where member_id <> '00000000-0000-4000-8000-000000000204'),
  'everyone else''s links to theirs');
select is((select count(*)::int from (select distinct member_id, coalesce(session_id, visit_id), seated_at, tables from door) keys),
  (select count(*)::int from door), 'each row is told apart by its member, seat session or visit, seat and table');
reset role;

select * from finish();
rollback;
