-- Seats left open overnight are noticed: once a night, a venue with a seat taken before the night's end and still open
-- raises floor.seats_left_open with the count. A seat taken tonight, a seat that ended and the practice venue raise nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.alert;
-- Nothing of the seed's is open, so only this test's seats count.
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.table_id(p_venue uuid, p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = p_venue and name = p_name;
$$;
create temp table night as select private.tonight_began(now()) as began;

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-000000000001', 'Left Overnight', '+919000077291'),
  ('00000000-0000-4000-8000-0000000002d2', '00000000-0000-4000-8000-000000000001', 'Here Tonight', '+919000077292'),
  ('00000000-0000-4000-8000-0000000002d3', '00000000-0000-4000-8000-000000000001', 'Went Home', '+919000077293'),
  ('00000000-0000-4000-8000-0000000002d4', '00000000-0000-4000-8000-000000000002', 'Practice Player', '+919000077294');
insert into public.visit (id, venue_id, member_id, opened_at)
select ('00000000-0000-4000-8000-0000000a41' || right(m.id::text, 2))::uuid, m.venue_id, m.id, (select began from night) - interval '4 hours'
from public.member m where m.id::text like '00000000-0000-4000-8000-0000000002d_';

select is(private.alert_seats_left_open(), 0, 'with no seat open, nothing is raised');

-- One seat ended last night, one was taken tonight, and the practice venue has one left open.
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d3', '00000000-0000-4000-8000-0000000a41d3',
   pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 1'), 3,
   (select began from night) - interval '3 hours', (select began from night) - interval '3 hours', (select began from night) - interval '1 hour', 'left'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d2', '00000000-0000-4000-8000-0000000a41d2',
   pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 1'), 2, now(), now(), null, null),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000002d4', '00000000-0000-4000-8000-0000000a41d4',
   pg_temp.table_id('00000000-0000-4000-8000-000000000002', 'Table 2'), 1,
   (select began from night) - interval '3 hours', (select began from night) - interval '3 hours', null, null);
select is(private.alert_seats_left_open(), 0, 'a seat that ended, one taken tonight and the practice venue raise nothing');

-- A seat taken last night and never ended.
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-0000000a41d1',
   pg_temp.table_id('00000000-0000-4000-8000-000000000001', 'Table 1'), 1,
   (select began from night) - interval '3 hours', (select began from night) - interval '3 hours');
select is(private.alert_seats_left_open(), 1, 'a seat taken before the night ended and still open raises an alert');
select results_eq($$ select venue_id, detail from public.alert where kind = 'floor.seats_left_open' $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, '{"seats": 1}'::jsonb) $$, 'for its venue, with the count and no name');
select is(private.alert_seats_left_open(), 0, 'once a night');

select ok(exists (select 1 from cron.job where jobname = 'seats-left-open' and schedule = '45 0 * * *'), 'pg_cron asks each morning at 06:15 IST');
select is(has_function_privilege('authenticated', 'private.alert_seats_left_open()', 'execute'), false, 'nobody signed in runs it');

select * from finish();
rollback;
