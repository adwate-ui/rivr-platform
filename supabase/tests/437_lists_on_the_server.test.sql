-- The Door, Food and drink's orders, the ID checks' queue and open Feedback, a page at a time from the server (redesign
-- RD-30). Each page is checked against the read that gave the whole list until now: private.todays_players and
-- door_board, fnb_orders_tonight, kyc_review_queue and open_feedback. Vikram (101) is a super admin; Pema (106), a
-- dealer, reads none of them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Three open tickets, notes sent from the app (so with no stars), the oldest first: from 211, 212 and 213.
insert into public.feedback (venue_id, member_id, score, note, created_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', null, 'Waited twenty minutes for chai', now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', null, 'The new chairs are good', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', null, 'A light at Table 3 flickers', now() - interval '1 hour');
-- Member 212 is in a seat now, so in the club.
delete from public.seat_session where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000212' and closed_at is null;
with opened as (
  insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '10 minutes')
  returning id)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', opened.id, g.id, s.seat, now() - interval '9 minutes', now() - interval '9 minutes', 0
from opened, public.game_table g
cross join lateral (select n as seat from generate_series(1, 9) n
                    where not exists (select 1 from public.seat_session o where o.table_id = g.id and o.seat = n and o.ended_at is null) limit 1) s
where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
-- Member 212 has ordered three times tonight: one order stands, one is void, cancelled by the member, and one was last
-- night's.
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number)
select s.venue_id, s.visit_id, s.member_id, s.table_id, s.seat, private.club_day_now(),
       jsonb_build_array(jsonb_build_object('item_id', '00000000-0000-4000-8000-000000000999', 'name', n.name, 'kind', 'soft_drink', 'quantity', 1, 'note', null)),
       'app', n.kot
from public.seat_session s
cross join (values (9431, 'Masala chai'), (9432, 'Fresh lime soda'), (9433, 'Cold coffee')) as n(kot, name)
where s.member_id = '00000000-0000-4000-8000-000000000212' and s.ended_at is null;
create temporary table orders as
select o.id, row_number() over (order by o.kot_number) as at from public.fnb_order o where o.kot_number in (9431, 9432, 9433);
update public.fnb_order set cancelled_at = now(), cancel_reason = 'Cancelled by the member' where id = (select id from orders where at = 1);
update public.fnb_order set club_day = private.club_day_now() - 1 where id = (select id from orders where at = 2);
create temporary table seated as select full_name from public.member where id = '00000000-0000-4000-8000-000000000212';
create temporary table days as select (private.club_day_now() - 1)::text as last_night;
grant select on orders, days, seated to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');

-- Open Feedback.
select results_eq($$ select id from public.feedback_open_page('00000000-0000-4000-8000-000000000001') $$,
  $$ select id from public.open_feedback('00000000-0000-4000-8000-000000000001') $$, 'the open tickets come oldest first, as the whole list did');
select is_empty($$ select 1 from public.feedback_open_page('00000000-0000-4000-8000-000000000001') p
                   full join public.open_feedback('00000000-0000-4000-8000-000000000001') o on o.id = p.id
                   where (p.id, p.member_id, p.full_name, p.member_number, p.visit_closed_at, p.score, p.note, p.created_at, p.topic, p.nps, p.tables, p.wait_seconds)
                         is distinct from (o.id, o.member_id, o.full_name, o.member_number, o.visit_closed_at, o.score, o.note, o.created_at, o.topic, o.nps, o.tables, o.wait_seconds) $$,
  'each ticket as it was');
select is((select distinct total from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"page_size": 2}')),
  (select count(*) from public.open_feedback('00000000-0000-4000-8000-000000000001')), 'a page says how many are open in all');
select is((select count(*) from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"page_size": 2, "page": 1}')), 2::bigint, 'two to a page when asked');
select results_eq($$ select note from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"query": "TWENTY"}') $$,
  $$ values ('Waited twenty minutes for chai'::text) $$, 'the search reads the note, whatever its case');
select results_eq($$ select score from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"filters": {"rating": {"kind": "choice", "chosen": ["0"]}}}') $$,
  $$ select score from public.open_feedback('00000000-0000-4000-8000-000000000001') where score is null order by created_at $$, 'no rating, chosen, narrows it to the notes without stars');
select set_eq($$ select id from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"filters": {"age": {"kind": "range", "min": "2", "max": ""}}}') $$,
  $$ select id from public.open_feedback('00000000-0000-4000-8000-000000000001') where created_at <= now() - interval '2 hours' $$, 'and an age of two hours or more');
select results_eq($$ select full_name from public.feedback_open_page('00000000-0000-4000-8000-000000000001', '{"sort": {"key": "member", "direction": "descending"}}') $$,
  $$ select full_name from public.open_feedback('00000000-0000-4000-8000-000000000001') order by full_name desc, created_at $$, 'by member, turned round');
select is((select sum(members) from public.list_choices('feedback_open', '00000000-0000-4000-8000-000000000001') where column_key = 'rating'),
  (select count(*) from public.open_feedback('00000000-0000-4000-8000-000000000001'))::numeric, 'the rating menu counts every open ticket');

-- The ID checks' queue.
select results_eq($$ select member_id from public.kyc_review_page('00000000-0000-4000-8000-000000000001') $$,
  $$ select member_id from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') $$, 'the queue comes in its order: to review first');
select is_empty($$ select 1 from public.kyc_review_page('00000000-0000-4000-8000-000000000001') p
                   full join public.kyc_review_queue('00000000-0000-4000-8000-000000000001') q on q.member_id = p.member_id
                   where (p.member_id, p.full_name, p.status, p.method, p.waiting_because, p.date_of_birth, p.masked_aadhaar, p.pan, p.address, p.photo_path,
                          p.liveness_score, p.face_match_score, p.vendor_reference, p.refusal, p.clashes_with, p.updated_at)
                         is distinct from
                         (q.member_id, q.full_name, q.status, q.method, q.waiting_because, q.date_of_birth, q.masked_aadhaar, q.pan, q.address, q.photo_path,
                          q.liveness_score, q.face_match_score, q.vendor_reference, q.refusal, q.clashes_with, q.updated_at) $$, 'each check as it was');
select is((select count(*) from public.kyc_review_page('00000000-0000-4000-8000-000000000001', '{"page_size": 3, "page": 2}')),
  least(3, greatest(0, (select count(*) from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')) - 3))::bigint, 'a second page of three');
select set_eq($$ select member_id from public.kyc_review_page('00000000-0000-4000-8000-000000000001', '{"query": "an"}') $$,
  $$ select member_id from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') where full_name ilike '%an%' $$, 'the search reads the name');
select results_eq($$ select value, members from public.list_choices('kyc_review', '00000000-0000-4000-8000-000000000001') where column_key = 'status' order by value $$,
  $$ select status, count(*) from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') group by 1 order by 1 $$, 'each state of the queue is counted');

-- Food and drink's orders.
select set_eq($$ select order_id from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{"scope": {"state": "all"}}') $$,
  $$ select order_id from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') $$, 'every order of tonight, when every state is asked for');
select set_eq($$ select order_id from public.fnb_orders_page('00000000-0000-4000-8000-000000000001') $$,
  $$ select order_id from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where cancelled_at is null and delivered_at is null $$,
  'the list opens on the orders still open');
select is_empty($$ select 1 from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{"scope": {"state": "all"}}') p
                   join public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') o on o.order_id = p.order_id
                   where (p.kot_number, p.table_name, p.seat, p.member_name, p.member_number, p.lines, p.is_comp, p.source, p.created_at, p.kot_sent_at, p.kot_sent_by,
                          p.accepted_at, p.delivered_at, p.cancelled_at, p.cancel_reason, p.on_way_at, p.kot_print_failed, p.seat_state)
                         is distinct from
                         (o.kot_number, o.table_name, o.seat, o.member_name, o.member_number, o.lines, o.is_comp, o.source, o.created_at, o.kot_sent_at, o.kot_sent_by,
                          o.accepted_at, o.delivered_at, o.cancelled_at, o.cancel_reason, o.on_way_at, o.kot_print_failed, o.seat_state) $$, 'each order as it was');
select results_eq($$ select order_id, state from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{"scope": {"state": "void"}, "query": "chai"}') $$,
  $$ select id, 'void'::text from orders where at = 1 $$, 'the void order is behind its state, and found by what was ordered');
select ok((select bool_or(order_id = (select id from orders where at = 3)) and not bool_or(order_id in (select id from orders where at < 3))
           from public.fnb_orders_page('00000000-0000-4000-8000-000000000001')), 'the order that stands is among the open ones; the void one and last night''s are not');
select results_eq($$ select order_id from public.fnb_orders_page('00000000-0000-4000-8000-000000000001',
                       jsonb_build_object('scope', jsonb_build_object('state', 'all', 'day', (select last_night from days)))) $$,
  $$ select id from orders where at = 2 $$, 'and last night''s order behind its day');
select is((select sum(members) from public.list_choices('fnb_orders', '00000000-0000-4000-8000-000000000001', '{"scope": {"state": "all"}}') where column_key = 'state'),
  (select count(*) from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001'))::numeric, 'the states count every order of the day');
select results_eq($$ select kot_number from public.fnb_member_cancelled_kots('00000000-0000-4000-8000-000000000001') $$,
  $$ select o.kot_number from public.fnb_order o where o.id = (select id from orders where at = 1) $$, 'the KOT a member cancelled is named for the bar');

-- The Door.
select set_eq($$ select member_id from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') $$,
  $$ select member_id from public.todays_players('00000000-0000-4000-8000-000000000001') $$, 'the door lists today''s players');
select set_eq($$ select member_id from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000, "scope": {"list": "in_club"}}') $$,
  $$ select member_id from public.door_board('00000000-0000-4000-8000-000000000001') where is_in_room $$, 'in the club: the members with a visit open');
select set_eq($$ select member_id from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000, "scope": {"list": "expected"}}') $$,
  $$ select member_id from public.door_board('00000000-0000-4000-8000-000000000001') where not is_in_room $$, 'expected: on a waitlist and not yet in');
select is_empty($$ select 1 from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') p
                   join public.todays_players('00000000-0000-4000-8000-000000000001') t on t.member_id = p.member_id
                   where (p.full_name, p.member_number, p.checked_in_at, p.checked_out_at, p.waiting_seconds, p.tables)
                         is distinct from (t.full_name, t.member_number, t.checked_in_at, t.checked_out_at, t.waiting_seconds, t.tables)
                      or p.status is distinct from case when t.status = 'waiting' and p.list = 'expected' then 'expected' else t.status end $$,
  'each player as today''s players gave them; one waiting outside is expected');
select is_empty($$ select 1 from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') p
                   join public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') m on m.member_id = p.member_id
                   where p.kyc_status is distinct from m.kyc_status or p.tier_name is distinct from m.tier_name $$, 'with the tier and ID check the Members list gives');
select results_eq($$ select member_id, status, list from public.door_page('00000000-0000-4000-8000-000000000001', jsonb_build_object('query', (select full_name from seated))) $$,
  $$ values ('00000000-0000-4000-8000-000000000212'::uuid, 'playing'::text, 'in_club'::text) $$, 'the search finds member 212 by name, in a seat');
select is((select member_id from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1, "sort": {"key": "played", "direction": "descending"}}')),
  (select p.member_id from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') p order by p.played_seconds desc, p.full_name limit 1),
  'by time played, most first');
-- Status sorts by need, as the door reads it, not by its code's letters: waiting, expected, playing, in the room, left, never arrived.
select cmp_ok((select count(distinct status) from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')), '>', 1::bigint,
  'the door holds players of more than one status');
select is_empty($$ select 1 from (
    select array_position(array['waiting', 'expected', 'playing', 'in_room', 'left', 'never_arrived'], p.status) as need,
           lag(array_position(array['waiting', 'expected', 'playing', 'in_room', 'left', 'never_arrived'], p.status)) over (order by p.at) as need_before
    from (select d.status, row_number() over () as at
          from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000, "sort": {"key": "status", "direction": "ascending"}}') d) p) o
  where o.need < o.need_before $$, 'sorted by status, those who need the floor come first');
select is((select status from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1, "sort": {"key": "status", "direction": "descending"}}')),
  (select p.status from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') p
   order by array_position(array['waiting', 'expected', 'playing', 'in_room', 'left', 'never_arrived'], p.status) desc limit 1), 'and last, the other way');
select is((select count(*) from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000, "filters": {"status": {"kind": "choice", "chosen": ["playing"]}}}')),
  (select count(*) from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') p where p.status = 'playing'), 'while its filter still reads the status itself');
select is((select sum(members) from public.list_choices('door', '00000000-0000-4000-8000-000000000001') where column_key = 'list'),
  (select count(*) from public.todays_players('00000000-0000-4000-8000-000000000001'))::numeric, 'the door''s lists count every player once');
select results_eq($$ select value, members from public.list_choices('door', '00000000-0000-4000-8000-000000000001', jsonb_build_object('query', (select full_name from seated))) where column_key = 'list' $$,
  $$ values ('in_club'::text, 1::bigint) $$, 'and follow the search');

-- A list nobody named, and words that look like SQL.
select throws_ok($$ select * from public.list_choices('member', '00000000-0000-4000-8000-000000000001') $$, '22023', null, 'a list that is not one of them is refused');
select is_empty($$ select 1 from public.door_page('00000000-0000-4000-8000-000000000001', '{"query": "x'') or true; drop table public.visit; --"}') $$,
  'words that look like SQL are only words');
select is((select count(*) from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000, "sort": {"key": "drop table"}, "filters": {"nonsense": {"kind": "text", "typed": "x"}}}')),
  (select count(*) from public.todays_players('00000000-0000-4000-8000-000000000001')), 'an order and a column the list does not have change nothing');

-- A dealer reads none of them.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.feedback_open_page('00000000-0000-4000-8000-000000000001') $$, 'a dealer is given no ticket');
select is_empty($$ select 1 from public.kyc_review_page('00000000-0000-4000-8000-000000000001') $$, 'no check');
select is_empty($$ select 1 from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{"scope": {"state": "all"}}') $$, 'no order');
select is_empty($$ select 1 from public.door_page('00000000-0000-4000-8000-000000000001') $$, 'nobody at the door');
select is_empty($$ select 1 from public.list_choices('door', '00000000-0000-4000-8000-000000000001') $$, 'and no counts');
select is_empty($$ select 1 from public.fnb_member_cancelled_kots('00000000-0000-4000-8000-000000000001') $$, 'nor a cancelled KOT');
reset role;
select is(has_function_privilege('anon', 'public.door_page(uuid, jsonb)', 'execute') or has_function_privilege('anon', 'public.fnb_orders_page(uuid, jsonb)', 'execute')
       or has_function_privilege('anon', 'public.kyc_review_page(uuid, jsonb)', 'execute') or has_function_privilege('anon', 'public.feedback_open_page(uuid, jsonb)', 'execute')
       or has_function_privilege('anon', 'public.list_choices(text, uuid, jsonb)', 'execute'), false, 'nobody signed out reads a list');
select is(has_function_privilege('authenticated', 'private.list_json(text, uuid, jsonb)', 'execute'), false, 'and nobody is handed a list by its name alone');
select ok((select count(*) > 0 from public.visit), 'the visits are all still there');

select * from finish();
rollback;
