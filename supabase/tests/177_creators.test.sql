-- Creators (#163): a creator's code credits sign-ups to them; their dashboard counts how far each got and what the
-- creator is owed at their basis. 103 Aditya runs promotions; 104 is a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Another venue, made first as its settings take effect when the test begins, with its own admin.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoya Khan', 'ZOYA', 'first_visit', 50000), null, 'the floor adds a creator at ₹500 a first visit');
select isnt(public.save_creator('00000000-0000-4000-8000-000000000001', 'Kiran Rao', 'KIRAN', 'kyc', 30000), null, 'one at ₹300 a KYC');
select isnt(public.save_creator('00000000-0000-4000-8000-000000000001', 'Arjun Paul', 'ARJUN', 'first_buy_in', 100000), null, 'and one at ₹1,000 a first buy-in');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'zoya', 'kyc', 0) $$, '23505', null,
  'a code is one creator''s, whatever its case');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'with space', 'kyc', 0) $$, '22023', null,
  'a code fits in a link');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'ZOE+1', 'kyc', 0) $$, '22023', null,
  'with no + a link would read as a space');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zoe', 'ZOE', 'kyc', 12345) $$, '22023', null,
  'a commission in whole rupees');
select results_eq($$ select signed_up, visited, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001') where code = 'ZOYA' $$,
  $$ values (0, 0, 0::bigint) $$, 'with no sign-ups yet, nothing is owed');
reset role;

-- Two new members sign up with her link, one in another case; one of them comes in.
create temp table fans as
  with made as (insert into public.member (venue_id, full_name, phone)
                values ('00000000-0000-4000-8000-000000000001', 'Fan One', '+919000000961'), ('00000000-0000-4000-8000-000000000001', 'Fan Two', '+919000000962') returning id, full_name)
  select id, full_name from made;
insert into public.sign_up_attribution (member_id, venue_id, creator_code)
select id, '00000000-0000-4000-8000-000000000001', case when full_name = 'Fan One' then 'zoya' else 'ZOYA' end from fans;
insert into public.visit (venue_id, member_id) select '00000000-0000-4000-8000-000000000001', id from fans where full_name = 'Fan One';
-- Fan Two finishes KYC; a third fan, Kiran's, too; Yash, Arjun's, sits and buys in.
insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
select '00000000-0000-4000-8000-000000000001', id, 'verified', now(), '1990-01-01', '00000000-0000-4000-8000-000000000001' || '/' || id || '/selfie.jpg' from fans where full_name = 'Fan Two';
create temp table kiran_fan as
  with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Fan Three', '+919000000963') returning id)
  select id from made;
insert into public.sign_up_attribution (member_id, venue_id, creator_code) select id, '00000000-0000-4000-8000-000000000001', 'KIRAN' from kiran_fan;
insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
select '00000000-0000-4000-8000-000000000001', id, 'verified', now(), '1990-01-01', '00000000-0000-4000-8000-000000000001' || '/' || id || '/selfie.jpg' from kiran_fan;
insert into public.sign_up_attribution (member_id, venue_id, creator_code)
values ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000001', 'arjun')
on conflict (member_id) do update set creator_code = excluded.creator_code, referral_code = null, utm_source = null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 1000000, 'cash', gen_random_uuid());
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select signed_up, kyc_done, visited, bought_in, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001')
                     where code = 'ZOYA' $$,
  $$ values (2, 1, 1, 0, 50000::bigint) $$, 'Zoya: two sign-ups, one KYC, one first visit, at ₹500 a first visit: ₹500 owed');
select results_eq($$ select signed_up, kyc_done, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001') where code = 'KIRAN' $$,
  $$ values (1, 1, 30000::bigint) $$, 'Kiran: one KYC at ₹300');
select results_eq($$ select signed_up, bought_in, owed_paise from public.creator_dashboard('00000000-0000-4000-8000-000000000001') where code = 'ARJUN' $$,
  $$ values (1, 1, 100000::bigint) $$, 'Arjun: one first buy-in at ₹1,000');
select is((select count(*)::integer from public.creator), 3, 'the floor reads the venue''s creators');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select * from public.creator_dashboard('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'another venue''s admin reads no dashboard here');
select is_empty($$ select 1 from public.creator $$, 'nor sees its creators');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.creator_dashboard('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier reads no dashboard');
select throws_ok($$ select public.save_creator('00000000-0000-4000-8000-000000000001', 'Zed', 'ZED', 'kyc', 0) $$, '42501', null,
  'nor adds a creator');
select is_empty($$ select 1 from public.creator $$, 'nor sees them');
reset role;

select * from finish();
rollback;
