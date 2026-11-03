-- A super admin withdraws an early departure recorded by mistake (owner, 3 Nov; decision 0500). Kunal (216) was let go
-- early at the club, and a member of the practice venue there. Only a super admin of the venue withdraws one (101, the
-- owner; not 103, an admin), with a reason of three characters or more in words, once. The early departure is kept,
-- marked withdrawn, and audited with who, when and why; it no longer counts on the record. Nothing reaches an outside
-- system, from the practice venue or the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An early departure at a venue: a visit, a seat left before call time, and the admin's reason.
create function pg_temp.let_go_early(p_venue_id uuid, p_member_id uuid, p_staff_user uuid) returns uuid language plpgsql as $$
declare
  v_visit uuid;
  v_session uuid;
  v_departure uuid;
begin
  insert into public.visit (venue_id, member_id, opened_at) values (p_venue_id, p_member_id, now() - interval '20 minutes') returning id into v_visit;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select p_venue_id, p_member_id, v_visit, g.id, 9, now() - interval '15 minutes', now() - interval '15 minutes', now(), 'left'
  from public.game_table g where g.venue_id = p_venue_id order by g.position limit 1
  returning id into v_session;
  insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
  select p_venue_id, p_member_id, v_visit, v_session, 9900, 'Family emergency', s.id
  from public.staff s where s.venue_id = p_venue_id and s.user_id = p_staff_user
  returning id into v_departure;
  return v_departure;
end;
$$;

create temporary table ids (name text primary key, id uuid);
insert into ids values ('club', pg_temp.let_go_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
                                                     '00000000-0000-4000-8000-000000000103'));
insert into ids select 'practice', pg_temp.let_go_early('00000000-0000-4000-8000-000000000002', m.id, '00000000-0000-4000-8000-000000000101')
from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000002' order by m.member_number limit 1;
create temporary table outbox_before as select count(*) as n from public.outbox_event;
grant select on ids, outbox_before to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), 'Recorded against the wrong member') $$,
  '42501', null, 'an admin withdraws none: only a super admin does');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), '  ') $$, '22023', null, 'a reason is required');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), 'ok') $$, '22023', null,
  'of three characters or more');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), '1234') $$, '22023', null, 'and in words');
select lives_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), 'Recorded against the wrong member') $$,
  'the owner withdraws Kunal''s early departure');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club'), 'Twice over') $$, 'RVDEC', null, 'once');

select results_eq(
  $$ select reason, withdrawn_reason, withdrawn_by is not null from public.member_early_departures('00000000-0000-4000-8000-000000000001',
                                                                                                  '00000000-0000-4000-8000-000000000216')
     where early_departure_id = (select id from ids where name = 'club') $$,
  $$ values ('Family emergency'::text, 'Recorded against the wrong member'::text, true) $$,
  'the record lists it, kept, marked withdrawn with the reason and who');
select is((select early_departures from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216')),
  (select count(*)::integer from public.early_departure e where e.member_id = '00000000-0000-4000-8000-000000000216') - 1,
  'and it no longer counts on his record');
reset role;
select set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from public.early_departure where id = (select id from ids where name = 'club')), 'the early departure is not deleted');
select throws_ok($$ delete from public.early_departure_withdrawal $$, '42501', null, 'and the withdrawal is never undone by a delete');
select results_eq(
  $$ select actor_user_id, reason, after ->> 'reason' from public.audit_log
     where entity = 'early_departure_withdrawal' and after ->> 'early_departure_id' = (select id::text from ids where name = 'club') $$,
  $$ values ('00000000-0000-4000-8000-000000000101'::uuid, 'Recorded against the wrong member'::text, 'Recorded against the wrong member'::text) $$,
  'the audit log says who, when and why');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.withdraw_early_departure((select id from ids where name = 'practice'), 'Training mistake') $$,
  'a super admin withdraws one in the practice venue too');
reset role;
select is((select count(*) from public.outbox_event), (select n from outbox_before), 'and nothing goes to an outside system, from either venue');

-- A super admin of another venue only withdraws none here: the practice venue's own super admin, made for this test.
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000214', 'Practice-only super admin', 'Duty manager', 'super_admin');
insert into ids select 'club-2', pg_temp.let_go_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215',
                                                       '00000000-0000-4000-8000-000000000103');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club-2'), 'Wrong member') $$, '42501', null,
  'a super admin of another venue withdraws none of the club''s');
reset role;

-- Nothing is withdrawn while the member or the venue is frozen.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000215', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club-2'), 'Wrong member') $$, 'RVMBR', null,
  'nor while the member is frozen');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.withdraw_early_departure((select id from ids where name = 'club-2'), 'Wrong member') $$, 'RVFRZ', null,
  'nor while the venue is frozen');

-- The withdrawals are read by staff who read members at their venue only.
select ok((select count(*) > 0 from public.early_departure_withdrawal), 'the owner reads the club''s withdrawals');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.early_departure_withdrawal $$, 'a dealer, who reads no members, reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select is_empty($$ select 1 from public.early_departure_withdrawal where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'an admin at the club alone reads none of the practice venue''s');
reset role;

select * from finish();
rollback;
