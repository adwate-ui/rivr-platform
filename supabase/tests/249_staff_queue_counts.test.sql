-- Each queue's count beside its rail entry, for the staff who act on it (decision 0301). 103 Aditya (admin), 106 Pema
-- (dealer), 108 Karan (host).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- What a person's rail says waits in one queue at the club, 0 when it is left out.
create function pg_temp.waiting(p_person text, p_queue text) returns integer language plpgsql as $$
declare
  v_waiting integer;
begin
  perform pg_temp.as_person(p_person);
  v_waiting := coalesce((select c.waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') c where c.queue = p_queue), 0);
  perform set_config('role', 'postgres', true);
  return v_waiting;
end;
$$;

create temp table before as
select q.queue, pg_temp.waiting('00000000-0000-4000-8000-000000000103', q.queue) as waiting
from unnest(array['waitlist', 'feedback', 'kycReview', 'liveFloor']) q (queue);
reset role;

-- A join request from the app, a feedback ticket and a check to review: each count goes up by one.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, joined_at, approved_at, status, idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', t.id, now(), null, 'waiting', gen_random_uuid()
from public.table_type t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.code = 'nlh_100_200';
insert into public.feedback (venue_id, member_id, note, ratings, nps)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'The chai was cold.',
        '{"ambience": 4, "cashier": 4, "gameplay": 3, "service": 3}', 7);
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'needs_review', 'pan', '1992-03-03');

select is(pg_temp.waiting('00000000-0000-4000-8000-000000000103', 'waitlist'), (select waiting + 1 from before where queue = 'waitlist'),
  'the admin''s rail counts the new join request');
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000103', 'feedback'), (select waiting + 1 from before where queue = 'feedback'),
  'and the new feedback ticket');
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000103', 'kycReview'), (select waiting + 1 from before where queue = 'kycReview'),
  'and the check to review');
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000108', 'waitlist'), (select waiting + 1 from before where queue = 'waitlist'),
  'a host, who runs the waitlist, counts the join request too');
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000108', 'feedback'), 0, 'but no feedback, which is not a host''s');
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000108', 'kycReview'), 0, 'nor checks to review');
-- Ishaan, seated, asks to leave: the Live floor counts him on its Leaving list.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 4,
  '9000000211');
reset role;
update public.seat_session set leaving_at = now() where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select is(pg_temp.waiting('00000000-0000-4000-8000-000000000103', 'liveFloor'), (select waiting + 1 from before where queue = 'liveFloor'),
  'the Live floor counts the member on its Leaving list');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.staff_queue_counts('00000000-0000-4000-8000-000000000001')), 0, 'a dealer''s rail counts nothing');
reset role;
select ok(not has_function_privilege('anon', 'public.staff_queue_counts(uuid)', 'execute'), 'the public counts nothing');

select * from finish();
rollback;
