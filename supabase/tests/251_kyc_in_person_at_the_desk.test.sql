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

-- A check in person earns the verification bonus only once its PAN recheck matches; a failed recheck earns nothing.
select set_config('request.jwt.claims', '', true);
delete from public.setting where key = 'points.verified_bonus';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 500}', '-infinity', 'Bonus test');
create function pg_temp.bonus(p_member uuid) returns bigint language sql as $$
  select coalesce(-private.account_balance(a.id), 0) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points'
$$;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'verified', 'manual', '1992-03-03', 'ABCPB2044B',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000204/in-person-' || gen_random_uuid() || '.jpg', now());
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000204'), 0::bigint, 'checked in person, Rohan has no bonus yet');
select private.record_kyc_recheck('00000000-0000-4000-8000-000000000204', 'matched');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000204'), 500::bigint, 'his PAN recheck matches: the bonus comes');
select private.record_kyc_recheck('00000000-0000-4000-8000-000000000204', 'matched');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000204'), 500::bigint, 'once');

-- Vihaan's recheck differs; a KYC reviewer then approves his check against the originals: the bonus comes with the approval.
update public.kyc_record set method = 'manual', pan_recheck = null, pan_rechecked_at = null
where member_id = '00000000-0000-4000-8000-000000000212';
select private.record_kyc_recheck('00000000-0000-4000-8000-000000000212', 'name_differs');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000212'), 0::bigint, 'a recheck that differs earns nothing');
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000212';
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000212'), 500::bigint, 'a reviewer''s approval does');

-- Yash is frozen when his recheck answers: the match stands, so it is not asked again, and no bonus is paid.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000214', 'Under review');
update public.kyc_record set method = 'manual', pan_recheck = null, pan_rechecked_at = null
where member_id = '00000000-0000-4000-8000-000000000214';
select lives_ok($$ select private.record_kyc_recheck('00000000-0000-4000-8000-000000000214', 'matched') $$,
  'a frozen member''s recheck is recorded');
select is((select pan_recheck from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000214'), 'matched', 'as matched');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000214'), 0::bigint, 'with no bonus while frozen');

select * from finish();
rollback;
