-- Creators (#163): a creator's code credits sign-ups to them; their dashboard counts how far each got and what the
-- creator is owed at their basis. 103 Aditya runs promotions; 104 is a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoya Khan', 'ZOYA', 'first_visit', 50000), null, 'the floor adds a creator at ₹500 a first visit');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'zoya', 'kyc', 0) $$, '23505', null,
  'a code is one creator''s, whatever its case');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'with space', 'kyc', 0) $$, '22023', null,
  'a code fits in a link');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'ZOE', 'kyc', 12345) $$, '22023', null,
  'a commission in whole rupees');
select results_eq($$ select signed_up, visited, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001') where code = 'ZOYA' $$,
  $$ values (0, 0, 0::bigint) $$, 'with no sign-ups yet, nothing is owed');
reset role;

-- Two new members sign up with her link, one in another case; one of them comes in.
create temp table fans as
  with made as (insert into public.member (venue_id, full_name, phone)
                values ('00000000-0000-4000-8000-000000000001', 'Fan One', '+919000000961'), ('00000000-0000-4000-8000-000000000001', 'Fan Two', '+919000000962') returning id, full_name)
  select id, full_name from made;
insert into public.sign_up_attribution (member_id, venue_id, creator_code)
select id, '00000000-0000-4000-8000-000000000001', case when full_name = 'Fan One' then 'zoya' else 'ZOYA' end from fans;
insert into public.visit (venue_id, member_id) select '00000000-0000-4000-8000-000000000001', id from fans where full_name = 'Fan One';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select signed_up, visited, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001') where code = 'ZOYA' $$,
  $$ values (2, 1, 50000::bigint) $$, 'two sign-ups, one first visit: ₹500 owed');
select is((select count(*)::integer from public.creator), 1, 'the floor reads the venue''s creators');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.creator_dashboard('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier reads no dashboard');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zed', 'ZED', 'kyc', 0) $$, '42501', null,
  'nor adds a creator');
select is_empty($$ select 1 from public.creator $$, 'nor sees them');
reset role;

select * from finish();
rollback;
