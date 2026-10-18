-- Profile preferences (#7): members save their own games, stake and push choices; nobody reads
-- another member's; the push sender asks private.wants_push. 201 Arjun, 202 Kabir (members),
-- 108 Karan (host).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select lives_ok($$ select public.save_my_preferences(array['nlh', 'tournaments'], 10000, 20000) $$, 'a member saves games and a stake');
select results_eq($$ select games, small_blind, big_blind from public.member_preference $$,
  $$ values (array['nlh', 'tournaments'], 10000::bigint, 20000::bigint) $$, 'and sees them');
select lives_ok($$ select public.save_my_preferences(array['plo'], null, null) $$, 'saving again replaces them');
select results_eq($$ select games, small_blind from public.member_preference $$, $$ values (array['plo'], null::bigint) $$,
  'with no stake chosen');
select throws_ok($$ select public.save_my_preferences(array['bingo'], null, null) $$, '23514', null, 'only the club''s games');
select lives_ok($$ select public.save_my_preferences(array['nlh', 'nlh', 'plo', 'nlh'], null, null) $$, 'repeated games');
select is((select cardinality(games) from public.member_preference), 2, 'are kept once each');
select throws_ok($$ select public.save_my_preferences(array['nlh'], 10000, 200000000) $$, '23514', null, 'a stake has a ceiling');
select throws_ok($$ update public.member_preference set games = '{}' $$, '42501', null, 'a member cannot change a row directly');
select throws_ok($$ delete from public.notification_preference $$, '42501', null, 'nor delete one');
select ok(not public.has_my_consent('marketing'), 'a member reads their own marketing consent');
select throws_ok($$ select public.save_my_preferences(array['nlh'], 10000, null) $$, '23514', null, 'a stake has both blinds');
select throws_ok($$ select public.save_my_preferences(array['nlh'], 20000, 10000) $$, '23514', null, 'the big blind is the bigger');
select lives_ok($$ select public.set_my_notification('push.seat_ready', false) $$, 'a member turns seat calls off');
select results_eq($$ select push_type, is_on from public.notification_preference $$, $$ values ('push.seat_ready', false) $$,
  'and sees that');
select throws_ok($$ select public.set_my_notification('push.promotion_published', false) $$, '23514', null,
  'promotions are a consent, not a notification choice');
select throws_ok($$ select public.set_my_notification('balance.withdraw', false) $$, '42501', null, 'only push notifications');
select throws_ok($$ insert into public.member_preference (member_id, venue_id) values
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'a member cannot write a row directly');
select throws_ok($$ select private.wants_push('00000000-0000-4000-8000-000000000201', 'push.seat_ready') $$, '42501', null,
  'nor ask the push sender''s question');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000202", "role": "authenticated"}';
select is((select count(*)::int from public.member_preference), 0, 'another member sees none of it');
select is((select count(*)::int from public.notification_preference), 0, 'nor their notification choices');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000301", "role": "authenticated"}';
select is((select count(*)::int from public.member_preference) + (select count(*)::int from public.notification_preference), 0,
  'nor does a member of another venue');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000108", "role": "authenticated"}';
select throws_ok($$ select public.save_my_preferences(array['nlh'], null, null) $$, '42501', null, 'staff have no member preferences');
reset role;

set local role anon;
select throws_ok($$ select public.save_my_preferences(array['nlh'], null, null) $$, '42501', null, 'the public has no preferences');
reset role;

-- The push sender's question.
select ok(not private.wants_push('00000000-0000-4000-8000-000000000201', 'push.seat_ready'), 'seat calls off when turned off');
select ok(private.wants_push('00000000-0000-4000-8000-000000000201', 'push.tournament_starting'), 'on by default');
select ok(not private.wants_push('00000000-0000-4000-8000-000000000201', 'push.promotion_published'), 'promotions only with consent');
insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'marketing');
select ok(private.wants_push('00000000-0000-4000-8000-000000000201', 'push.promotion_published'), 'and with it');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'push.tournament_starting', false, 'Test');
select ok(not private.wants_push('00000000-0000-4000-8000-000000000201', 'push.tournament_starting'),
  'never a push the member''s tier does not have, whatever they chose');
select ok(not private.wants_push('00000000-0000-4000-8000-000000000201', 'push.no_such_thing'), 'nor an unknown one');

-- A freeze stops money, seats and hands, never a member's say over their own notifications.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000201', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select lives_ok($$ select public.set_my_notification('push.seat_ready', true) $$, 'a frozen member still chooses their notifications');
select throws_ok($$ select public.set_my_notification('push.tournament_starting', false) $$, '42501', null,
  'but never one their tier does not have');
reset role;

select * from finish();
rollback;
