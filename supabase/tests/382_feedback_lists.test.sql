-- Feedback's lists on the server (8 Nov audit, I-64): open tickets are never cut, the counts are true past the old limit of
-- 500, Resolved and All feedback are apart and paged, and only staff with feedback.manage read them. 103 is the floor
-- manager, 104 a cashier; 213 Mihir and 216 Kunal are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.badge() returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'feedback'), 0);
$$;
grant execute on function pg_temp.badge() to authenticated;

delete from public.feedback where venue_id = '00000000-0000-4000-8000-000000000001';

-- 520 open tickets, the oldest two years back; 60 resolved; 70 ratings of 5 that were never tickets; one resolved long ago; and one raised long ago, resolved today.
insert into public.feedback (venue_id, member_id, note, created_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Open ' || n,
       case when n = 1 then now() - interval '2 years' else now() - make_interval(mins => n) end
from generate_series(1, 520) n;
insert into public.feedback (venue_id, member_id, note, created_at, resolved_at, resolved_by_staff_id, resolution)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Resolved ' || n, now() - make_interval(hours => n),
       now(), s.id, 'Done'
from generate_series(1, 60) n, public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.full_name = 'Aditya Malhotra';
with visits as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - make_interval(hours => n + 1), now() - make_interval(hours => n), 'door'
  from generate_series(1, 70) n
  returning id, closed_at)
insert into public.feedback (venue_id, member_id, visit_id, score, created_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', v.id, 5, v.closed_at from visits v;
insert into public.feedback (venue_id, member_id, note, created_at, resolved_at, resolved_by_staff_id, resolution)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', w.note, now() - interval '200 days', w.resolved, s.id, 'Done'
from public.staff s, (values ('Long ago', now() - interval '120 days'), ('Raised long ago', now())) w (note, resolved)
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.full_name = 'Aditya Malhotra';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select open, resolved, other from public.feedback_counts('00000000-0000-4000-8000-000000000001') $$,
  $$ values (520, 61, 70) $$, 'each list counted past the old 500, resolved and other apart, the last 90 days of those, a ticket by when it was resolved');
select is((select count(*)::integer from public.venue_feedback('00000000-0000-4000-8000-000000000001') where is_ticket and resolved_at is null), 520, 'no open ticket is cut');
select is((select count(*)::integer from public.venue_feedback('00000000-0000-4000-8000-000000000001') where note = 'Open 1'), 1, 'not even the oldest, two years old');
select is(pg_temp.badge(), 520, 'and the rail''s badge counts all of them');

select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved')), 50, 'Resolved comes fifty at a time');
select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') where not is_ticket or resolved_at is null), 0, 'only tickets resolved');
select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'other') where is_ticket), 0, 'and All feedback none that were tickets');
select set_config('test.at', (select created_at::text from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') order by created_at limit 1), true);
select set_config('test.id', (select id::text from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') order by created_at limit 1), true);
select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved', current_setting('test.at')::timestamptz, current_setting('test.id')::uuid)),
  11, 'the next page has the rest');
select is((select count(*)::integer from (
    select id from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved')
    intersect
    select id from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved', current_setting('test.at')::timestamptz, current_setting('test.id')::uuid)) both_pages), 0,
  'with none of the first');
select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved', current_setting('test.at')::timestamptz, current_setting('test.id')::uuid) where note = 'Raised long ago'), 1,
  'a ticket raised long ago and just resolved is there');
select is((select count(*)::integer from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved', current_setting('test.at')::timestamptz, current_setting('test.id')::uuid) where note = 'Long ago'), 0, 'one resolved over 90 days ago is not');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select open, resolved, other from public.feedback_counts('00000000-0000-4000-8000-000000000001') $$, $$ values (0, 0, 0) $$, 'a cashier counts nothing');
select is_empty($$ select 1 from public.feedback_page('00000000-0000-4000-8000-000000000001', 'other') $$, 'and reads no page');
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Admin', 'Admin', 'admin');

-- Marketing, an investor and another venue's admin are refused as a cashier is.
select pg_temp.as_person('00000000-0000-4000-8000-000000000636');
select results_eq($$ select open, resolved, other from public.feedback_counts('00000000-0000-4000-8000-000000000001') $$, $$ values (0, 0, 0) $$, 'marketing counts nothing');
select is_empty($$ select 1 from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') $$, 'and reads no page');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select results_eq($$ select open, resolved, other from public.feedback_counts('00000000-0000-4000-8000-000000000001') $$, $$ values (0, 0, 0) $$, 'nor does an investor');
select is_empty($$ select 1 from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') $$, 'who reads no page');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select open, resolved, other from public.feedback_counts('00000000-0000-4000-8000-000000000001') $$, $$ values (0, 0, 0) $$, 'nor another venue''s admin');
select is_empty($$ select 1 from public.feedback_page('00000000-0000-4000-8000-000000000001', 'resolved') $$, 'who reads no page');

-- A note from Profile is limited as the app's other forms are, now that no list cap contains it.
select lives_ok($$ select public.send_feedback('Note ' || n) from generate_series(1, 10) n $$, 'a member sends ten notes in an hour');
select throws_ok($$ select public.send_feedback('One more') $$, 'RVRAT', null, 'and no more');

reset role;
select ok(not has_function_privilege('anon', 'public.feedback_counts(uuid)', 'execute'), 'nobody signed out counts them');
select ok(not has_function_privilege('anon', 'public.feedback_page(uuid, text, timestamptz, uuid)', 'execute'), 'nor reads them');

select * from finish();
rollback;
