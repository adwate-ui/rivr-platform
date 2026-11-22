-- The floor sees everything in Members, to view (the owner, 22 Nov): every full mobile, the record's number, the selfie and
-- the desk's photo, and the account's feature overrides. Never a PAN or Aadhaar photo, and never the editing. A host
-- becomes the Floor member here, as the seed has none; 108 stays a host; Kabir (202) is a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null
                and h.user_id <> '00000000-0000-4000-8000-000000000108' order by h.user_id limit 1);
create temp table people on commit drop as
select s.role::text as who, (min(s.user_id::text))::uuid as user_id from public.staff s
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id is not null and s.role in ('floor', 'super_admin') group by 1;
insert into people values ('host', '00000000-0000-4000-8000-000000000108');
grant select on people to authenticated;
create function pg_temp.as_who(p_who text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', (select p.user_id from people p where p.who = p_who), 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
grant execute on function pg_temp.as_who(text) to authenticated;
create function pg_temp.view() returns jsonb language sql as $$ select '{"page": 1, "page_size": 1000}'::jsonb $$;
grant execute on function pg_temp.view() to authenticated;

-- Kabir's photos: the desk's and his PAN card's; and a feature override on his account.
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/in-person-00000000-0000-4000-8000-0000000006a1.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/doc-pan-00000000-0000-4000-8000-0000000006a1.jpg');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'call_time.view', true, 'test 600');
-- The numbers as stored, which no signed-in caller reads from the table itself.
create temp table phones on commit drop as select id, phone from public.member where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on phones to authenticated;

select pg_temp.as_who('floor');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view()) p
                   join phones m on m.id = p.member_id where p.phone is distinct from m.phone $$,
  'the floor reads every full mobile in the list');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view())
                   where date_of_birth is not null or pan is not null or masked_aadhaar is not null or address is not null $$,
  'and no identity document');
select is((select phone from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202')), '+919000000202',
  'the record gives the floor the number');
select lives_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/in-person-00000000-0000-4000-8000-0000000006a1.jpg') $$,
  'the floor sees the photo the desk took');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/doc-pan-00000000-0000-4000-8000-0000000006a1.jpg') $$,
  '42501', null, 'but never his PAN card');
select is((select count(*)::integer from public.member_feature_overrides('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202')), 1,
  'the floor reads the account''s feature overrides');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'call_time.view',
                      false, 'Not yet') $$, '42501', null, 'and changes none');

-- A host, who reads no mobile, sees none of it.
select pg_temp.as_who('host');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view()) where phone is not null $$,
  'a host reads no full mobile');
select is((select phone from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202')), null,
  'nor the record''s number');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/in-person-00000000-0000-4000-8000-0000000006a1.jpg') $$,
  '42501', null, 'nor a photo the desk took and finished with');
select is_empty($$ select * from public.member_feature_overrides('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  'nor the feature overrides');

-- A super admin still sees the PAN card.
select pg_temp.as_who('super_admin');
select lives_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/doc-pan-00000000-0000-4000-8000-0000000006a1.jpg') $$,
  'a super admin sees the PAN card, as before');
reset role;

select * from finish();
rollback;
