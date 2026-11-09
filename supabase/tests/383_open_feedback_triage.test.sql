-- The open tickets to triage (8 Nov audit, I-65): oldest first, with the visit's tables and the wait to a first seat; several
-- resolved at once, all or none. 103 is the floor manager, 104 a cashier; 213 Mihir and 216 Kunal are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;

delete from public.feedback where venue_id = '00000000-0000-4000-8000-000000000001';

-- Mihir checked in, waited 40 minutes, then played two tables, and rated it 2.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000a3831', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
   now() - interval '10 hours', now() - interval '5 hours', 'door');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, ended_at, end_reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3831', pg_temp.table_id('Table 3'), 5,
   now() - interval '9 hours 20 minutes', now() - interval '8 hours', 'left'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3831', pg_temp.table_id('Table 1'), 7,
   now() - interval '8 hours', now() - interval '5 hours', 'left');
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000a3832', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
   now() - interval '30 hours', now() - interval '26 hours', 'door');
insert into public.feedback (id, venue_id, member_id, visit_id, score, note, created_at) values
  ('00000000-0000-4000-8000-0000000f3831', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a3831', 2, null, now() - interval '4 hours'),
  ('00000000-0000-4000-8000-0000000f3834', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000a3832', 5, 'Not a ticket', now());
insert into public.feedback (id, venue_id, member_id, note, created_at) values
  ('00000000-0000-4000-8000-0000000f3832', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'The older note', now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000f3833', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'A note', now() - interval '1 hour');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select id from public.open_feedback('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('00000000-0000-4000-8000-0000000f3832'::uuid), ('00000000-0000-4000-8000-0000000f3831'), ('00000000-0000-4000-8000-0000000f3833') $$,
  'the open tickets, oldest first, none that is not a ticket');
select results_eq($$ select tables, wait_seconds from public.open_feedback('00000000-0000-4000-8000-000000000001') where id = '00000000-0000-4000-8000-0000000f3831' $$,
  $$ values ('Table 1, Table 3'::text, 2400) $$, 'a rating says the visit''s tables and the forty minutes to a first seat');
select results_eq($$ select tables, wait_seconds from public.open_feedback('00000000-0000-4000-8000-000000000001') where id = '00000000-0000-4000-8000-0000000f3833' $$,
  $$ values (null::text, null::integer) $$, 'a note has neither');

select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3832', '00000000-0000-4000-8000-0000000f3834']::uuid[], 'Called them') $$,
  '22023', null, 'one that is no open ticket refuses them all');
select is((select count(*)::integer from public.open_feedback('00000000-0000-4000-8000-000000000001')), 3, 'and resolves none');
select throws_ok($$ select public.resolve_feedback_many(array[]::uuid[], 'Called them') $$, '22023', null, 'nothing ticked is refused');
select throws_ok($$ select public.resolve_feedback_many(array(select gen_random_uuid() from generate_series(1, 501)), 'Called them') $$, 'RVMAX', null, 'more than 500 at once is refused on its own code');
select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3832', '00000000-0000-4000-8000-0000000f3833']::uuid[], ' ') $$, '22023', null, 'and no line');
select lives_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3832', '00000000-0000-4000-8000-0000000f3833', '00000000-0000-4000-8000-0000000f3832']::uuid[], ' Called them ') $$,
  'several resolve with one line, a repeat counted once');
select results_eq($$ select resolution, resolved_by is not null from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') $$,
  $$ values ('Called them'::text, true), ('Called them', true) $$, 'each with the line and who did it');
select is((select count(*)::integer from public.open_feedback('00000000-0000-4000-8000-000000000001')), 1, 'and only the other stays open');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select 1 from public.open_feedback('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees no tickets');
select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3831']::uuid[], 'Called') $$, '42501', null, 'and resolves none');
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Admin', 'Admin', 'admin');

-- Marketing, an investor and another venue's admin are refused as a cashier is.
select pg_temp.as_person('00000000-0000-4000-8000-000000000636');
select is_empty($$ select 1 from public.open_feedback('00000000-0000-4000-8000-000000000001') $$, 'marketing sees no tickets');
select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3831']::uuid[], 'Called') $$, '42501', null, 'and resolves none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select 1 from public.open_feedback('00000000-0000-4000-8000-000000000001') $$, 'nor does an investor');
select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3831']::uuid[], 'Called') $$, '42501', null, 'who resolves none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.open_feedback('00000000-0000-4000-8000-000000000001') $$, 'nor another venue''s admin');
select throws_ok($$ select public.resolve_feedback_many(array['00000000-0000-4000-8000-0000000f3831']::uuid[], 'Called') $$, '42501', null, 'who resolves none');

reset role;
select ok(not has_function_privilege('anon', 'public.open_feedback(uuid)', 'execute'), 'nobody signed out reads them');
select ok(not has_function_privilege('anon', 'public.resolve_feedback_many(uuid[], text)', 'execute'), 'nor resolves them');

select * from finish();
rollback;
