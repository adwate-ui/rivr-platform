-- KYC images (private bucket, venue staff with kyc.review or cage.transact only) and consent per
-- purpose (#3). 103 Aditya (admin, kyc.review), 104 Sana (cashier, cage.transact), 108 Karan
-- (host), 201 Arjun and 202 Kabir (members). Seeded staff work at both venues, so the test adds
-- a cashier who works at the practice venue only.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e9', 'authenticated', 'authenticated',
        '919000000999', now(), now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000e9', 'Practice cashier', 'Cashier', 'cashier', '+919000000999');

insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/aadhaar.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000301/aadhaar.jpg');

create function pg_temp.kyc_images_seen_by(p_user uuid) returns int language plpgsql as $$
declare v_count int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select count(*) into v_count from storage.objects where bucket_id = 'kyc';
  perform set_config('role', 'postgres', true);
  return v_count;
end;
$$;

select is((select public from storage.buckets where id = 'kyc'), false, 'the KYC bucket is private');
select is(pg_temp.kyc_images_seen_by('00000000-0000-4000-8000-000000000103'), 2, 'a KYC reviewer reads the images of the venues where they review');
select is(pg_temp.kyc_images_seen_by('00000000-0000-4000-8000-000000000104'), 2, 'the cage reads them too');
select is(pg_temp.kyc_images_seen_by('00000000-0000-4000-8000-000000000108'), 0, 'a host does not');
select is(pg_temp.kyc_images_seen_by('00000000-0000-4000-8000-000000000201'), 0, 'a member does not, their own included');
select is(pg_temp.kyc_images_seen_by('00000000-0000-4000-8000-0000000000e9'), 1, 'a cashier reads only the images of their own venue');

set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'kyc'), 0, 'the public reads nothing');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('kyc', '00000000-0000-4000-8000-000000000001/x/selfie.jpg') $$,
  '42501', null, 'staff cannot upload an image; only the KYC flow writes'
);
reset role;

-- Consent: Arjun gives marketing consent, gives it again, withdraws it and gives it once more.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select lives_ok($$ select public.give_consent('marketing') $$, 'a member gives consent for a purpose');
select lives_ok($$ select public.give_consent('marketing') $$, 'giving it again changes nothing');
select throws_ok($$ select public.give_consent('astrology') $$, '23514', null, 'an unknown purpose is refused');
select throws_ok(
  $$ insert into public.consent (venue_id, member_id, purpose)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'marketing') $$,
  '42501', null, 'nobody writes consent directly'
);
reset role;

select is((select count(*)::int from public.consent where member_id = '00000000-0000-4000-8000-000000000201'), 1, 'one consent row');
select ok(private.has_consent('00000000-0000-4000-8000-000000000201', 'marketing'), 'the consent is in force');
select ok(not private.has_consent('00000000-0000-4000-8000-000000000201', 'kyc_verification'), 'other purposes are not');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select lives_ok($$ select public.withdraw_consent('marketing') $$, 'a member withdraws consent');
reset role;
select ok(not private.has_consent('00000000-0000-4000-8000-000000000201', 'marketing'), 'withdrawn, it is no longer in force');
select isnt((select withdrawn_at from public.consent where member_id = '00000000-0000-4000-8000-000000000201'), null,
  'the withdrawal is recorded with its time, and the grant is kept');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select lives_ok($$ select public.give_consent('marketing') $$, 'consent can be given again');
reset role;
select is((select count(*)::int from public.consent where member_id = '00000000-0000-4000-8000-000000000201'), 2, 'the history keeps both grants');
select ok(private.has_consent('00000000-0000-4000-8000-000000000201', 'marketing'), 'the new grant is in force');

-- Who sees consents.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is((select count(*)::int from public.consent), 0, 'a member sees only their own consents');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is((select count(*)::int from public.consent), 2, 'staff with member access see the venue''s consents');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e9", "role": "authenticated"}';
select is((select count(*)::int from public.consent), 0, 'staff of another venue see none');
select throws_ok($$ select public.give_consent('marketing') $$, '42501', null, 'staff cannot give consent');
reset role;

select ok(not has_function_privilege('authenticated', 'private.has_consent(uuid, text)', 'execute'), 'only the server checks consent');
select ok(has_function_privilege('service_role', 'private.has_consent(uuid, text)', 'execute'), 'lane D''s consumers can');

select * from finish();
rollback;
