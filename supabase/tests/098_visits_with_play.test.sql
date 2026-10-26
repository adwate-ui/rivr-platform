-- A visit with no play does not count toward the month (#448; decision 0180): only one with seated time,
-- or an hour or more in the club, counts in private.visits_this_month, and so in the cab's fourth visit
-- and every promotion's min_visits_in_month. 213 Mihir is a member; January 2026 is long before anything
-- seeded.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.at(p_day integer, p_minutes integer) returns timestamptz language sql as $$
  select ('2026-01-' || lpad(p_day::text, 2, '0') || 'T20:00:00+05:30')::timestamptz + make_interval(mins => p_minutes);
$$;

-- Six visits in January, each from 20:00 on its day for as many minutes as given.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select ('00000000-0000-4000-8000-0000000a980' || v.n)::uuid, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
       pg_temp.at(v.day, 0), pg_temp.at(v.day, v.minutes), 'door'
from (values (1, 3, 10), (2, 5, 10), (3, 7, 120), (4, 9, 59), (5, 10, 60), (6, 11, 5)) as v (n, day, minutes);
-- On the 5th he sat at Table 2 for six minutes; on the 11th a seat opened and ended in the same moment.
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', s.visit::uuid, g.id, 4, s.started, s.started, s.ended, 'left'
from (values ('00000000-0000-4000-8000-0000000a9802', pg_temp.at(5, 2), pg_temp.at(5, 8)),
             ('00000000-0000-4000-8000-0000000a9806', pg_temp.at(11, 1), pg_temp.at(11, 1))) as s (visit, started, ended)
join public.game_table g on g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';

select is(private.visits_this_month('00000000-0000-4000-8000-000000000213', '2026-01-31T23:00:00+05:30'), 3,
  'three of the six count: six minutes seated, two hours in the club, and exactly an hour');
select is(private.visits_this_month('00000000-0000-4000-8000-000000000213', '2026-01-08T12:00:00+05:30'), 2,
  'by the 8th, the seated visit and the two-hour one; ten minutes at the door is no visit');
select is(private.visits_this_month('00000000-0000-4000-8000-000000000213', '2026-01-09T23:00:00+05:30'), 2,
  'nor are 59 minutes with no seat');
select is(private.visits_this_month('00000000-0000-4000-8000-000000000213', '2026-01-11T23:00:00+05:30'), 3,
  'nor a seat that never had any time');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000213', null, '2026-01-31T23:00:00+05:30') -> 'visits_in_month', '3'::jsonb,
  'and the promotions engine reads the same count');

-- Scanning in and out at the door four more times on the 20th, ten minutes each, brings no fourth visit.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', pg_temp.at(20, n * 15), pg_temp.at(20, n * 15 + 10), 'door'
from generate_series(0, 3) as n;
select is(private.visits_this_month('00000000-0000-4000-8000-000000000213', '2026-01-31T23:00:00+05:30'), 3,
  'four short scans at the door earn no fourth visit for the cab');

select * from finish();
rollback;
