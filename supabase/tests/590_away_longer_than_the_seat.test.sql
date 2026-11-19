-- Edit visit says when time away is longer than its seat (the owner, 19 Nov): correct_visit refuses it with a code of its
-- own, RVAWL, and every other refusal stays 22023. 101 Vikram is a super admin. 211 Ishaan sat at Table 3 from 120 to 30
-- minutes ago; 213 Mihir has sat at Table 2 for the last 45 minutes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor is set aside, so this test seats its own players.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
update public.visit set closed_at = now(), close_reason = 'door' where closed_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- One seat's correction as the console sends it, in a call with a reason.
create function pg_temp.fix(p_visit text, p_session text, p_away integer, p_end timestamptz default null)
returns table (refused integer, given_above integer) language sql as $$
  select * from public.correct_visit(('00000000-0000-4000-8000-0000000590' || p_visit)::uuid,
    jsonb_build_array(jsonb_build_object('sessionId', ('00000000-0000-4000-8000-0000000590' || p_session)::uuid, 'awaySeconds', p_away, 'endedAt', p_end)),
    'Card times');
$$;
grant execute on function pg_temp.as_person(text), pg_temp.fix(text, text, integer, timestamptz) to authenticated;

insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000590a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '125 minutes', now() - interval '25 minutes', 'door'),
  ('00000000-0000-4000-8000-0000000590a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '50 minutes', null, null);
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds, call_time_minutes)
select ('00000000-0000-4000-8000-0000000590' || x.session)::uuid, '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || x.member)::uuid,
       ('00000000-0000-4000-8000-0000000590' || x.visit)::uuid, t.id, 1, now() - x.began, now() - x.began, now() - x.ended,
       case when x.ended is null then null else 'left' end, 0, 0
from (values ('b1', '211', 'a1', 'Table 3', interval '120 minutes', interval '30 minutes'),
             ('b2', '213', 'a2', 'Table 2', interval '45 minutes', null)) x (session, member, visit, tbl, began, ended)
join public.game_table t on t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = x.tbl;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
-- A seat that is over: 90 minutes from when he sat to when he left.
select throws_ok($$ select * from pg_temp.fix('a1', 'b1', 91 * 60) $$, 'RVAWL', null,
  'time away longer than a seat that is over is a refusal of its own');
select throws_ok($$ select * from pg_temp.fix('a1', 'b1', 61 * 60, now() - interval '60 minutes') $$, 'RVAWL', null,
  'held to the end sent with it: left 60 minutes after he sat, 61 away is too long');
-- A seat still taken runs to now.
select throws_ok($$ select * from pg_temp.fix('a2', 'b2', 46 * 60) $$, 'RVAWL', null, 'and a seat still taken to now');
-- Every other refusal keeps 22023: an end before he sat.
select throws_ok($$ select * from pg_temp.fix('a1', 'b1', 0, now() - interval '300 minutes') $$, '22023', null,
  'another rule the times break stays 22023');
-- Time away as long as the seat is kept.
select lives_ok($$ select * from pg_temp.fix('a1', 'b1', 90 * 60) $$, 'time away as long as the seat is saved');
select is((select away_seconds from public.seat_session where id = '00000000-0000-4000-8000-0000000590b1'), 90 * 60, 'and kept');

select * from finish();
rollback;
