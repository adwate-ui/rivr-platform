-- Rosters and attendance (#106; scope-v1 module 10; decision 0236). Aditya (103, an admin who manages staff) rosters
-- 38 of the club's team for next week by job title, 18:00 to 02:00 each night: 266 shifts. A shift that would overlap
-- one rostered is refused; a night shift ends the next morning. He takes one shift off, copies the week to the week
-- after, and records tonight's attendance for Sana (104): present, then corrected to late. Farhan (190, the front desk)
-- rosters nothing; Sana sees her own shifts only. Then the refusals, the small hours, another venue's roster, the audit
-- log and a frozen venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The club day now (06:00 to 06:00 IST), and next week's first club day.
create temp table days as
  select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - interval '6 hours'))::date as today,
         (date_trunc('day', (now() at time zone 'Asia/Kolkata') - interval '6 hours'))::date + 7 as next_week;
create temp table team as
  select s.id, s.job_title from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.is_active
  order by s.job_title, s.full_name limit 38;
grant select on days, team to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array(select id from team), array[(select next_week from days)], '18:00', '02:00') $$,
  '42501', null, 'the front desk rosters no one');

-- The week, by job title.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table added as
  select t.job_title, public.add_shifts('00000000-0000-4000-8000-000000000001', array_agg(t.id),
                                        array(select (select next_week from days) + n from generate_series(0, 6) n), '18:00', '02:00') as shifts
  from team t group by t.job_title;
select is((select sum(shifts)::integer from added), 266, 'the 38-person team rostered for the week by job title: 266 shifts');
select is((select count(*)::integer from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days))), 266,
  'the week''s roster holds every one');
select is((select count(distinct staff_id)::integer from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days))), 38,
  'for all 38');
select results_eq($$ select ends_at - starts_at, (starts_at at time zone 'Asia/Kolkata')::time, club_day = (select next_week from days)
                     from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days)) order by starts_at limit 1 $$,
  $$ values (interval '8 hours', time '18:00', true) $$, 'a night shift from 18:00 ends at 02:00 the next morning');
select ok((select bool_and(job_title = (select s.job_title from public.staff s where s.id = r.staff_id))
           from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days)) r), 'each shift by the job title held');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from team limit 1)], array[(select next_week from days)], '20:00', '23:00') $$,
  'RVOVL', null, 'a shift that would overlap one rostered is refused');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from team limit 1)], array[(select next_week from days) + 20], '6pm', '02:00') $$,
  '22023', null, 'times as HH:MM');

-- One off, then the week copied a week on.
select lives_ok($$ select public.remove_shift((select shift_id from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days)) limit 1)) $$,
  'a shift taken off the roster');
select is(public.copy_roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days), (select next_week + 7 from days)), 265,
  'the week copied to the next: 265 shifts');
select is(public.copy_roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days), (select next_week + 7 from days)), 0,
  'and copied again, nothing overlaps');

-- Tonight's attendance.
create temp table sana as select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001';
grant select on sana to authenticated;
select is(public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select today from days)], '06:30', '07:00'), 1,
  'Sana is rostered tonight');
create temp table tonight as select shift_id from public.roster_week('00000000-0000-4000-8000-000000000001', (select today from days))
  where staff_id = (select id from sana) and club_day = (select today from days);
grant select on tonight to authenticated;
select lives_ok($$ select public.record_attendance((select shift_id from tonight), 'present') $$, 'she is recorded present');
select lives_ok($$ select public.record_attendance((select shift_id from tonight), 'late', 'Came at 07:20') $$, 'then corrected: late, with a note');
select results_eq($$ select attendance, note from public.roster_week('00000000-0000-4000-8000-000000000001', (select today from days)) where shift_id = (select shift_id from tonight) $$,
  $$ values ('late'::text, 'Came at 07:20'::text) $$, 'the roster shows it');
select throws_ok($$ select public.record_attendance((select shift_id from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days)) limit 1), 'present') $$,
  '22023', null, 'a shift still to come has no attendance yet');
select throws_ok($$ select public.remove_shift((select shift_id from tonight)) $$, '22023', null, 'a shift with attendance stays on the roster');

-- What the roster refuses, and the small hours.
select throws_ok($$ select public.remove_shift(gen_random_uuid()) $$, '22023', null, 'no such shift to take off');
select throws_ok($$ select public.record_attendance(gen_random_uuid(), 'present') $$, '22023', null, 'nor to record');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select today - 1 from days)], '18:00', '02:00') $$,
  '22023', null, 'a day already past is not rostered');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)],
                                             array(select (select next_week + 30 from days) + n from generate_series(0, 14) n), '18:00', '02:00') $$,
  '22023', null, 'nor more than 14 days at once');
select throws_ok($$ select public.copy_roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days), (select next_week + 14 from days)) $$,
  '22023', null, 'a week copies only into the week after it');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select next_week + 30 from days)], '10:00', '09:00') $$,
  '22023', null, 'a shift runs at most 16 hours');
select is(public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select next_week + 30 from days)], '02:00', '05:00'), 1,
  'a shift from 02:00 to 05:00');
select results_eq($$ select (starts_at at time zone 'Asia/Kolkata')::date - club_day, ends_at - starts_at
                     from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week + 30 from days)) where staff_id = (select id from sana) $$,
  $$ values (1, interval '3 hours') $$, 'falls in the small hours after its club day''s evening');

-- Only staff who manage staff change the roster.
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.remove_shift((select shift_id from tonight)) $$, '42501', null, 'the front desk takes no shift off');
select throws_ok($$ select public.copy_roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days), (select next_week + 7 from days)) $$,
  '42501', null, 'copies no week');
select throws_ok($$ select public.record_attendance((select shift_id from tonight), 'absent') $$, '42501', null, 'and records no attendance');

-- Sana sees her own shifts and attendance only; another cashier does not see hers.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select ok((select count(*) > 0 and bool_and(staff_id = (select id from sana)) from public.staff_shift), 'Sana sees her own shifts, and only hers');
select is((select status from public.staff_attendance where shift_id = (select shift_id from tonight)), 'late', 'and her own attendance');
select is_empty($$ select * from public.roster_week('00000000-0000-4000-8000-000000000001', (select today from days)) $$, 'not the roster');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select next_week + 20 from days)], '18:00', '02:00') $$,
  '42501', null, 'and rosters no one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select is_empty($$ select * from public.staff_attendance where shift_id = (select shift_id from tonight) $$, 'another cashier does not see Sana''s attendance');

-- Another venue's roster: Aditya does not manage the practice venue's staff here.
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000002';
insert into public.staff_shift (venue_id, staff_id, club_day, starts_at, ends_at, job_title)
select s.venue_id, s.id, d.today, now(), now() + interval '1 hour', s.job_title from public.staff s, days d
where s.venue_id = '00000000-0000-4000-8000-000000000002' and s.user_id = '00000000-0000-4000-8000-000000000104';
create temp table practice_shift as select h.id, h.staff_id from public.staff_shift h where h.venue_id = '00000000-0000-4000-8000-000000000002';
grant select on practice_shift to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.roster_week('00000000-0000-4000-8000-000000000002', (select today from days)) $$, 'Aditya sees no other venue''s roster');
select is_empty($$ select * from public.staff_shift where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'nor its shifts');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000002', array(select staff_id from practice_shift), array[(select next_week from days)], '18:00', '02:00') $$,
  '42501', null, 'rosters no one there');
select throws_ok($$ select public.remove_shift((select id from practice_shift)) $$, '42501', null, 'takes no shift off there');
select throws_ok($$ select public.record_attendance((select id from practice_shift), 'present') $$, '42501', null, 'records no attendance there');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array(select staff_id from practice_shift), array[(select next_week + 40 from days)], '18:00', '02:00') $$,
  '22023', null, 'and rosters no one from another venue here');

-- The audit log: shifts added and taken off, and attendance by its status, never its note.
reset role;
select ok(exists (select 1 from public.audit_log where entity = 'staff_shift' and action = 'insert'), 'a shift added is audited');
select ok(exists (select 1 from public.audit_log where entity = 'staff_shift' and action = 'delete'), 'and one taken off');
select results_eq($$ select before ->> 'status', after ->> 'status' from public.audit_log where entity = 'staff_attendance' and action = 'staff.attendance'
                     order by before is not null $$,
  $$ values (null::text, 'present'::text), ('present', 'late') $$, 'attendance is audited by its status, before and after');
select is((select count(*)::integer from public.audit_log where entity = 'staff_attendance' and coalesce(before::text, '') || after::text like '%07:20%'), 0,
  'never its note');

-- A frozen venue's roster does not change.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Roster test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_shifts('00000000-0000-4000-8000-000000000001', array[(select id from sana)], array[(select next_week + 50 from days)], '18:00', '02:00') $$,
  'RVFRZ', null, 'frozen: no shifts added');
select throws_ok($$ select public.remove_shift((select shift_id from public.roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days)) limit 1)) $$,
  'RVFRZ', null, 'none taken off');
select throws_ok($$ select public.copy_roster_week('00000000-0000-4000-8000-000000000001', (select next_week from days), (select next_week + 7 from days)) $$,
  'RVFRZ', null, 'no week copied');
select throws_ok($$ select public.record_attendance((select shift_id from tonight), 'absent') $$, 'RVFRZ', null, 'and no attendance recorded');

select * from finish();
rollback;
