-- A visit nobody checked out ends with its night when its seat was let go the next morning (#1092): the seat's end is
-- stamped at 06:00 (private.seat_end_stamp), the start of the new club day, and that is still last night's, so the visit
-- closes then and tonight's seat starts a visit of its own. A seat played on past 06:00 keeps its visit, as before. Mihir
-- (213) and Yash (214) sat at Table 5 last night and were never checked out; 103 Aditya is a floor manager.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
-- Last night at 22:00 IST: a visit and a seat at Table 5, never closed.
create function pg_temp.last_night(p_member text, p_seat integer) returns uuid language plpgsql as $$
declare
  v_visit uuid;
begin
  insert into public.visit (venue_id, member_id, opened_at)
  values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid, private.tonight_began(now()) - interval '8 hours')
  returning id into v_visit;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds)
  values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid, v_visit, pg_temp.table_id('Table 5'),
          p_seat, private.tonight_began(now()) - interval '8 hours', private.tonight_began(now()) - interval '8 hours', 0);
  return v_visit;
end;
$$;
grant execute on function pg_temp.table_id(text) to authenticated;
create temp table visits on commit drop as
select pg_temp.last_night('213', 8) as mihir, pg_temp.last_night('214', 9) as yash;
grant select on visits to authenticated;

-- Mihir's seat was let go this morning: its end stamped at 06:00, as seat_end_stamp does after 08:00.
update public.seat_session set ended_at = private.tonight_began(now()), end_reason = 'left' where visit_id = (select mihir from visits);
-- Yash played on past 06:00: his seat ended between 06:00 and now.
update public.seat_session set ended_at = private.tonight_began(now()) + (now() - private.tonight_began(now())) / 2, end_reason = 'left'
where visit_id = (select yash from visits);

select private.close_stale_visit('00000000-0000-4000-8000-000000000213');
select results_eq($$ select closed_at = private.tonight_began(now()), close_reason from public.visit where id = (select mihir from visits) $$,
  $$ values (true, 'end_of_day'::text) $$, 'a seat stamped at 06:00 is last night''s: the visit closes with its night');
select private.close_stale_visit('00000000-0000-4000-8000-000000000214');
select is((select closed_at from public.visit where id = (select yash from visits)), null::timestamptz,
  'one who played on past 06:00 keeps the visit until they leave');

-- Tonight the floor seats Mihir again: a visit of tonight's own, last night's left as it closed.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}', true);
select public.seat_member(pg_temp.table_id('Table 5'),
         (select min(n)::integer from generate_series(1, 10) n where not exists (select 1 from public.seat_session s
            where s.table_id = pg_temp.table_id('Table 5') and s.seat = n and s.ended_at is null)), p_member_number => (select member_number from public.member
         where id = '00000000-0000-4000-8000-000000000213'), p_call_minutes => 0);
reset role;
select isnt((select s.visit_id from public.seat_session s where s.member_id = '00000000-0000-4000-8000-000000000213' and s.ended_at is null),
  (select mihir from visits), 'tonight''s seat starts a visit of its own');
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null), 1,
  'and only tonight''s is open');

select * from finish();
rollback;
