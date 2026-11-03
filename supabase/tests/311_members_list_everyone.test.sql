-- Members lists everyone on open (owner, 3 Nov; decision 0483). Aditya (103, an admin) lists every member of the club
-- with no tier given, of every tier and only the club's; a tier still narrows it. A dealer (106), who reads no members,
-- lists none; Nisha (191, an admin at the club only) lists none of the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temporary table club_members as
select m.id, m.tier_id from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000001';
create temporary table member_tier as
select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
grant select on club_members, member_tier to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select set_eq($$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001') $$,
  $$ select id from club_members $$, 'with no tier, Aditya lists every member of the club');
select set_eq($$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001', null) $$,
  $$ select id from club_members $$, 'a null tier is no tier');
select ok((select count(distinct tier_name) > 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001')),
  'of every tier');
select set_eq($$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001', (select id from member_tier)) $$,
  $$ select id from club_members where tier_id = (select id from member_tier) $$, 'a tier still narrows the list to its members');
select is((select array_agg(full_name) from public.members_of_tier('00000000-0000-4000-8000-000000000001')),
  (select array_agg(full_name order by full_name) from public.members_of_tier('00000000-0000-4000-8000-000000000001')),
  'by name');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') $$,
  'a dealer, who reads no members, lists none');

select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000002') $$,
  'an admin at the club alone lists none of the practice venue');

select * from finish();
rollback;
