-- The member's own KYC selfie on their card (decision 0300). Arjun (201) is verified, his selfie kept; Kabir (202)
-- has a selfie waiting for review. A member sees their own verified selfie and nothing else in the bucket, and
-- every view is audited.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'needs_review', 'digilocker', '1991-02-02',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg');
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/aadhaar.jpg');

-- Before his selfie is kept, Arjun's card has no photo: it never shows one it cannot load.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select photo_path from public.my_membership_card()), null, 'a verified member whose selfie is not kept has no photo on the card');
reset role;
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg');

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select photo_path from public.my_membership_card()),
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg', 'Arjun''s card carries his verified selfie');
select lives_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg') $$,
  'and he may see it');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/aadhaar.jpg') $$,
  '42501', null, 'not his own document image');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg') $$,
  '42501', null, 'nor another member''s selfie');
reset role;
select is((select count(*)::int from public.audit_log where action = 'kyc_image.view' and actor_user_id = '00000000-0000-4000-8000-000000000201'), 1,
  'his view is audited with his name');

select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is((select photo_path from public.my_membership_card()), null, 'a selfie still under review is not on the card');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg') $$,
  '42501', null, 'nor may its member see it until it is verified');
reset role;

-- Staff are unchanged: a KYC reviewer sees both, a host neither.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg') $$,
  'a KYC reviewer still sees a selfie under review');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg') $$,
  '42501', null, 'a host still does not');
reset role;

select * from finish();
rollback;
