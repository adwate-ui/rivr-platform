-- Feedback from the player app (#160; decision 0165). Home asks a member about their last visit, closed
-- in the week and not yet rated; they rate it once, 1 to 5 with a note if they like. A score of 3 or
-- below, and a note from Profile, is a ticket the General Manager (feedback.manage: the owner 101 and
-- the floor manager 103) resolves with what was done; a cashier (104) sees none. 213 Mihir and 216 Kunal
-- are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Mihir's visit last night, and one of Kunal's a fortnight ago.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000a9701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
   now() - interval '20 hours', now() - interval '15 hours', 'door'),
  ('00000000-0000-4000-8000-0000000a9702', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
   now() - interval '15 days', now() - interval '14 days', 'door');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select visit_id from public.my_feedback_visit() $$, $$ values ('00000000-0000-4000-8000-0000000a9701'::uuid) $$,
  'Home asks Mihir about last night');
select throws_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9701', 6, null) $$, '22023', null, 'a score is 1 to 5');
select throws_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9702', 4, null) $$, '42501', null, 'he rates only his own visit');
select lives_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9701', 2, '  The dealer at Table 3 was slow.  ') $$,
  'he gives it a 2, with a note');
select throws_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9701', 5, null) $$, 'RVDUP', null, 'once');
select is_empty($$ select * from public.my_feedback_visit() $$, 'and Home stops asking');
select is_empty($$ select * from public.feedback $$, 'he reads no feedback rows, not even his own: only through the functions');
reset role;
select results_eq($$ select score, note, is_ticket from public.feedback $$, $$ values (2::smallint, 'The dealer at Table 3 was slow.'::text, true) $$,
  'his 2 is a ticket, the note trimmed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.send_feedback('   ') $$, '22023', null, 'a note from Profile says something');
select lives_ok($$ select public.send_feedback('Please add PLO on Mondays.') $$, 'and he sends the club a note');
select throws_ok($$ insert into public.feedback (venue_id, member_id, note) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Direct') $$, '42501', null,
  'feedback is written only through the functions');

select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select * from public.my_feedback_visit() where visit_id = '00000000-0000-4000-8000-0000000a9702' $$,
  'a visit a fortnight old is not asked about');
select throws_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9702', 4, null) $$, 'RVOLD', null, 'nor rated');
select is_empty($$ select * from public.feedback $$, 'Kunal sees nobody else''s feedback');

-- The General Manager's list: the open tickets first, and resolving one.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.venue_feedback('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees no feedback');
select is_empty($$ select * from public.feedback $$, 'not even through the table');
select throws_ok($$ select public.resolve_feedback((select id from public.feedback limit 1), 'Spoke to him') $$, '42501', null,
  'nor resolves any');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, score, note, is_ticket, resolved_at is null from public.venue_feedback('00000000-0000-4000-8000-000000000001')
                     where full_name = 'Mihir Shah' or member_id = '00000000-0000-4000-8000-000000000213' order by created_at $$,
  $$ values ('Mihir Shah'::text, 2::smallint, 'The dealer at Table 3 was slow.'::text, true, true),
            ('Mihir Shah', null, 'Please add PLO on Mondays.', true, true) $$,
  'the floor manager sees both of Mihir''s, each an open ticket');
select throws_ok($$ select public.resolve_feedback((select id from public.feedback where score = 2), ' ') $$, '22023', null,
  'a ticket is resolved with what was done');
select lives_ok($$ select public.resolve_feedback((select id from public.feedback where score = 2), 'Called him; the dealer is retraining.') $$,
  'she resolves the 2');
select throws_ok($$ select public.resolve_feedback((select id from public.feedback where score = 2), 'Again') $$, '22023', null, 'once');
select results_eq($$ select resolution, resolved_by is not null from public.venue_feedback('00000000-0000-4000-8000-000000000001') where score = 2 $$,
  $$ values ('Called him; the dealer is retraining.'::text, true) $$, 'with what was done and who did it');

-- A happy visit is no ticket.
reset role;
update public.feedback set visit_id = null, score = null where score = 2;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.rate_visit('00000000-0000-4000-8000-0000000a9701', 5, null) $$, 'a 5, with no note');
reset role;
select is((select is_ticket from public.feedback where score = 5), false, 'is no ticket');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.resolve_feedback((select id from public.feedback where score = 5), 'Nothing to do') $$, '22023', null,
  'and there is nothing to resolve');

select * from finish();
rollback;
