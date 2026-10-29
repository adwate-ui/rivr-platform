-- Sign-up answers (#631): once a member, the new number saves their city, what best describes them (one of the list) and
-- when they usually play (any of the list), and may change them. Their photo goes beside their identity images in the kyc
-- bucket through the kyc Edge Function, once begin_sign_up_photo allows it; no client writes the bucket. 202 Kabir is a
-- member; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '919000000961', now(), now(), now());

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Before sign-up there is no member to answer for.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram', 'salaried', '{weekends}') $$, '42501', null, 'nobody answers before signing up');
insert into ids select 'member', public.sign_up('Asha Rao', '{}');
select throws_ok($$ select public.set_my_sign_up_answers('', 'salaried', '{}') $$, '22023', null, 'the city is needed');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram', null, '{}') $$, '22023', null, 'and what best describes them');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram', 'astronaut', '{}') $$, '22023', null, 'from the list');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram', 'student', '{mornings}') $$, '22023', null, 'and the play times from theirs');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram<script>', 'student', '{}') $$, '22023', null, 'a city in English letters');
select lives_ok($$ select public.set_my_sign_up_answers('  New   Delhi ', 'independent_professional', '{weekends,late_night,weekends}') $$,
  'the new member answers');
select lives_ok($$ select public.set_my_sign_up_answers('Gurugram', 'business_owner', '{weekday_evenings,weekends}') $$, 'and changes the answers');
reset role;
select results_eq($$ select city, occupation, play_times from public.member_preference where member_id = (select id from ids) $$,
  $$ values ('Gurugram'::text, 'business_owner'::text, '{weekday_evenings,weekends}'::text[]) $$, 'their answers are kept, each time once');

-- The photo: the kyc function asks, as the member, whether they may add one; they write nothing in the bucket themselves.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
select is(public.begin_sign_up_photo(), true, 'a new member may add a photo');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('kyc', '%s/%s/photo.jpg') $$,
  '00000000-0000-4000-8000-000000000001', (select id from ids)), '42501', null, 'but writes nothing in the bucket themselves');
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', '00000000-0000-4000-8000-000000000001/' || id || '/photo.jpg' from ids;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
select is(public.begin_sign_up_photo(), false, 'once the function has stored it, the photo is kept, and no other replaces it');
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', ids.id, 'Test', s.id
from ids cross join public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$ select public.begin_sign_up_photo() $$, 'RVMBR', null, 'a frozen member adds no photo');
reset role;

select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram', 'salaried', '{}') $$, '42501', null, 'staff answer nothing');
select throws_ok($$ select public.begin_sign_up_photo() $$, '42501', null, 'and add no photo');
reset role;
select is(has_function_privilege('anon', 'public.set_my_sign_up_answers(text, text, text[])', 'execute'), false, 'nor anyone signed out');
select is(has_function_privilege('anon', 'public.begin_sign_up_photo()', 'execute'), false, 'who adds no photo either');

select * from finish();
rollback;
