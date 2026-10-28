-- Lessons (#134; decision 0275): a member keeps each lesson's latest quiz result; only their own, only with
-- learn.academy_lessons. 630 Mira is a member whose tier has it; 202 Kabir another member; 103 Aditya is staff.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000630');
select lives_ok($$ select public.complete_learn_lesson('src_read_hands', 'unit_rh_flop', 3, 5) $$, 'Mira finishes a lesson, three of five right');
select lives_ok($$ select public.complete_learn_lesson('src_read_hands', 'unit_rh_flop', 5, 5) $$, 'and does it again, all five');
select lives_ok($$ select public.complete_learn_lesson('src_course', 'unit_course_1', 0, 0) $$, 'a lesson with no quiz is done with none asked');
select results_eq($$ select source_key, unit_id, correct, asked from public.learn_lesson order by source_key, unit_id $$,
  $$ values ('src_course'::text, 'unit_course_1'::text, 0, 0), ('src_read_hands', 'unit_rh_flop', 5, 5) $$,
  'she sees each lesson once, with her latest result');
select throws_ok($$ select public.complete_learn_lesson('src_read_hands', 'unit_rh_flop', 6, 5) $$, '22023', null, 'more right than asked is refused');
select throws_ok($$ select public.complete_learn_lesson('Not a key!', 'unit_rh_flop', 0, 0) $$, '22023', null, 'and a book key the app would not make');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.learn_lesson $$, 'another member sees none of hers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.complete_learn_lesson('src_read_hands', 'unit_rh_flop', 1, 1) $$, '42501', null, 'staff keep no lessons');
reset role;

select * from finish();
rollback;
