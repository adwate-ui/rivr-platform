-- The SOP library (#51): every venue has the training set (dealer certification, cage, women's safety,
-- AML, table-side food and drink) in force from the day it is loaded; each version names its owner, its
-- day and the roles that must acknowledge it; staff acknowledge the version in force; SOP managers add
-- SOPs, publish versions and see who has acknowledged. 103 Aditya is an admin (manages SOPs), 104 Sana a
-- cashier, 106 Pema a dealer, 201 Arjun a member; 202 Kabir is made a dealer at a new venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;
grant execute on function pg_temp.as_person(text), pg_temp.today() to authenticated, anon;

-- A venue made by operations gets the training set too; Kabir deals there.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f2', 'Elsewhere', 'elsewhere', false, 'Elsewhere', 'Somewhere', 'ELS');
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000000202', 'Kabir Sethi', 'Dealer', 'dealer');

-- The training set.
select results_eq(
  $$ select v.slug, s.title, sv.version, sv.owner, sv.effective_on = (now() at time zone 'Asia/Kolkata')::date
     from public.sop s join public.venue v on v.id = s.venue_id join public.sop_version sv on sv.sop_id = s.id
     where v.slug = 'gurugram' order by s.title $$,
  $$ values ('gurugram', 'Anti-money laundering', 1, 'General manager', true), ('gurugram', 'Cage', 1, 'Duty manager', true),
            ('gurugram', 'Dealer certification', 1, 'Floor manager', true), ('gurugram', 'Table-side food and drink', 1, 'Floor manager', true),
            ('gurugram', 'Women''s safety', 1, 'General manager', true) $$,
  'the club has the training set, each at version 1 with its owner, in force from the day it was loaded');
select results_eq($$ select v.slug, count(*)::integer from public.sop s join public.venue v on v.id = s.venue_id group by v.slug order by v.slug $$,
  $$ values ('elsewhere', 5), ('gurugram', 5), ('practice', 5) $$, 'and so do the practice venue and a venue made later');
select results_eq(
  $$ select s.title, sv.ack_roles::text from public.sop s join public.sop_version sv on sv.sop_id = s.id
     where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.title in ('Cage', 'Dealer certification', 'Table-side food and drink') order by s.title $$,
  $$ values ('Cage', '{cashier}'), ('Dealer certification', '{dealer}'), ('Table-side food and drink', '{dealer,host}') $$,
  'each asks the roles it concerns to acknowledge it');

create temporary table club on commit drop as
select s.title, sv.id as version_id, s.id as sop_id from public.sop s join public.sop_version sv on sv.sop_id = s.id
where s.venue_id = '00000000-0000-4000-8000-000000000001';
create temporary table dealers on commit drop as
select count(*)::integer as n from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and role = 'dealer' and is_active;
grant select on club, dealers to authenticated;

-- Reading.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select id from public.sop $$, 'a member reads no SOPs');
select is_empty($$ select id from public.sop_version $$, 'nor their versions');
select is_empty($$ select * from public.sop_library('00000000-0000-4000-8000-000000000001') $$, 'nor the library');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select distinct venue_id from public.sop $$, $$ values ('00000000-0000-4000-8000-0000000000f2'::uuid) $$,
  'staff of another venue read only theirs');
select results_eq($$ select distinct venue_id from public.sop_version $$, $$ values ('00000000-0000-4000-8000-0000000000f2'::uuid) $$,
  'and only their versions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq(
  $$ select title, version, must_acknowledge, acknowledged_at is null, required_count = (select n from dealers)
     from public.sop_library('00000000-0000-4000-8000-000000000001') where title in ('Cage', 'Dealer certification') order by title $$,
  $$ values ('Cage', 1, false, true, false), ('Dealer certification', 1, true, true, true) $$,
  'the dealer''s library: the dealer certification asks the dealers, the cage does not');

-- Acknowledging.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.acknowledge_sop((select version_id from club where title = 'Dealer certification')) $$, '42501', null,
  'a member acknowledges nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.acknowledge_sop((select version_id from club where title = 'Dealer certification')) $$, '42501', null,
  'nor staff of another venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
create temporary table pema_ack on commit drop as
select public.acknowledge_sop((select version_id from club where title = 'Dealer certification')) as at;
grant select on pema_ack to authenticated;
select is(public.acknowledge_sop((select version_id from club where title = 'Dealer certification')), (select at from pema_ack),
  'the dealer acknowledges the dealer certification; again is the same acknowledgement');
select results_eq(
  $$ select acknowledged_at = (select at from pema_ack), acknowledged_count from public.sop_library('00000000-0000-4000-8000-000000000001')
     where title = 'Dealer certification' $$,
  $$ values (true, 1) $$, 'the library shows it, and one dealer acknowledged');
select results_eq($$ select count(*)::integer from public.sop_ack $$, $$ values (1) $$, 'the dealer sees their own acknowledgement');
select throws_ok($$ select * from public.sop_acknowledgements((select version_id from club where title = 'Dealer certification')) $$,
  '42501', null, 'but not who else has acknowledged');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.sop_ack $$, 'the cashier does not see the dealer''s acknowledgement');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select id from public.sop_ack $$, 'nor does staff of another venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select full_name, acknowledged_at is not null from public.sop_acknowledgements((select version_id from club where title = 'Dealer certification'))
     where full_name = 'Pema Lepcha' $$,
  $$ values ('Pema Lepcha'::text, true) $$, 'an SOP manager sees who has acknowledged');
select results_eq($$ select count(*)::integer from public.sop_ack $$, $$ values (1) $$, 'and every acknowledgement at the venue');

-- Publishing versions.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer}',
  pg_temp.today(), 'New text') $$, '42501', null, 'a dealer publishes nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer}',
  pg_temp.today() - 1, 'New text') $$, '22023', null, 'nobody backdates a version');
select is(public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer,host}',
  pg_temp.today() + 1, 'Version two'), 2, 'an SOP manager publishes version 2 from tomorrow');
select throws_ok($$ select public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer}',
  pg_temp.today(), 'Version three') $$, '22023', null, 'and a later version never takes effect before it');
select results_eq(
  $$ select version, next_version, next_effective_on = pg_temp.today() + 1, acknowledged_count
     from public.sop_library('00000000-0000-4000-8000-000000000001') where title = 'Dealer certification' $$,
  $$ values (1, 2, true, 1) $$, 'version 1 stays in force until tomorrow, with version 2 waiting');
select is(public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer,host}',
  pg_temp.today() + 1, 'Version three'), 3, 'a version 3 for the same day replaces it before it takes effect');
select results_eq(
  $$ select next_version, next_body from public.sop_library('00000000-0000-4000-8000-000000000001') where title = 'Dealer certification' $$,
  $$ values (3, 'Version three'::text) $$, 'so version 3 is the one waiting');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.acknowledge_sop((select v.id from public.sop_version v join club c on c.sop_id = v.sop_id
  where c.title = 'Dealer certification' and v.version = 2)) $$, 'RVSTL', null, 'a version not yet in force is not acknowledged');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.publish_sop_version((select sop_id from club where title = 'Cage'), 'Duty manager', '{cashier}', pg_temp.today(), 'Cage, version two'),
  2, 'a version from today is in force at once');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq(
  $$ select version, body, must_acknowledge, acknowledged_at is null from public.sop_library('00000000-0000-4000-8000-000000000001') where title = 'Cage' $$,
  $$ values (2, 'Cage, version two'::text, true, true) $$, 'and the cashier must acknowledge the new version');
select throws_ok($$ select public.acknowledge_sop((select version_id from club where title = 'Cage')) $$, 'RVSTL', null,
  'not the version it replaced');

-- Adding an SOP.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.add_sop('00000000-0000-4000-8000-000000000001', 'Opening the room', 'Duty manager', '{host}', pg_temp.today(), 'Lights') $$,
  '42501', null, 'a cashier adds no SOP');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.add_sop('00000000-0000-4000-8000-000000000001', 'Opening the room', 'Duty manager', '{host}', pg_temp.today() + 7, 'Lights first.'),
  null, 'an SOP manager adds one, from next week');
select throws_ok($$ select public.add_sop('00000000-0000-4000-8000-000000000001', 'Opening the room', 'Duty manager', '{host}', pg_temp.today(), 'Again') $$,
  '23505', null, 'a title the library has is refused');
select throws_ok($$ select public.add_sop('00000000-0000-4000-8000-000000000001', 'Closing the room', 'Duty manager', '{host}', pg_temp.today() - 1, 'Late') $$,
  '22023', null, 'and an SOP from yesterday');
select is_empty($$ select id from public.sop where title = 'Closing the room' $$, 'which leaves nothing behind');
select results_eq(
  $$ select version is null, next_version, next_owner, next_ack_roles::text, next_body, must_acknowledge, required_count
     from public.sop_library('00000000-0000-4000-8000-000000000001') where title = 'Opening the room' $$,
  $$ values (true, 1, 'Duty manager'::text, '{host}'::text, 'Lights first.'::text, false, 0) $$,
  'it is listed with its first version, owner, roles and text, waiting for its day');
select throws_ok($$ insert into public.sop (venue_id, title) values ('00000000-0000-4000-8000-000000000001', 'Direct') $$, '42501', null,
  'SOPs are written only through these functions');
reset role;
select throws_ok($$ update public.sop_version set body = 'Changed' $$, '42501', null, 'a version is never changed');
select throws_ok($$ delete from public.sop_ack $$, '42501', null, 'nor an acknowledgement removed');

-- Not while the venue is frozen (last: a freeze is released only by two super admins).
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.publish_sop_version((select sop_id from club where title = 'Cage'), 'Duty manager', '{cashier}', pg_temp.today() + 2, 'Frozen') $$,
  'RVFRZ', null, 'nothing is published while the venue is frozen');

select * from finish();
rollback;
