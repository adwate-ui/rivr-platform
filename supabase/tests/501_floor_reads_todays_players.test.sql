-- The floor sees Door's Today's players with each member's number (the owner, 15 Nov night). The floor has read members since
-- 20261101100500_role_modules.sql, which todays_players and door_page ask; checking a member in and out asks waitlist.manage,
-- which the floor had too, so what it may do at the door is as it was. Service, which has neither, still has neither.
-- 201 is a verified member; 790 is the service role's staff member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A floor staff member of the club: none is seeded.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000a501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000009501');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a501', 'Floor staff', 'Floor', 'floor', '+919000009501');
select set_config('test.number', (select member_number::text from public.member where id = '00000000-0000-4000-8000-000000000201'), false);

select pg_temp.as_person('00000000-0000-4000-8000-00000000a501');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201') $$,
  'the floor checks a member in, as it could before');
select results_eq(
  $$ select member_number, status from public.todays_players('00000000-0000-4000-8000-000000000001')
     where member_id = '00000000-0000-4000-8000-000000000201' $$,
  $$ values (current_setting('test.number')::bigint, 'in_room'::text) $$,
  'a floor sign-in reads today''s players, each with their member number');
select results_eq(
  $$ select member_number, list from public.door_page('00000000-0000-4000-8000-000000000001', '{"q": "Arjun"}')
     where member_id = '00000000-0000-4000-8000-000000000201' $$,
  $$ values (current_setting('test.number')::bigint, 'in_club'::text) $$,
  'and Door''s table of them, page by page, with the number');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000201', '+919000009502', 'A new phone') $$, '42501', null,
  'reading them changes nothing else the floor may do to a member');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000790');
select is_empty($$ select * from public.todays_players('00000000-0000-4000-8000-000000000001') $$, 'service still reads no one');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$, '42501', null,
  'and still checks no one in');
reset role;

select * from finish();
rollback;
