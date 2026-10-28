-- Learn sources (#131): a super admin registers an uploaded encoding with its licence; its feature key is on for every
-- tier, and off for everyone once the licence lapses. 101 Vikram is a super admin; 103 Aditya an admin; 213 Mihir a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

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
