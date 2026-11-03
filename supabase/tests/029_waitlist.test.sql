-- The waitlist (#38), a list per table (decision 0467). The seed puts Kabir (202), Naina (203) and Rohan (204) on Table 2's
-- list (100/200) in that order; Table 1 (50/100) has nobody. 201 Arjun and 209 Tara are members; 103 Aditya is the floor (waitlist.manage);
-- 106 Pema is a dealer and 109 the investor (owner_view); 301 is a member of the practice venue. A join from the app
-- is a request the floor approves (#633), and a member waits for one game at a time; 211 Ishaan waits for none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716). The night turns at 06:00 IST (private.tonight_began), so a
-- run just after 06:00 would put the joins and visits made minutes earlier on last night's side; the turn itself is 043's
-- and 220's to test. Here tonight_began keeps its rule, with the turn moved to twelve hours ago, until the test rolls back.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

-- Arjun's seeded identity check (#21) is set aside: this test takes him through the check from the start.
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201';

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.table_id(text) to authenticated;

-- Arjun and Naina have finished their identity check; Tara has not.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'verified', 'digilocker', '1985-05-05', 'ABCPA1111A',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'verified', 'digilocker', '1990-04-12', 'ABCPN1234D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg', now());

-- Priority is #40's (032_waitlist_priority): here every list is in join-time order, so Arjun, a
-- black card at 100/200, queues like anyone else.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select venue_id, 'waitlist.priority_weights', id::text, '{"weight": 0, "only_at_qualifying_stake": true}', now(), 'Test'
from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card';

-- A member joins from the app.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-00000000aa01'), null,
  'a member with a finished identity check joins Table 2''s list from the app');
select is(public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-00000000aa01'),
          (select entry_id from public.my_waitlist()), 'a retried join adds them once');
select is(public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-00000000aa02'),
          (select entry_id from public.my_waitlist()), 'and joining again keeps their one place');
select results_eq($$ select table_type_name, small_blind_paise, big_blind_paise, place, is_request from public.my_waitlist() $$,
  $$ values ('NLH 100/200'::text, 10000::bigint, 20000::bigint, null::integer, true) $$,
  'their join is a request: no place until the floor approves it (#633)');
select results_eq($$ select g.name, l.waiting, l.call_time_minutes from public.waitlist_lengths() l join public.game_table g on g.id = l.table_id
                     order by g.position $$,
  $$ values ('Table 1'::text, 0, 180), ('Table 2', 3, 180), ('Table 3', 0, 180), ('Table 4', 0, 180), ('Table 5', 0, 180), ('Private Room', 0, 180) $$,
  'and how many wait on each table''s list, never who, a request not counted, with its stake''s call time');
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 1'), gen_random_uuid()) $$, 'RVONE', null,
  'they wait on one list at a time (#633)');
select is((select count(*)::integer from public.waitlist_entry), 1, 'a member sees only their own place');

-- Refusals.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 1'), '00000000-0000-4000-8000-00000000aa03') $$,
  'RVKYC', null, 'not without a finished identity check');
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000209', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 1'), '00000000-0000-4000-8000-00000000aa04') $$,
  'RVMBR', null, 'nor while the member is frozen');
reset role;

-- The floor.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select results_eq($$ select full_name from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Arjun Mehta'::text) $$, 'the floor sees the join waiting for it');
select lives_ok($$ select public.approve_waitlist_request((select entry_id from public.waitlist_requests('00000000-0000-4000-8000-000000000001'))) $$,
  'and approves it onto the list');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 1'), '90000 00203', gen_random_uuid()) $$, 'RVONE', null,
  'the floor adds nobody already waiting on another list');
select isnt(public.add_to_waitlist(pg_temp.table_id('Table 1'), '90000 00211', '00000000-0000-4000-8000-00000000aa05'), null,
  'the floor adds a member by their mobile number, on the list at once');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 1'), '9999999999', '00000000-0000-4000-8000-00000000aa06') $$,
  'RVNOM', null, 'and says when no member has the number');
select results_eq(
  $$ select g.name, b.full_name, b.place, b.added_by_floor from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
     join public.game_table g on g.id = b.asked_table_id order by g.position, b.place $$,
  $$ values ('Table 1'::text, 'Ishaan Verma'::text, 1, true), ('Table 2', 'Kabir Sethi', 1, false), ('Table 2', 'Naina Kapoor', 2, false),
            ('Table 2', 'Rohan Bhatia', 3, false), ('Table 2', 'Arjun Mehta', 4, false) $$,
  'the floor sees each table''s list in order, with names, and who the floor added');
select lives_ok($$ select public.leave_waitlist((select e.id from public.waitlist_entry e
                    where e.member_id = '00000000-0000-4000-8000-000000000202' and e.status = 'waiting')) $$,
  'the floor takes a member off a list');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 1'), '9000000201', '00000000-0000-4000-8000-00000000aa07') $$,
  '42501', null, 'a dealer adds nobody');
select is_empty($$ select * from public.waitlist_board('00000000-0000-4000-8000-000000000001') $$, 'and sees no board');
select is_empty($$ select * from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$, 'nor the requests');

-- Leaving.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select place from public.my_waitlist()), 3, 'one ahead leaves, and the member moves up');
select throws_ok($$ select public.leave_waitlist((select e.id from public.waitlist_entry e limit 0)) $$, '42501', null,
  'nobody takes a place that is not theirs');
select lives_ok($$ select public.leave_waitlist((select entry_id from public.my_waitlist())) $$, 'a member leaves their place');
select is_empty($$ select * from public.my_waitlist() $$, 'and is on no list');
reset role;
select ok(exists (select 1 from public.outbox_event e where e.event_type = 'waitlist.joined'
                  and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000201'), 'joining emits waitlist.joined');
-- Joining and leaving again within the hour emits nothing more (#274), so nothing sent on it repeats.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-00000000a274'), null, 'Arjun joins again');
select lives_ok($$ select public.leave_waitlist((select entry_id from public.my_waitlist())) $$, 'leaves again');
select isnt(public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-00000000a275'), null, 'and joins a third time');
reset role;
select is((select count(*)::integer from public.outbox_event e where e.event_type = 'waitlist.joined'
           and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000201'), 1, 'within the hour, waitlist.joined once');


-- Nobody else takes a place off a list: not a dealer, the investor, a sign-in that is no one, nor
-- another member, even holding the place's id (an outbox payload carries it).
create temporary table rohans_place on commit drop as
  select id from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000204' and status = 'waiting';
grant select on rohans_place to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, '42501', null, 'a dealer takes nobody off a list');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000109", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, '42501', null, 'nor the investor');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000009ff", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, '42501', null, 'nor a sign-in that is no one');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, '42501', null, 'nor another member');
reset role;
select is((select status from public.waitlist_entry where id = (select id from rohans_place)), 'waiting', 'so the place stands');

-- A request id replays only its own place, and a member joins only their own venue's tables.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 2'), '00000000-0000-4000-8000-000000000203') $$,
  '22023', null, 'another member''s request id joins nobody');
select throws_ok($$ select public.join_waitlist_at((select id from public.game_table where name = 'Table 1'
                                                     and venue_id = '00000000-0000-4000-8000-000000000002'), gen_random_uuid()) $$,
  '22023', null, 'nor does a table at another venue');

-- The practice venue keeps its own lists.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.add_to_waitlist((select id from public.game_table where name = 'Table 1'
                                                   and venue_id = '00000000-0000-4000-8000-000000000002'), '9000000301', gen_random_uuid()) $$,
  'RVKYC', null, 'the floor adds a practice member to a practice list only once they finish the check');
select is_empty($$ select * from public.waitlist_board('00000000-0000-4000-8000-000000000002') b
                   where b.member_id in (select m.id from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'and the practice venue''s board holds none of the club''s places');

-- Tier-gated: joining needs waitlist.join; seeing the floor needs floor.live_view.
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'waitlist.join', false, 'Test'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'floor.live_view', false, 'Test');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Private Room'), gen_random_uuid()) $$,
  '42501', null, 'a member without waitlist.join joins nothing from the app');
select is_empty($$ select * from public.waitlist_lengths() $$, 'nor, without floor.live_view, sees how many wait');
select is_empty($$ select * from public.table_type $$, 'nor the games');
select is_empty($$ select * from public.game_table $$, 'nor the tables');

-- While the venue is frozen nobody joins and the floor removes nobody, but a member may still leave.
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Private Room'), gen_random_uuid()) $$,
  'RVFRZ', null, 'nobody joins while the venue is frozen');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, 'RVFRZ', null, 'the floor removes nobody');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select lives_ok($$ select public.leave_waitlist((select entry_id from public.my_waitlist() limit 1)) $$,
  'but a member gives up their own place');
reset role;

select * from finish();
rollback;
