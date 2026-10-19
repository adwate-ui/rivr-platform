-- The waitlist (#38). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200 in that order;
-- 50/100 is empty. 201 Arjun and 209 Tara are members; 103 Aditya is the floor (waitlist.manage);
-- 106 Pema is a dealer and 109 the investor (owner_view); 301 is a member of the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.type_id(text) to authenticated;

-- Arjun and Naina have finished their identity check; Tara has not.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'verified', 'digilocker', '1985-05-05', 'ABCPA1111A',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'verified', 'digilocker', '1990-04-12', 'ABCPN1234D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg', now());

-- A member joins from the app.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), '00000000-0000-4000-8000-00000000aa01'), null,
  'a member with a finished identity check joins 100/200 from the app');
select is(public.join_waitlist(pg_temp.type_id('nlh_100_200'), '00000000-0000-4000-8000-00000000aa01'),
          (select entry_id from public.my_waitlist()), 'a retried join adds them once');
select is(public.join_waitlist(pg_temp.type_id('nlh_100_200'), '00000000-0000-4000-8000-00000000aa02'),
          (select entry_id from public.my_waitlist()), 'and joining again keeps their one place');
select results_eq($$ select table_type_name, small_blind_paise, big_blind_paise, place from public.my_waitlist() $$,
  $$ values ('NLH 100/200'::text, 10000::bigint, 20000::bigint, 4) $$, 'they see their place, fourth, after the three already waiting');
select results_eq($$ select t.code, l.waiting from public.waitlist_lengths() l join public.table_type t on t.id = l.table_type_id order by t.code $$,
  $$ values ('nlh_100_200'::text, 4), ('nlh_50_100', 0), ('private_room', 0) $$, 'and how many wait on each list, never who');
select is((select count(*)::integer from public.waitlist_entry), 1, 'a member sees only their own place');

-- Refusals.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_50_100'), '00000000-0000-4000-8000-00000000aa03') $$,
  'RVKYC', null, 'not without a finished identity check');
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000209', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_50_100'), '00000000-0000-4000-8000-00000000aa04') $$,
  'RVMBR', null, 'nor while the member is frozen');
reset role;

-- The floor.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select isnt(public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '90000 00203', '00000000-0000-4000-8000-00000000aa05'), null,
  'the floor adds a member by their mobile number');
select throws_ok($$ select public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '9999999999', '00000000-0000-4000-8000-00000000aa06') $$,
  'RVNOM', null, 'and says when no member has the number');
select results_eq(
  $$ select t.code, b.full_name, b.place, b.added_by_floor from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
     join public.table_type t on t.id = b.table_type_id order by t.code, b.place $$,
  $$ values ('nlh_100_200'::text, 'Kabir Sethi'::text, 1, false), ('nlh_100_200', 'Naina Kapoor', 2, false),
            ('nlh_100_200', 'Rohan Bhatia', 3, false), ('nlh_100_200', 'Arjun Mehta', 4, false),
            ('nlh_50_100', 'Naina Kapoor', 1, true) $$,
  'the floor sees each list in order, with names, and who the floor added');
select lives_ok($$ select public.leave_waitlist((select e.id from public.waitlist_entry e
                    where e.member_id = '00000000-0000-4000-8000-000000000202' and e.status = 'waiting')) $$,
  'the floor takes a member off a list');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select throws_ok($$ select public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '9000000201', '00000000-0000-4000-8000-00000000aa07') $$,
  '42501', null, 'a dealer adds nobody');
select is_empty($$ select * from public.waitlist_board('00000000-0000-4000-8000-000000000001') $$, 'and sees no board');

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

-- A request id replays only its own place, and a member joins only their own venue's games.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_100_200'), '00000000-0000-4000-8000-000000000203') $$,
  '22023', null, 'another member''s request id joins nobody');
select throws_ok($$ select public.join_waitlist((select id from public.table_type where code = 'nlh_50_100'
                                                  and venue_id = '00000000-0000-4000-8000-000000000002'), gen_random_uuid()) $$,
  '22023', null, 'nor does a game at another venue');

-- The practice venue keeps its own lists.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.add_to_waitlist((select id from public.table_type where code = 'nlh_50_100'
                                                   and venue_id = '00000000-0000-4000-8000-000000000002'), '9000000301', gen_random_uuid()) $$,
  'RVKYC', null, 'the floor adds a practice member to a practice list only once they finish the check');
select is_empty($$ select * from public.waitlist_board('00000000-0000-4000-8000-000000000002') $$,
  'and the practice venue''s board holds none of the club''s places');

-- Tier-gated: joining needs waitlist.join; seeing the floor needs floor.live_view.
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'waitlist.join', false, 'Test'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'floor.live_view', false, 'Test');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('private_room'), gen_random_uuid()) $$,
  '42501', null, 'a member without waitlist.join joins nothing from the app');
select is_empty($$ select * from public.waitlist_lengths() $$, 'nor, without floor.live_view, sees how many wait');
select is_empty($$ select * from public.table_type $$, 'nor the games');
select is_empty($$ select * from public.game_table $$, 'nor the tables');

-- While the venue is frozen nobody joins and the floor removes nobody, but a member may still leave.
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('private_room'), gen_random_uuid()) $$,
  'RVFRZ', null, 'nobody joins while the venue is frozen');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select public.leave_waitlist((select id from rohans_place)) $$, 'RVFRZ', null, 'the floor removes nobody');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select lives_ok($$ select public.leave_waitlist((select entry_id from public.my_waitlist() limit 1)) $$,
  'but a member gives up their own place');
reset role;

select * from finish();
rollback;
