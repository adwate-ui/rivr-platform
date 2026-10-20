-- Contacts, the incident log and drills (#53, decision 0113): staff read the club's contacts and SOP
-- managers keep them; every staff member logs an incident with its severity, CCTV reference and SOP, kept as
-- logged and read by its logger, SOP managers and the audit; SOP managers schedule drills a quarter apart and
-- mark them held. 103 Aditya an admin (SOP manager), 106 Pema a dealer, 107 marketing, 109 the investor
-- (reads the audit). Contacts from seed 44_contacts.sql; SOPs from add_training_sops.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table sops on commit drop as
select s.venue_id, s.id from public.sop s where s.title = (select min(title) from public.sop where venue_id = s.venue_id);
grant select on sops to authenticated;

-- Contacts.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select kind::text, name, phone from public.contact where kind in ('police', 'fire', 'electricity') order by kind $$,
  $$ values ('electricity'::text, 'DHBVN'::text, '1912'::text), ('fire', 'Fire service', '101'), ('police', 'Police', '112') $$,
  'every staff member reads the police, fire and DHBVN numbers');
select ok((select count(*) from public.contact where kind = 'escalation') >= 2, 'and the escalation matrix');
select throws_ok($$ insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000001', 'vendor', 'Shuffler', '+91 98765 43210') $$,
  '42501', null, 'a dealer keeps no contacts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into public.contact (venue_id, kind, position, name, role, phone) values
                   ('00000000-0000-4000-8000-000000000001', 'vendor', 3, 'Shuffler service', 'Card shufflers', '+91 98765 43210') $$,
  'an SOP manager adds a vendor');
select throws_ok($$ insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000001', 'vendor', 'X', 'call me') $$,
  '23514', null, 'with a number, not words');

-- Incidents.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select lives_ok($$ insert into public.incident (venue_id, severity, summary, cctv_reference, sop_id, logged_by_staff_id)
                   values ('00000000-0000-4000-8000-000000000001', 'high', 'A player disputed a pot at Table 3', 'Camera 4, 23:10',
                           (select id from sops where venue_id = '00000000-0000-4000-8000-000000000001'), gen_random_uuid()) $$,
  'a dealer logs an incident with its severity, the camera and the SOP it follows');
select results_eq($$ select i.severity::text, i.cctv_reference, s.user_id from public.incident i join public.staff s on s.id = i.logged_by_staff_id $$,
  $$ values ('high'::text, 'Camera 4, 23:10'::text, '00000000-0000-4000-8000-000000000106'::uuid) $$,
  'logged by the dealer, whatever id was sent, and the dealer reads it back');
select throws_ok($$ update public.incident set severity = 'low' $$, '42501', null, 'nobody signed in changes an incident');
select throws_ok($$ insert into public.incident (venue_id, severity, summary, sop_id)
                   values ('00000000-0000-4000-8000-000000000001', 'low', 'Wrong SOP', (select id from sops where venue_id = '00000000-0000-4000-8000-000000000002')) $$,
  '23503', null, 'and an incident follows an SOP of its own venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select * from public.incident $$, 'other staff do not read it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.incident where venue_id = '00000000-0000-4000-8000-000000000001'), 1, 'an SOP manager reads every incident');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select count(*)::integer from public.incident where venue_id = '00000000-0000-4000-8000-000000000001'), 1, 'and so does the audit');
reset role;
select throws_ok($$ update public.incident set severity = 'low' $$, '22023', null, 'an incident is kept as logged');
select throws_ok($$ delete from public.incident $$, '22023', null, 'and never removed');

-- Drills.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.schedule_drills('00000000-0000-4000-8000-000000000001', 'Outage drill', '2026-11-20') $$,
  '42501', null, 'a dealer schedules no drill');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.schedule_drills('00000000-0000-4000-8000-000000000001', 'Outage drill', '2026-11-20',
          (select id from sops where venue_id = '00000000-0000-4000-8000-000000000001')), 4, 'an SOP manager schedules a year of drills');
select results_eq($$ select scheduled_on from public.drill where title = 'Outage drill' order by scheduled_on $$,
  $$ values ('2026-11-20'::date), ('2027-02-20'), ('2027-05-20'), ('2027-08-20') $$, 'a quarter apart');
select lives_ok($$ select public.hold_drill((select id from public.drill where scheduled_on = '2026-11-20'), 'Slips all ticked') $$,
  'and marks the first held');
select throws_ok($$ select public.hold_drill((select id from public.drill where scheduled_on = '2026-11-20'), 'Again') $$,
  'RVDUP', null, 'once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select held_on is not null, notes from public.drill where scheduled_on = '2026-11-20' $$,
  $$ values (true, 'Slips all ticked'::text) $$, 'every staff member reads the drills');

-- Last, since the freeze stays on until the test rolls back.
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select lives_ok($$ insert into public.incident (venue_id, severity, summary) values ('00000000-0000-4000-8000-000000000001', 'critical', 'Power cut on the floor') $$,
  'incidents are logged while the venue is frozen, when they happen');

select * from finish();
rollback;
