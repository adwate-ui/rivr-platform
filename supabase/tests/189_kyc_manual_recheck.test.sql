-- Re-checking KYC checks made in person (#259; decision 0271): each once, through the vendor's PAN check. A match keeps
-- the check; a mismatch sends it back to review with the reason; a vendor that cannot answer leaves it to be asked again.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.manual(p_venue uuid, p_member uuid, p_pan text) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, masked_aadhaar, photo_path, verified_at)
  values (p_venue, p_member, 'verified', 'manual', '1990-04-04', p_pan, 'XXXX XXXX 4040',
          p_venue || '/' || p_member || '/in-person-' || gen_random_uuid() || '.jpg', now());
$$;
-- This test's checks among those claimed (the seed may hold others).
create function pg_temp.claimed(p_with_vendor boolean) returns setof uuid language sql as $$
  select c.member_id from public.claim_kyc_rechecks(p_with_vendor) c
  where c.member_id::text like '00000000-0000-4000-8000-0000000003c_' order by c.member_id;
$$;

-- Four checks made in person: three at the club, one at the practice venue.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000003c1', '00000000-0000-4000-8000-000000000001', 'Anaya Gill', '+919000000391'),
  ('00000000-0000-4000-8000-0000000003c2', '00000000-0000-4000-8000-000000000001', 'Vikram Sood', '+919000000392'),
  ('00000000-0000-4000-8000-0000000003c3', '00000000-0000-4000-8000-000000000002', 'Leela Nair', '+919000000393'),
  ('00000000-0000-4000-8000-0000000003c4', '00000000-0000-4000-8000-000000000001', 'Omar Khan', '+919000000394');
select pg_temp.manual('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000003c1', 'ABCPG3001G');
select pg_temp.manual('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000003c2', 'ABCPS3002S');
select pg_temp.manual('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000003c3', 'ABCPN3003N');
select pg_temp.manual('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000003c4', 'ABCPK3004K');

select results_eq(
  $$ select c.member_id, c.full_name, c.pan, c.date_of_birth, c.is_practice from public.claim_kyc_rechecks(false) c
     where c.member_id::text like '00000000-0000-4000-8000-0000000003c_' $$,
  $$ values ('00000000-0000-4000-8000-0000000003c3'::uuid, 'Leela Nair'::text, 'ABCPN3003N'::text, '1990-04-04'::date, true) $$,
  'without the vendor''s keys only the practice venue''s checks are claimed, with the name, PAN and date of birth to check');
select results_eq($$ select * from pg_temp.claimed(true) $$,
  $$ values ('00000000-0000-4000-8000-0000000003c1'::uuid), ('00000000-0000-4000-8000-0000000003c2'::uuid), ('00000000-0000-4000-8000-0000000003c4'::uuid) $$,
  'with them a real venue''s too, while a check just claimed waits its turn');

-- A match keeps the check.
select lives_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000003c1', 'matched') $$, 'the vendor matches Anaya');
select results_eq($$ select status, pan_recheck, verified_at is not null from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000003c1' $$,
  $$ values ('verified'::text, 'matched'::text, true) $$, 'and her check stays verified, re-checked');

-- A mismatch sends the check back to review, which stops play, and the queue says why.
select lives_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000003c2', 'name_differs') $$, 'the vendor has Vikram''s PAN in another name');
select results_eq($$ select status, pan_recheck, verified_at is null from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000003c2' $$,
  $$ values ('needs_review'::text, 'name_differs'::text, true) $$, 'so his check goes back to review');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select status, method, waiting_because from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-0000000003c2' $$,
  $$ values ('needs_review'::text, 'manual'::text, 'recheck_name_differs'::text) $$, 'and a KYC reviewer sees it, with the reason');
select throws_ok($$ select public.claim_kyc_rechecks(true) $$, '42501', null, 'staff and members cannot claim re-checks');
select throws_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000003c4', 'matched') $$, '42501', null, 'or record one');
reset role;
select throws_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000003c4', 'nonsense') $$, '22023', null, 'an outcome is one of the four');
select lives_ok($$ select public.record_kyc_recheck('00000000-0000-4000-8000-0000000003c2', 'matched') $$, 'a second answer for a check');
select is((select status from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000003c2'), 'needs_review', 'changes nothing: each is re-checked once');

-- A vendor that could not answer (Leela's and Omar's): they are asked again later, Anaya and Vikram never.
update private.kyc_recheck_claim set claimed_at = now() - interval '1 day' where member_id::text like '00000000-0000-4000-8000-0000000003c_';
select results_eq($$ select * from pg_temp.claimed(true) $$,
  $$ values ('00000000-0000-4000-8000-0000000003c3'::uuid), ('00000000-0000-4000-8000-0000000003c4'::uuid) $$,
  'checks the vendor could not answer are asked again; those answered are not');
update private.kyc_recheck_claim set attempts = 20, claimed_at = now() - interval '30 minutes' where member_id = '00000000-0000-4000-8000-0000000003c3';
update private.kyc_recheck_claim set claimed_at = now() - interval '1 day' where member_id = '00000000-0000-4000-8000-0000000003c4';
select results_eq($$ select * from pg_temp.claimed(true) $$, $$ values ('00000000-0000-4000-8000-0000000003c4'::uuid) $$,
  'a check tried many times waits an hour between tries');
update private.kyc_recheck_claim set claimed_at = now() - interval '61 minutes' where member_id = '00000000-0000-4000-8000-0000000003c3';
update private.kyc_recheck_claim set claimed_at = now() - interval '1 day' where member_id = '00000000-0000-4000-8000-0000000003c4';
select results_eq($$ select * from pg_temp.claimed(true) $$,
  $$ values ('00000000-0000-4000-8000-0000000003c3'::uuid), ('00000000-0000-4000-8000-0000000003c4'::uuid) $$, 'and is never given up on');

-- KYC switched off at the venue pauses its re-checks.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Test');
update private.kyc_recheck_claim set claimed_at = now() - interval '1 day' where member_id = '00000000-0000-4000-8000-0000000003c4';
select is_empty($$ select * from pg_temp.claimed(true) $$, 'with KYC switched off nothing is re-checked');

select * from finish();
rollback;
