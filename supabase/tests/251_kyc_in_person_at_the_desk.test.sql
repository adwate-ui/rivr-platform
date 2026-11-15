-- Hosts and the floor check members in person (decision 0301): kyc.in_person, without reviewing the app's checks. 106 Pema
-- (dealer), 108 Karan (host); Rohan (204) has no check of his own.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select results_eq($$ select role::text from public.role_permission where permission = 'kyc.in_person' order by role::text $$,
  $$ values ('admin'), ('floor'), ('host'), ('super_admin') $$, 'super admins, admins, hosts and the floor check members in person');
select ok(not exists (select 1 from public.role_permission where role in ('host', 'floor') and permission = 'kyc.review'),
  'and hosts and the floor still review nothing');

-- While Rohan's check waits for review he is no one's to check in person.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'needs_review', 'pan', '1992-03-03');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::integer from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Rohan')), 0,
  'Rohan, whose check waits for review, is no candidate');
select is((select count(*)::integer from public.kyc_review_queue('00000000-0000-4000-8000-000000000001')), 0,
  'and the host sees no checks to review');
reset role;

delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000204';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::integer from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Rohan')), 1,
  'with no check, Rohan is a host''s to check in person');
select lives_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000204') $$, 'and the host may check him');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Rohan')), 0,
  'a dealer finds no one');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000204') $$, '42501', null, 'and may not check him');
reset role;

select set_config('request.jwt.claims', '', true);

-- Yash is frozen when his recheck answers: the match stands, so it is not asked again.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000214', 'Under review');
update public.kyc_record set method = 'manual', pan_recheck = null, pan_rechecked_at = null
where member_id = '00000000-0000-4000-8000-000000000214';
select lives_ok($$ select private.record_kyc_recheck('00000000-0000-4000-8000-000000000214', 'matched') $$,
  'a frozen member''s recheck is recorded');
select is((select pan_recheck from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000214'), 'matched', 'as matched');

select * from finish();
rollback;
