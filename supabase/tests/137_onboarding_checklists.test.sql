-- Onboarding checklists (#107; scope-v1 module 10; decision 0212): each active hire's checklist is the
-- SOPs whose version in force asks their role, and an item ticks when the hire acknowledges that version.
-- A new version reopens it until they acknowledge again (question #483). Staff managers see them.
-- 103 Aditya is an admin, 104 Sana a cashier, 106 Pema a dealer, 201 Arjun a member; 202 Kabir is made
-- an admin at a new venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;
grant execute on function pg_temp.as_person(text), pg_temp.today() to authenticated, anon;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f2', 'Elsewhere', 'elsewhere', false, 'Elsewhere', 'Somewhere', 'ELS');
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000000202', 'Kabir Sethi', 'Floor manager', 'admin');

create temporary table club on commit drop as
select s.title, s.id as sop_id, sv.id as version_id from public.sop s join public.sop_version sv on sv.sop_id = s.id
where s.venue_id = '00000000-0000-4000-8000-000000000001';
create temporary table hire on commit drop as
select s.full_name, s.id as staff_id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001';
grant select on club, hire to authenticated;

-- Who sees them. The checklist reads the SOP library's acknowledgements, which need sops.manage: every
-- role that manages staff must hold it too, or its managers would be refused.
select is_empty(
  $$ select role from public.role_permission where permission = 'staff.manage'
     except select role from public.role_permission where permission = 'sops.manage' $$,
  'every role that manages staff also manages SOPs');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select * from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'a member sees no checklist');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'nor a dealer, not even their own: the SOP library shows them what they must acknowledge');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'nor a cashier');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select * from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'nor a manager of another venue');
select results_eq($$ select distinct full_name from public.onboarding_checklists('00000000-0000-4000-8000-0000000000f2') c
                     join public.staff s on s.id = c.staff_id $$,
  $$ values ('Kabir Sethi'::text) $$, 'who sees only their own venue''s');
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'and nobody signed out');

-- A checklist per hire: the SOPs in force that ask their role, none ticked yet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select title, version, acknowledged_at is null from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Pema Lepcha') order by title $$,
  $$ values ('Dealer certification'::text, 1, true), ('Fallback: app down', 1, true), ('Fallback: power cut', 1, true),
            ('Fallback: Wi-Fi down', 1, true), ('Table-side food and drink', 1, true), ('Women''s safety', 1, true) $$,
  'a dealer''s checklist is every SOP in force that asks dealers, none acknowledged yet');
select results_eq(
  $$ select title from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Sana Qureshi') order by title $$,
  $$ values ('Anti-money laundering'::text), ('Cage'), ('Fallback: app down'), ('Fallback: KYC vendor down'), ('Fallback: power cut'),
            ('Fallback: UPI down'), ('Fallback: Wi-Fi down'), ('Women''s safety') $$,
  'a cashier''s is those that ask cashiers');
select is((select count(distinct staff_id)::integer from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')),
  (select count(*)::integer from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and is_active),
  'every active staff member has one');

-- An SOP item ticks when the hire acknowledges the SOP.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
create temporary table pema_ack on commit drop as
select public.acknowledge_sop((select version_id from club where title = 'Dealer certification')) as at;
grant select on pema_ack to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select title, acknowledged_at = (select at from pema_ack) from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Pema Lepcha') and title in ('Dealer certification', 'Women''s safety')
     order by title $$,
  $$ values ('Dealer certification'::text, true), ('Women''s safety', null) $$,
  'the dealer acknowledges the dealer certification, and its item ticks with when; the others stay open');
-- Only the dealer certification: a local database may hold acknowledgements the e2e flows made.
select is_empty(
  $$ select 1 from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id <> (select staff_id from hire where full_name = 'Pema Lepcha') and title = 'Dealer certification'
       and acknowledged_at is not null $$,
  'nobody else''s item for it ticks');

-- A new version asks again: the item reopens until the hire acknowledges it (question #483).
select is(public.publish_sop_version((select sop_id from club where title = 'Dealer certification'), 'Floor manager', '{dealer}',
  pg_temp.today(), 'Version two'), 2, 'a new version of the dealer certification comes into force today');
select results_eq(
  $$ select version, acknowledged_at is null from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Pema Lepcha') and title = 'Dealer certification' $$,
  $$ values (2, true) $$, 'so the dealer''s item reopens at version 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select isnt(public.acknowledge_sop((select v.id from public.sop_version v join club c on c.sop_id = v.sop_id
  where c.title = 'Dealer certification' and v.version = 2)), null, 'the dealer acknowledges version 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select version, acknowledged_at is not null from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Pema Lepcha') and title = 'Dealer certification' $$,
  $$ values (2, true) $$, 'and it ticks again');

-- An SOP still waiting for its first day is not on anyone's checklist yet.
select isnt(public.add_sop('00000000-0000-4000-8000-000000000001', 'Opening the room', 'Duty manager', '{dealer}', pg_temp.today() + 7, 'Lights.'),
  null, 'an SOP asking dealers from next week');
select is_empty($$ select 1 from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') where title = 'Opening the room' $$,
  'is on no checklist before its day');

-- The checklist follows the hire: a new hire gets one, a change of role changes it, a hire turned off has none.
reset role;
insert into public.staff (venue_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000001', 'New Host', 'Host', 'host', '+919000000977');
update public.staff set role = 'host' where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Sana Qureshi';
update public.staff set is_active = false where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Pema Lepcha';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select s.full_name, count(*)::integer, count(c.acknowledged_at)::integer
     from public.onboarding_checklists('00000000-0000-4000-8000-000000000001') c join public.staff s on s.id = c.staff_id
     where s.full_name = 'New Host' group by s.full_name $$,
  $$ values ('New Host'::text, 6, 0) $$, 'a new host''s checklist is the six SOPs that ask hosts, all open');
select results_eq(
  $$ select bool_or(title = 'Cage'), bool_or(title = 'Table-side food and drink') from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
     where staff_id = (select staff_id from hire where full_name = 'Sana Qureshi') $$,
  $$ values (false, true) $$, 'a cashier made a host has the host''s SOPs, not the cage''s');
select is_empty($$ select 1 from public.onboarding_checklists('00000000-0000-4000-8000-000000000001')
                   where staff_id = (select staff_id from hire where full_name = 'Pema Lepcha') $$,
  'a hire turned off has no checklist');

select * from finish();
rollback;
