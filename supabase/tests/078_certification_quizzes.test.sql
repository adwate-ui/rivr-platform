-- Certification quizzes (#50): the practice venue has the dealer and cashier quizzes and the club none;
-- staff read the questions, never the answers; the database marks an attempt and records it on the
-- staff record of who took it, five of six being a pass at 80%; staff see their own attempts and staff
-- managers the venue's, never the answers; a new practice venue gets the quizzes, and its staff see only its own. A tablet
-- says whether it stands in the practice venue. 103 Aditya is an admin (manages staff), 104 Sana a
-- cashier, 106 Pema a dealer, 201 Arjun a member; 202 Kabir is made a dealer at a second practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- The training set, in the practice venue only.
select results_eq(
  $$ select v.slug, q.role::text, q.title, q.pass_percent::integer, jsonb_array_length(q.questions)
     from public.quiz q join public.venue v on v.id = q.venue_id order by v.slug, q.role $$,
  $$ values ('practice', 'cashier', 'Cashier certification', 80, 6), ('practice', 'dealer', 'Dealer certification', 80, 6) $$,
  'the practice venue has the cashier and dealer certification quizzes, six questions each; the club has none');
select is_empty(
  $$ select q.role from public.quiz q, unnest(q.answer_key) with ordinality as k (choice, n)
     where k.choice < 0 or k.choice >= jsonb_array_length(q.questions -> (k.n::integer - 1) -> 'choices') $$,
  'every answer is one of its question''s choices');

create temporary table quizzes on commit drop as
select q.id, q.role::text as role from public.quiz q join public.venue v on v.id = q.venue_id where v.slug = 'practice';
grant select on quizzes to authenticated;

-- Reading them.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select title from public.quiz order by title $$, $$ values ('Cashier certification'), ('Dealer certification') $$,
  'staff read the practice venue''s quizzes');
select throws_ok($$ select answer_key from public.quiz $$, '42501', null, 'but never the answers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select id from public.quiz $$, 'a member reads none');

-- Taking them: the cashier's answers are 1, 2, 0, 1, 0, 2; the dealer's 1, 0, 2, 1, 0, 2.
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 0, 2]) $$,
  '42501', null, 'a member takes no quiz');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.submit_quiz(gen_random_uuid(), array[1, 2, 0, 1, 0, 2]) $$, '42501', null, 'nor anyone a quiz that does not exist');
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0]) $$,
  '22023', null, 'every question is answered');
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 0, null]) $$,
  '22023', null, 'none left blank');
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 0, 3]) $$,
  '22023', null, 'each with one of its own choices');
select results_eq($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 2, 1]) $$,
  $$ values (4, 6, false) $$, 'four of six is not a pass at 80%');
select results_eq($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 0, 1]) $$,
  $$ values (5, 6, true) $$, 'five of six is');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select * from public.submit_quiz((select id from quizzes where role = 'dealer'), array[1, 0, 2, 1, 0, 2]) $$,
  $$ values (6, 6, true) $$, 'the dealer passes the dealer quiz, six of six');
reset role;
select results_eq(
  $$ select s.user_id, v.slug, q.role::text, a.correct_count::integer, a.is_passed, a.answers
     from public.quiz_attempt a join public.staff s on s.id = a.staff_id join public.venue v on v.id = a.venue_id
     join public.quiz q on q.id = a.quiz_id order by a.created_at $$,
  $$ values ('00000000-0000-4000-8000-000000000104'::uuid, 'practice'::text, 'cashier'::text, 4, false, '{1,2,0,1,2,1}'::smallint[]),
            ('00000000-0000-4000-8000-000000000104'::uuid, 'practice', 'cashier', 5, true, '{1,2,0,1,0,1}'),
            ('00000000-0000-4000-8000-000000000106'::uuid, 'practice', 'dealer', 6, true, '{1,0,2,1,0,2}') $$,
  'each attempt is kept on the staff record of who took it, in the practice venue');

-- Who sees attempts.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select correct_count::integer from public.quiz_attempt $$, $$ values (6) $$, 'a dealer sees their own attempts only');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select correct_count::integer from public.quiz_attempt order by created_at $$, $$ values (4), (5) $$, 'so does the cashier');
select throws_ok($$ select answers from public.quiz_attempt $$, '42501', null, 'but not what was answered: a perfect attempt''s answers are the key');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select count(*)::integer from public.quiz_attempt $$, $$ values (3) $$, 'staff who manage staff see everyone''s');
select throws_ok($$ update public.quiz_attempt set is_passed = true $$, '42501', null, 'nobody changes an attempt');
select throws_ok(
  $$ insert into public.quiz_attempt (venue_id, quiz_id, staff_id, answers, correct_count, question_count, is_passed)
     select '00000000-0000-4000-8000-000000000002', id, gen_random_uuid(), '{1}', 6, 6, true from quizzes where role = 'dealer' $$,
  '42501', null, 'or writes one but by taking the quiz');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select id from public.quiz_attempt $$, 'a member sees none');
reset role;
select throws_ok($$ delete from public.quiz_attempt $$, '42501', null, 'attempts are kept for good');
select is_empty($$ select id from public.audit_log where entity in ('quiz', 'quiz_attempt') $$,
  'and neither the quizzes nor the attempts go to the audit log, whose readers would see the answers');

-- A new practice venue gets the training set; its staff see only its own. Operations create venues signed out.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f2', 'Annex', 'annex', true, 'Annex', 'Somewhere', 'ANX');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f3', 'Club two', 'club-two', false, 'Club two', 'Elsewhere', 'CL2');
select results_eq($$ select v.slug, count(*)::integer from public.quiz q join public.venue v on v.id = q.venue_id group by v.slug order by v.slug $$,
  $$ values ('annex', 2), ('practice', 2) $$, 'a new practice venue has the quizzes, a new club none');
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000000202', 'Kabir Sethi', 'Dealer', 'dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select venue_id from public.quiz group by venue_id $$, $$ values ('00000000-0000-4000-8000-0000000000f2'::uuid) $$,
  'staff of another venue see only its quizzes');
select is_empty($$ select id from public.quiz_attempt $$, 'and none of this venue''s attempts');
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'dealer'), array[1, 0, 2, 1, 0, 2]) $$,
  '42501', null, 'nor take this venue''s quiz');

-- The tablet knows whether it stands in the practice venue.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000002');
insert into public.device (venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-000000000002', 'dealer_tablet', 'Practice tablet', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Club tablet', '00000000-0000-4000-8000-00000000e002');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select name, is_practice from public.my_device() $$, $$ values ('Practice tablet'::text, true) $$,
  'a tablet in the practice venue says so');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e002');
select results_eq($$ select name, is_practice from public.my_device() $$, $$ values ('Club tablet'::text, false) $$, 'a club tablet does not');

-- Not while the venue is frozen (last: a freeze is released only by two super admins).
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000002', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.submit_quiz((select id from quizzes where role = 'cashier'), array[1, 2, 0, 1, 0, 2]) $$,
  'RVFRZ', null, 'no quiz is taken while the practice venue is frozen');

select * from finish();
rollback;
