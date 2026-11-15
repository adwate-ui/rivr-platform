-- An unpaid KYC vendor call makes the member's check (decision 0671): Zoop's selfie passes the gate unpaid, and a new
-- member's selfie must find a record to claim. Asha and Ben are new members made here; Ben has not consented.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b513', 'authenticated', 'authenticated', '919000051301', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b514', 'authenticated', 'authenticated', '919000051302', now(), now(), now());

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_user(uuid) to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-00000000b513');
insert into ids select 'asha', public.sign_up('Asha Rao', '{}');
select public.give_consent('kyc_verification');
select pg_temp.as_user('00000000-0000-4000-8000-00000000b514');
insert into ids select 'ben', public.sign_up('Ben Thomas', '{}');
reset role;

select is((select count(*)::integer from public.kyc_record where member_id = (select id from ids where name = 'asha')), 0,
  'a new member has no check before the selfie');

-- The selfie's unpaid call makes the check, spending none of the five a day, and the selfie can then be claimed.
select lives_ok($$ select public.begin_kyc_vendor_call((select id from ids where name = 'asha'), false) $$,
  'an unpaid call passes the gate');
select results_eq(
  $$ select status::text, vendor_calls from public.kyc_record where member_id = (select id from ids where name = 'asha') $$,
  $$ values ('started', 0) $$,
  'and makes the member''s check, with no paid call counted');
select is(public.claim_kyc_selfie((select id from ids where name = 'asha')), true, 'so the selfie finds its check to claim');

-- A paid call still counts.
select lives_ok($$ select public.begin_kyc_vendor_call((select id from ids where name = 'asha'), true) $$, 'a paid call passes');
select is((select vendor_calls from public.kyc_record where member_id = (select id from ids where name = 'asha')), 1,
  'and counts one');

-- Without consent nothing is made.
select throws_ok($$ select public.begin_kyc_vendor_call((select id from ids where name = 'ben'), false) $$, 'RVCON', null,
  'an unpaid call still needs the member''s consent');
select is((select count(*)::integer from public.kyc_record where member_id = (select id from ids where name = 'ben')), 0,
  'and makes no check without it');

select * from finish();
rollback;
