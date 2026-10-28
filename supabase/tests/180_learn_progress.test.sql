-- Learn progress (#132, #135): answers and cards sync from the app, each answer once; a completed session earns its points
-- and each principle's first mastery, within the day's cap, once. 213 Mihir and 214 Yash are members with learn.drills.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.answer(p_id text, p_session text, p_principle text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'session_id', p_session, 'source_key', 'src_example', 'principle_id', p_principle,
                            'answered_at', now(), 'attempt', jsonb_build_object('correct', true));
$$;
grant execute on function pg_temp.answer(text, text, text) to authenticated;
create function pg_temp.points(p_member uuid) returns bigint language sql security definer as $$
  select coalesce(sum(s.points), 0)::bigint from public.learn_session s where s.member_id = p_member;
$$;
grant execute on function pg_temp.points(uuid) to authenticated;
-- Another venue, made first as its settings take effect when the test begins, with its own member.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3', 'Elsewhere Member', '+919000000997');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is(public.sync_learn_progress(
  jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', 'p_open'),
                    pg_temp.answer('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000b001', 'p_cbet')),
  jsonb_build_array(jsonb_build_object('source_key', 'src_example', 'card_key', 'p_open#1', 'state', jsonb_build_object('reps', 1),
                                       'due_at', now() + interval '1 day'))), 2, 'two answers and a card sync from the app');
select is(public.sync_learn_progress(
  jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000b001', 'p_cbet')),
  jsonb_build_array(jsonb_build_object('source_key', 'src_example', 'card_key', 'p_open#1', 'state', jsonb_build_object('reps', 2),
                                       'due_at', now() + interval '3 days'))), 0, 'an answer sent again is kept once');
select results_eq($$ select (state ->> 'reps')::integer from public.learn_card $$, $$ values (2) $$, 'and the card keeps its latest state');
select throws_ok($$ select public.sync_learn_progress('[{"id": "not a uuid"}]', '[]') $$, '22023', null, 'a malformed answer is refused');

-- Completing the session: 10 for it and 25 for each of two principles mastered first, 60; again, the same 60, once.
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b001', array['p_open', 'p_cbet']), 60::bigint,
  'a session with two principles first mastered earns 60');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b001', array['p_open', 'p_cbet']), 60::bigint,
  'completing it again earns nothing more');
select throws_ok($$ select public.complete_learn_session('00000000-0000-4000-8000-00000000b009', '{}') $$, '22023', null,
  'a session with no answers kept is not completed');
-- A second session drills a mastered principle again: the session's 10 only. A third reaches the cap of 100.
select public.sync_learn_progress(jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000b002', 'p_open')), '[]');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b002', array['p_open']), 10::bigint,
  'a principle mastered before earns nothing again');
select public.sync_learn_progress(jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a004', '00000000-0000-4000-8000-00000000b003', 'p_x')), '[]');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b003', array['p_x', 'p_y']), 30::bigint,
  'near the cap, only the 30 left of the day''s 100');
select public.sync_learn_progress(jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-00000000b004', 'p_z')), '[]');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b004', array['p_z']), 0::bigint, 'at the cap, nothing');
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 100::bigint, 'Mihir has earned the day''s 100');
reset role;
select is((select count(*)::integer from public.ledger_transaction where idempotency_key like 'learn_session:%'), 3,
  'and the points ledger has the three sessions that earned any');

-- Each member sees only their own; without learn.drills, nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select 1 from public.learn_attempt $$, 'Yash sees none of Mihir''s answers');
select is_empty($$ select 1 from public.learn_card $$, 'nor his cards');
select is_empty($$ select 1 from public.learn_session $$, 'nor his sessions');
-- Yash, with room under the cap, claims a principle he never answered in the session: it earns nothing.
select public.sync_learn_progress(jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a006', '00000000-0000-4000-8000-00000000b005', 'p_q')), '[]');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b005', array['p_q', 'p_r']), 35::bigint,
  'only a principle answered in the session counts: 10 and 25, not 60');
select results_eq($$ select principles from public.learn_session where id = '00000000-0000-4000-8000-00000000b005' $$,
  $$ values (array['p_q']) $$, 'and only it is kept as mastered');
-- The same principle id in another book is a principle of its own.
select public.sync_learn_progress(jsonb_build_array(pg_temp.answer('00000000-0000-4000-8000-00000000a007', '00000000-0000-4000-8000-00000000b006', 'p_q')
                                                    || '{"source_key": "src_other"}'), '[]');
select is(public.complete_learn_session('00000000-0000-4000-8000-00000000b006', array['p_q']), 35::bigint,
  'p_q mastered in another source earns its own 25');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'learn.drills', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.sync_learn_progress('[]', '[]') $$, '42501', null, 'a member without Learn drills syncs nothing');
reset role;
-- Another venue's member, with Learn drills there, sees nothing of this venue's.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select is_empty($$ select 1 from public.learn_attempt union all select 1 from public.learn_card union all select 1 from public.learn_session $$,
  'another venue''s member sees none of it');
reset role;

-- The points rule as a venue might set it: 5 a session, nothing a principle.
select is(private.learn_points(2, 0, 5, 0, 100), 5::bigint, 'with 5 a session and nothing a principle, two mastered still earn 5');

select * from finish();
rollback;
