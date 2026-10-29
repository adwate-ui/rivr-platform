-- Learn sources (#131): a super admin registers an uploaded encoding with its licence; its feature key is on for every
-- tier, and off for everyone once the licence lapses. 101 Vikram is a super admin; 103 Aditya an admin; 213 Mihir a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Learn, the Academy and Events are off since #637 (decision 0284): this test of them turns them back on for every tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, true, 'locked', now() - interval '1 second'
from public.tier t cross join (values ('learn.library'), ('academy.booking'), ('events.book')) as k (key);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Another venue, made first as its settings take effect when the test begins, with its own super admin.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Owner', 'Owner', 'super_admin');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.register_learn_source('00000000-0000-4000-8000-000000000001', 'src_test', 'Test book', null, 'abc123',
                                                       'Licensed for the club', current_date + 30) $$, '22023', 'Upload the encoding first',
  'nothing is registered before its file is uploaded');
reset role;
insert into storage.objects (bucket_id, name) values ('learn-sources', '00000000-0000-4000-8000-000000000001/src_test.json');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.register_learn_source('00000000-0000-4000-8000-000000000001', 'src_test', 'Test book', null, 'abc123',
                                                       'Licensed for the club', current_date + 30) $$, '42501', null, 'an admin keeps no sources');
select ok(not private.may_handle_learn_sources('00000000-0000-4000-8000-000000000001/src_test.json'), 'nor reaches their files');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select ok(private.may_handle_learn_sources('00000000-0000-4000-8000-000000000001/src_test.json'), 'a super admin reaches them');
select ok(not private.may_handle_learn_sources('../src_test.json'), 'at a venue''s folder only');
select isnt(public.register_learn_source('00000000-0000-4000-8000-000000000001', 'src_test', 'Test book', 'A. Author', 'abc123', 'Licensed for the club',
                                         current_date + 30), null, 'a super admin registers the uploaded source');
select is((select count(*)::integer from public.learn_source), 1, 'and sees it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.learn_source $$, 'an admin does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.learn_source), 1, 'a member sees it in the library, as their tier has it (test 181)');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.learn_source $$, 'nor another venue''s super admin');
select ok(not private.may_handle_learn_sources('00000000-0000-4000-8000-000000000001/src_test.json'), 'who reaches none of its files');
reset role;
insert into storage.objects (bucket_id, name) values ('learn-sources', '00000000-0000-4000-8000-0000000000e1/src_test.json');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.register_learn_source('00000000-0000-4000-8000-0000000000e1', 'src_test', 'Test book', null, 'abc123',
                                                       'Ours', current_date + 1) $$, '22023', 'Another venue holds that source',
  'nor registers a key another venue holds, so its licence never decides theirs');
reset role;

select is((select available_until from public.feature where key = 'learn.source.src_test'), current_date + 30, 'its feature ends with the licence');
select ok(private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.source.src_test'), 'every member''s tier has it');
select is((select state from private.feature_state('00000000-0000-4000-8000-000000000213', 'learn.source.src_test')), 'enabled', 'and the app shows it');

-- The licence lapses: off for everyone, even a member granted it by hand.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'learn.source.src_test', true, 'Test');
update public.feature set available_until = current_date - 1 where key = 'learn.source.src_test';
select ok(not private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.source.src_test'), 'a lapsed licence switches it off');
select ok(not private.has_feature('00000000-0000-4000-8000-000000000214', 'learn.source.src_test'), 'for everyone');
select is((select state from private.feature_state('00000000-0000-4000-8000-000000000213', 'learn.source.src_test')), 'hidden', 'and the app hides it');
select ok(private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.library'), 'other features are as they were');

-- A renewed licence switches it back on.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.register_learn_source('00000000-0000-4000-8000-000000000001', 'src_test', 'Test book', 'A. Author', 'abc124',
                                                      'Renewed for a year', current_date + 365) $$, 'the licence is renewed');
reset role;
select ok(private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.source.src_test'), 'and it is on again');

select * from finish();
rollback;
