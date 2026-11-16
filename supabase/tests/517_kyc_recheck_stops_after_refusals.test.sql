-- PAN re-checks that Zoop refuses (#1026; decision 0674). A refusal of a check's request is noted and counted; the third
-- ends the re-check as not_checked, the check made in person standing, and the owner hears of it. Zoop refusing RIVR's
-- account pauses every real venue's re-check for six hours, with one alert, and counts against no member. A check made
-- again counts afresh, and an answer clears an earlier refusal's note.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.manual(p_member uuid, p_pan text) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, masked_aadhaar, photo_path, verified_at)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'verified', 'manual', '1990-05-05', p_pan, 'XXXX XXXX 5170',
          '00000000-0000-4000-8000-000000000001/' || p_member || '/in-person-' || gen_random_uuid() || '.jpg', now());
$$;
-- This test's checks among those claimed, once the last claim's wait has passed.
create function pg_temp.claimed() returns setof uuid language sql as $$
  update private.kyc_recheck_claim set claimed_at = now() - interval '2 hours'
  where member_id::text like '00000000-0000-4000-8000-0000000005d_';
  select c.member_id from public.claim_kyc_rechecks(true) c
  where c.member_id::text like '00000000-0000-4000-8000-0000000005d_' order by c.member_id;
$$;
create function pg_temp.check_of(p_member uuid) returns table (status text, pan_recheck text, is_rechecked boolean, is_verified boolean, vendor_failure text)
language sql as $$
  select k.status, k.pan_recheck, k.pan_rechecked_at is not null, k.verified_at is not null, k.vendor_failure
  from public.kyc_record k where k.member_id = p_member;
$$;
create function pg_temp.alerts(p_kind text) returns integer language sql as $$
  select count(*)::integer from public.alert a where a.kind = p_kind and a.venue_id = '00000000-0000-4000-8000-000000000001';
$$;

-- Three checks made in person at the club.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-000000000001', 'Rohan Mehta', '+919000051701'),
  ('00000000-0000-4000-8000-0000000005d2', '00000000-0000-4000-8000-000000000001', 'Isha Kapoor', '+919000051702'),
  ('00000000-0000-4000-8000-0000000005d3', '00000000-0000-4000-8000-000000000001', 'Kabir Anand', '+919000051703');
select pg_temp.manual('00000000-0000-4000-8000-0000000005d1', 'ABCPM5171M');
select pg_temp.manual('00000000-0000-4000-8000-0000000005d2', 'ABCPK5172K');
select pg_temp.manual('00000000-0000-4000-8000-0000000005d3', 'ABCPA5173A');

select results_eq($$ select * from pg_temp.claimed() $$,
  $$ values ('00000000-0000-4000-8000-0000000005d1'::uuid), ('00000000-0000-4000-8000-0000000005d2'::uuid), ('00000000-0000-4000-8000-0000000005d3'::uuid) $$,
  'the three checks are claimed for their re-check');

-- Rohan's request is refused: noted and counted, asked again, and ended at the third.
select is(public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d1', 'Zoop 106'), 'refused',
  'a first refusal is counted, the re-check to be asked again');
select results_eq($$ select * from pg_temp.check_of('00000000-0000-4000-8000-0000000005d1') $$,
  $$ values ('verified'::text, null::text, false, true, 'recheck: Zoop 106'::text) $$,
  'the check stands, with why Zoop refused noted');
select ok('00000000-0000-4000-8000-0000000005d1' in (select * from pg_temp.claimed()), 'and it is claimed again on a later run');
select is(public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d1', 'Zoop 106'), 'refused', 'a second refusal too');
select is(pg_temp.alerts('kyc.recheck_not_checked'), 0, 'with nothing for the owner yet');
select is(public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d1', 'Zoop 106'), 'not_checked', 'the third ends the re-check');
select results_eq($$ select * from pg_temp.check_of('00000000-0000-4000-8000-0000000005d1') $$,
  $$ values ('verified'::text, 'not_checked'::text, true, true, 'recheck: Zoop 106'::text) $$,
  'as not checked, the check made in person still verified, so the member keeps playing');
select is(pg_temp.alerts('kyc.recheck_not_checked'), 1, 'and the owner hears of it');
select ok('00000000-0000-4000-8000-0000000005d1' not in (select * from pg_temp.claimed()), 'it is not claimed again');
select lives_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000005d1', 'name_differs') $$, 'a late answer for it');
select results_eq($$ select status, pan_recheck from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005d1' $$,
  $$ values ('verified'::text, 'not_checked'::text) $$, 'changes nothing');

-- Made again, as a reopen leaves it, the check counts afresh: one refusal does not end it.
update public.kyc_record set pan_recheck = null, pan_rechecked_at = null where member_id = '00000000-0000-4000-8000-0000000005d1';
select results_eq($$ select * from pg_temp.check_of('00000000-0000-4000-8000-0000000005d1') $$,
  $$ values ('verified'::text, null::text, false, true, null::text) $$,
  'a check made again keeps no note of the refusals before');
select is((select count(*)::integer from private.kyc_recheck_claim where member_id = '00000000-0000-4000-8000-0000000005d1'), 0,
  'nor their count');
select is(public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d1', 'Zoop 106'), 'refused',
  'so its first refusal is a first');

-- Isha's is refused twice, then answered: the answer stands, and the note goes.
select public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d2', 'Zoop 106');
select public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d2', 'Zoop 106');
select lives_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000005d2', 'matched') $$, 'two refusals, then Zoop answers');
select results_eq($$ select * from pg_temp.check_of('00000000-0000-4000-8000-0000000005d2') $$,
  $$ values ('verified'::text, 'matched'::text, true, true, null::text) $$, 'the match is kept, the refusals'' note cleared');
select throws_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000005d2', 'not_checked') $$, '22023', null,
  'not checked is the refusals'' outcome alone, never Zoop''s answer');

-- Zoop refuses RIVR's account on Kabir's re-check: every real venue's re-check waits, counted against no one.
select lives_ok($$ select public.pause_kyc_rechecks('00000000-0000-4000-8000-0000000005d3', 'Zoop 403') $$, 'Zoop refuses the account');
select results_eq($$ select * from pg_temp.check_of('00000000-0000-4000-8000-0000000005d3') $$,
  $$ values ('verified'::text, null::text, false, true, 'recheck: Zoop 403'::text) $$, 'the check stands, with why noted');
select is((select refusals from private.kyc_recheck_claim where member_id = '00000000-0000-4000-8000-0000000005d3'), 0,
  'and no refusal counted against it');
select is(pg_temp.alerts('kyc.recheck_paused'), 1, 'the owner hears of the pause');
select is((select count(*)::integer from pg_temp.claimed()), 0, 'and no real venue''s check is claimed while it lasts');
select lives_ok($$ select public.pause_kyc_rechecks('00000000-0000-4000-8000-0000000005d3', 'Zoop 403') $$, 'refused again during the pause');
select is(pg_temp.alerts('kyc.recheck_paused'), 1, 'the owner is not told twice');
update private.kyc_recheck_pause set paused_until = now() - interval '1 minute';
select results_eq($$ select * from pg_temp.claimed() $$,
  $$ values ('00000000-0000-4000-8000-0000000005d1'::uuid), ('00000000-0000-4000-8000-0000000005d3'::uuid) $$,
  'once it ends, the re-checks still due are claimed again');

-- Only the scheduler records these.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.record_kyc_recheck_refused('00000000-0000-4000-8000-0000000005d3', 'Zoop 106') $$, '42501', null,
  'staff cannot record a refusal');
select throws_ok($$ select public.pause_kyc_rechecks('00000000-0000-4000-8000-0000000005d3', 'Zoop 403') $$, '42501', null,
  'or pause the re-checks');
reset role;

select * from finish();
rollback;
