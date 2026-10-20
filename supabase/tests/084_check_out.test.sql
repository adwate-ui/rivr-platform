-- Check-out at the door (#82, decision 0109): the front desk closes a member's visit, by the card's number
-- or from the room list; the visit's hours are fixed and its points earned (#89); a member still seated is
-- sent to the floor or the cage first (question #410); before call time the call-time rule applies, as at
-- the cage; nothing closes while the member or the venue is frozen. 108 is a host (the front desk); 106
-- Pema a dealer; 103 Aditya an admin; 101 the owner. 213 Mihir and 216 Kunal are members; the seed earns
-- 5 points an hour at 50/100 (Table 1), whose call time is an hour.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The detail a refusal carries (the seconds of call time owed), or null when nothing is refused.
create function pg_temp.refusal_detail(p_sql text) returns text language plpgsql as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end;
$$;
grant execute on function pg_temp.refusal_detail(text) to authenticated;

-- Mihir has played at Table 1 for two hours, well past its call time, and is still seated; Kunal sat
-- down a minute ago and has just left the table.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a8401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-0000000a8402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - interval '10 minutes');
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select s.id, '00000000-0000-4000-8000-000000000001', s.member_id, s.visit_id, g.id, s.seat, now() - s.ago, now() - s.ago
from (values
  ('00000000-0000-4000-8000-0000000b8401'::uuid, '00000000-0000-4000-8000-000000000213'::uuid, '00000000-0000-4000-8000-0000000a8401'::uuid, 7, interval '2 hours'),
  ('00000000-0000-4000-8000-0000000b8402'::uuid, '00000000-0000-4000-8000-000000000216'::uuid, '00000000-0000-4000-8000-0000000a8402'::uuid, 8, interval '1 minute')
) as s (id, member_id, visit_id, seat, ago)
join public.game_table g on g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';
update public.seat_session set ended_at = now(), end_reason = 'left' where id = '00000000-0000-4000-8000-0000000b8402';

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$,
  '42501', null, 'a dealer checks nobody out');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.check_out_by_phone('00000000-0000-4000-8000-000000000001', '90000 00213') $$,
  'RVSTD', null, 'Mihir, still seated with his chips on the table, is sent to the floor or the cage first');
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select v.closed_at is null, s.ended_at is null from public.visit v join public.seat_session s on s.visit_id = v.id
                     where v.id = '00000000-0000-4000-8000-0000000a8401' $$,
  $$ values (true, true) $$, 'his visit and his seat stay open');

-- The floor ends his seat; the door then lets him go.
update public.seat_session set ended_at = now(), end_reason = 'left' where id = '00000000-0000-4000-8000-0000000b8401';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.check_out_by_phone('00000000-0000-4000-8000-000000000001', '90000 00213'), '00000000-0000-4000-8000-0000000a8401'::uuid,
  'the front desk checks Mihir out by the number on his card');
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select close_reason, closed_at is not null from public.visit where id = '00000000-0000-4000-8000-0000000a8401' $$,
  $$ values ('door'::text, true) $$, 'his visit closes at the door');
select ok((select sum(e.points) > 0 and sum(e.played_seconds) between 7100 and 7300 from public.points_earning e
           where e.visit_id = '00000000-0000-4000-8000-0000000a8401'),
  'his two hours are counted and earn him points');
select is((select count(*)::integer from public.outbox_event where event_type = 'visit.closed' and payload ->> 'visit_id' = '00000000-0000-4000-8000-0000000a8401'), 1,
  'visit.closed is emitted once');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$,
  'RVOUT', null, 'a member checked out already is not in the room');
select throws_ok($$ select public.check_out_by_phone('00000000-0000-4000-8000-000000000001', '9000000999') $$,
  'RVNOM', null, 'a number nobody has is no member');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') $$,
  'RVCTS', null, 'before call time, Kunal is refused at the door as at the cage');
select ok(pg_temp.refusal_detail($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') $$)::integer
          between 3500 and 3600, 'and the door is told the call time he still owes');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select closed_at from public.visit where id = '00000000-0000-4000-8000-0000000a8402'), null, 'and his visit stays open');

-- An admin lets him leave early with a reason (#79); the door then lets him go.
insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000a8402',
       '00000000-0000-4000-8000-0000000b8402', 3540, 'Family emergency', s.id
from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000103';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216'), '00000000-0000-4000-8000-0000000a8402'::uuid,
  'let go early, he is checked out');
select is_empty($$ select * from public.door_board('00000000-0000-4000-8000-000000000001')
                   where member_id in ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000216') and is_in_room $$,
  'and neither is on the door''s room list');
reset role;
select set_config('request.jwt.claims', '', true);

-- A close is a write: nothing closes while the member or the venue is frozen.
insert into public.visit (venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '1 minute');
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000213', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$,
  'RVMBR', null, 'a frozen member is not checked out');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') $$,
  'RVFRZ', null, 'and nobody is checked out while the venue is frozen');

select * from finish();
rollback;
