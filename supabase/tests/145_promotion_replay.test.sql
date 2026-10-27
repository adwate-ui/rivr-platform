-- Last week's events for a promotion's simulation (#144; decision 0214). Rana (a new member) played three club
-- days ago from 14:00 IST, first at Table 1 (NLH 50/100), moved to Table 3 (NLH 100/200) at 15:30, and left at
-- 20:00, six hours earning 60 points. She bought in ₹10,000 in cash at Table 1 at 15:00 and ₹5,000 from bonus at
-- Table 3 at 16:00; she also bought in eight days ago, and today. 103 Aditya manages promotions; 104 Sana is a
-- cashier; 191 Nisha is an admin at the club only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table at_club as
select private.tonight_began(now()) as today_began, private.tonight_began(now()) - interval '3 days' as day_began,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1') as table_1,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3') as table_3;
grant select on at_club to authenticated;

insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-000000000001', 'Rana Kohli', '+919000000881');

-- A buy-in as the cage writes it, at a moment, in cash or from bonus.
create function pg_temp.buy_in(p_session uuid, p_method text, p_paise bigint, p_at timestamptz) returns void language sql as $$
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, session_id, ledger_transaction_id, cashier_staff_id,
                                       idempotency_key, created_at)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d1', 'buy_in', p_method, p_paise, p_session,
         private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'buy_in', 'test-replay:' || gen_random_uuid(), jsonb_build_array(
           jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                             and a.code = 'venue.cash_drawer' and a.member_id is null), 'amount', p_paise::text),
           jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                             and a.code = 'venue.chips_outstanding' and a.member_id is null), 'amount', (-p_paise)::text)),
           null, 'Test buy-in'),
         (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
         gen_random_uuid(), p_at;
$$;

-- Her visit three club days ago: 14:00 to 20:00 IST, moved from Table 1 to Table 3 at 15:30, closed at 20:30.
create temp table played (session_id uuid, visit_id uuid);
with visit as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d1', day_began + interval '8 hours',
         day_began + interval '14 hours 30 minutes', 'cash_out' from at_club
  returning id
), session as (
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d1', visit.id, at_club.table_3, 7,
         day_began + interval '8 hours', day_began + interval '9 hours 30 minutes', day_began + interval '14 hours', 'cash_out'
  from visit, at_club
  returning id, visit_id
)
insert into played select session.id, session.visit_id from session;
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
select '00000000-0000-4000-8000-000000000001', played.session_id, at_club.table_1, 7, at_club.table_3, 7, day_began + interval '9 hours 30 minutes'
from played, at_club;
insert into public.points_earning (venue_id, member_id, visit_id, basis, session_id, table_id, played_seconds, rate, points)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d1', played.visit_id, 'hours', played.session_id,
       at_club.table_3, 21600, 10, 60
from played, at_club;
select pg_temp.buy_in(session_id, 'cash', 1000000, (select day_began + interval '9 hours' from at_club)) from played;
select pg_temp.buy_in(session_id, 'bonus', 500000, (select day_began + interval '10 hours' from at_club)) from played;
select pg_temp.buy_in(session_id, 'cash', 500000, private.tonight_began(now()) - interval '8 days') from played;
select pg_temp.buy_in(session_id, 'cash', 500000, now()) from played;

-- Rana's events in the replay: those at the times of her visit, which no other member shares.
create function pg_temp.events(p_trigger text, p_conditions jsonb) returns setof jsonb language sql as $$
  select e from jsonb_array_elements(public.promotion_replay('00000000-0000-4000-8000-000000000001', p_trigger, p_conditions) -> 'events') e,
                at_club c
  where (e ->> 'at')::timestamptz in (c.day_began + interval '9 hours', c.day_began + interval '10 hours', c.day_began + interval '14 hours 30 minutes');
$$;
grant execute on function pg_temp.events(text, jsonb) to authenticated;

-- Who may ask, and for what.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.promotion_replay('00000000-0000-4000-8000-000000000001', 'buy_in', '{}') $$, '42501', null,
  'a cashier simulates no promotion');
select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select throws_ok($$ select public.promotion_replay('00000000-0000-4000-8000-000000000002', 'buy_in', '{}') $$, '42501', null,
  'nor does an admin of the club for the practice venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.promotion_replay('00000000-0000-4000-8000-000000000001', 'check_in', '{}') $$, '22023', null,
  'only buy-ins and hours played are replayed');
select throws_ok($$ select public.promotion_replay('00000000-0000-4000-8000-000000000001', 'buy_in', '{"new_player": true}') $$, '22023', null,
  'and not a rule that asks about past visits');

-- The last seven whole club days.
select results_eq($$ select (p ->> 'to')::timestamptz, (p ->> 'from')::timestamptz
                     from (select public.promotion_replay('00000000-0000-4000-8000-000000000001', 'buy_in', '{}') as p) r $$,
  $$ select today_began, today_began - interval '7 days' from at_club $$,
  'last week is the seven club days before today''s, from 06:00 IST');

-- Buy-ins: her own money, at the table she sat at then; eight days ago and today are not last week.
select results_eq($$ select (e ->> 'amount_paise')::bigint, e ->> 'stake', (e ->> 'table_id')::uuid
                     from pg_temp.events('buy_in', '{}') e order by e ->> 'at' $$,
  $$ select 1000000::bigint, 'nlh_50_100'::text, table_1 from at_club
     union all select 0::bigint, 'nlh_100_200'::text, table_3 from at_club $$,
  'her two buy-ins last week: ₹10,000 of her own at Table 1 before her move, and ₹0 from bonus at Table 3 after it');
select is((select count(distinct e ->> 'member') from pg_temp.events('buy_in', '{}') e), 1::bigint, 'both are the same member in the replay');
select is_empty($$ select 1 from jsonb_array_elements(public.promotion_replay('00000000-0000-4000-8000-000000000001', 'buy_in', '{}') -> 'events') e
                   where e ? 'member_id' or jsonb_typeof(e -> 'member') <> 'number' $$,
  'a member is a number within the replay, never an id');

-- Hours played: the whole visit, or only the time inside a rule's window.
select results_eq($$ select (e ->> 'hours_played')::numeric, (e ->> 'points')::bigint, e ->> 'stake', (e ->> 'at')::timestamptz
                     from pg_temp.events('hours_played', '{"stakes": ["nlh_100_200"]}') e $$,
  $$ select 6.00::numeric, 60::bigint, 'nlh_100_200'::text, day_began + interval '14 hours 30 minutes' from at_club $$,
  'her six hours and 60 points, at the table she played longest, when the visit closed');
select is((select (e ->> 'hours_played')::numeric from pg_temp.events('hours_played',
            jsonb_build_object('days', jsonb_build_array(extract(isodow from (select day_began from at_club) at time zone 'Asia/Kolkata')::integer),
                               'from', '14:00', 'until', '17:00')) e),
  3.00::numeric, 'a 14:00 to 17:00 window that day counts three of them, at both tables');
select is_empty($$ select 1 from pg_temp.events('hours_played',
                     jsonb_build_object('days', jsonb_build_array(1 + extract(isodow from (select day_began from at_club) at time zone 'Asia/Kolkata')::integer % 7),
                                        'from', '14:00', 'until', '17:00')) $$,
  'a window on another day counts none, so the visit is not replayed');

-- Reading changes nothing, so it answers while the club is frozen.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.promotion_replay('00000000-0000-4000-8000-000000000001', 'buy_in', '{}') $$, 'and while the club is frozen');

select * from finish();
rollback;
