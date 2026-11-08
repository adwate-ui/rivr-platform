-- Members' mobile numbers reach signed-in callers only through functions (decision 0513; audit F-001, F-042). Vikram
-- (101, super admin) reads them in full; Aditya (103, an admin) and the host (108) read none, from the table or from
-- search and the record, but find a member by a number they already hold; a dealer (106) finds nobody.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temporary table known as
select m.id, m.phone, m.full_name, m.member_number from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
grant select on known to authenticated;

-- The table: every column but phone, for every signed-in caller. A column added later without its grant fails here.
select is_empty($$ select c.column_name from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'member' and c.column_name <> 'phone'
                     and not has_column_privilege('authenticated', 'public.member', c.column_name, 'select') $$,
                'signed-in callers read every member column but phone');
select ok(not has_column_privilege('authenticated', 'public.member', 'phone', 'select'), 'and never phone');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select phone from public.member limit 1 $$, '42501', null, 'an admin cannot read a number from the table');
select throws_ok($$ select * from public.member limit 1 $$, '42501', null, 'nor every column at once');
select ok((select count(*) from public.member) > 0, 'but still reads the members the policy gives, without their numbers');
select is((select phone from public.member_search('00000000-0000-4000-8000-000000000001', (select full_name from known))
           where member_id = (select id from known)), null, 'search gives an admin no number');
select is((select member_id from public.member_search('00000000-0000-4000-8000-000000000001', right((select phone from known), 10))),
          (select id from known), 'but still finds the member by digits of their number');
select is((select phone from public.member_record('00000000-0000-4000-8000-000000000001', (select id from known))), null,
          'the record gives an admin no number');
select is(public.member_id_for_phone('00000000-0000-4000-8000-000000000001', (select phone from known)), (select id from known),
          'an admin finds the member who has a number they hold');
select is(public.member_id_for_phone('00000000-0000-4000-8000-000000000001', '+919999999999'), null, 'and nobody for a number nobody has');
reset role;

-- A member the desk may check in person, for the identity list's search.
create temporary table candidate as
select m.id, m.phone from public.member m left join public.kyc_record k on k.member_id = m.id
where m.venue_id = '00000000-0000-4000-8000-000000000001' and (k.id is null or k.status = 'started') and m.user_id is not null
order by m.member_number limit 1;
grant select on candidate to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select phone from public.member_search('00000000-0000-4000-8000-000000000001', (select full_name from known))
           where member_id = (select id from known)), null, 'search gives a host no number');
-- Digit after digit would spell out a number: a host's search matches only its last four, or all ten.
select is_empty($$ select 1 from public.member_search('00000000-0000-4000-8000-000000000001', right((select phone from known), 6))
                   where member_id = (select id from known) $$, 'six digits of a number find nobody for a host');
select ok(exists (select 1 from public.member_search('00000000-0000-4000-8000-000000000001', right((select phone from known), 4))
                  where member_id = (select id from known)), 'its last four find the member');
select ok(exists (select 1 from public.member_search('00000000-0000-4000-8000-000000000001', right((select phone from known), 10))
                  where member_id = (select id from known)), 'and so do all ten');
select ok(exists (select 1 from public.member_search('00000000-0000-4000-8000-000000000001',
                  '+91 ' || substr(right((select phone from known), 10), 1, 5) || ' ' || right((select phone from known), 5))
                  where member_id = (select id from known)), 'typed as +91 98765 43210 too');
select is_empty($$ select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', right((select phone from candidate), 6))
                   where member_id = (select id from candidate) $$, 'six digits find nobody to check at the desk either');
select ok(exists (select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', right((select phone from candidate), 4))
                  where member_id = (select id from candidate)), 'the last four do, as the list shows them');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is(public.member_id_for_phone('00000000-0000-4000-8000-000000000001', (select phone from known)), null,
          'a dealer, without member access, finds nobody by number');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select phone from public.member limit 1 $$, '42501', null, 'nor can a super admin read the table''s numbers');
select is((select phone from public.member_search('00000000-0000-4000-8000-000000000001', (select full_name from known))
           where member_id = (select id from known)), (select phone from known), 'search gives a super admin the full number');
select ok(exists (select 1 from public.member_search('00000000-0000-4000-8000-000000000001', right((select phone from known), 6))
                  where member_id = (select id from known)), 'and finds a member from any digits of their number');
select is((select phone from public.member_record('00000000-0000-4000-8000-000000000001', (select id from known))),
          (select phone from known), 'and so does the record');
reset role;

select * from finish();
rollback;
