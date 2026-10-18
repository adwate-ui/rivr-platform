-- The kill switch refuses writes inside the database, and the outbox never sends practice-venue
-- events anywhere. 101 Vikram and 102 Meera (super_admin), 201 Arjun (member).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select lives_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001') $$, 'writes are allowed normally');

-- Feature kill: withdrawals off, everything else on.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'withdrawals', 'Bank outage', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001', 'withdrawals') $$,
  'RVKIL', null, 'a killed feature refuses its writes');
select lives_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001', 'credit') $$,
  'other features keep working');

-- Member freeze: Arjun alone.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000201', 'Under review');
select throws_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000201') $$,
  'RVMBR', null, 'a frozen member cannot transact');
select lives_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000202') $$,
  'other members can');

-- Venue freeze: every write refused, the ledger included; the practice venue is unaffected.
insert into public.control_state (venue_id, level, reason)
values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Police inspection');
select throws_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000001') $$, 'RVFRZ', null, 'a frozen venue refuses writes');
select throws_ok(
  $$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'adjustment', 'freeze-test',
       jsonb_build_array(
         jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.cash_drawer'), 'amount', '5000'),
         jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.opening_balance'), 'amount', '-5000')), null) $$,
  'RVFRZ', null, 'the ledger refuses a post while the venue is frozen');
select lives_ok($$ select private.assert_writable('00000000-0000-4000-8000-000000000002') $$, 'the practice venue is unaffected');
select is((select is_frozen from public.public_venue_status where venue_id = '00000000-0000-4000-8000-000000000001'), true,
  'the website sees the club closed');
select throws_ok(
  $$ insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Again') $$,
  '23505', null, 'a level is engaged once at a time');

-- Members see that the venue is frozen, not why.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*) from public.control_state where level = 'venue_freeze')::int, 1, 'a member sees the venue freeze');
select throws_ok($$ select reason from public.control_state $$, '42501', null, 'a member cannot read why');
select is((select count(*) from public.control_state_detail)::int, 0, 'a member gets no control details');
reset role;

-- Release needs a reason and, for a venue freeze, two different super admins.
select throws_ok(
  $$ update public.control_state set released_at = now(),
       released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001'),
       release_reason = 'Done'
     where level = 'venue_freeze' $$,
  '23514', null, 'one super admin cannot release a venue freeze alone');
select lives_ok(
  $$ update public.control_state set released_at = now(),
       released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001'),
       release_second_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000102' and venue_id = '00000000-0000-4000-8000-000000000001'),
       release_reason = 'Inspection complete'
     where level = 'venue_freeze' $$,
  'two super admins release it');
select throws_ok($$ update public.control_state set reason = 'rewritten' where level = 'venue_freeze' $$,
  '42501', null, 'a released control cannot change');
select throws_ok($$ delete from public.control_state $$, '42501', null, 'controls are never deleted');

-- Access revoke: Sana (104, cashier) loses access at Gurugram at once, and keeps the practice venue.
insert into public.control_state (venue_id, level, staff_id, reason)
select '00000000-0000-4000-8000-000000000001', 'access_revoke', s.id, 'Left the club'
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select ok(not private.has_permission('00000000-0000-4000-8000-000000000001', 'cage.transact'),
  'a revoked cashier holds no permission at that venue');
select is((select count(*) from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000001')::int, 0,
  'and reads none of its ledger');
select ok(private.has_permission('00000000-0000-4000-8000-000000000002', 'cage.transact'),
  'the revoke is for one venue');
reset role;

-- Outbox: idempotent emit; practice-venue events never offered; messaging holds during a stop.
select is(private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{}', 'visit-1'),
          private.emit('00000000-0000-4000-8000-000000000001', 'visit.closed', '{}', 'visit-1'),
  'emitting the same event twice records it once');
select private.emit('00000000-0000-4000-8000-000000000002', 'visit.closed', '{}', 'practice-visit-1');
select results_eq(
  $$ select venue_id from public.claim_outbox_deliveries('feedback', array['visit.closed']) $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid) $$,
  'a consumer is offered the real venue''s event and never the practice venue''s'
);
insert into public.control_state (venue_id, level, reason)
values ('00000000-0000-4000-8000-000000000001', 'messaging_stop', 'Wrong template');
select is_empty($$ select * from public.claim_outbox_deliveries('whatsapp', array['visit.closed'], true) $$,
  'messaging consumers hold while a messaging stop is engaged');
select is_empty($$ select * from public.claim_outbox_deliveries('social', array['visit.closed']) $$,
  'a consumer that does not say it sends nothing to people holds too');
select isnt_empty($$ select * from public.claim_outbox_deliveries('tally', array['visit.closed'], false) $$,
  'other consumers carry on');
-- The tally consumer dies holding its delivery; once the lock expires it is offered again.
update public.outbox_delivery set locked_until = now() - interval '1 second' where consumer = 'tally';
select isnt_empty($$ select * from public.claim_outbox_deliveries('tally', array['visit.closed'], false) $$,
  'a delivery whose lock expired is claimed again');
-- It dies again on its tenth and last attempt: the next claim marks it failed, so the owner's
-- alert on failed deliveries sees it instead of it sitting in processing for good.
update public.outbox_delivery set attempts = 10, locked_until = now() - interval '1 second' where consumer = 'tally';
select is_empty($$ select * from public.claim_outbox_deliveries('tally', array['visit.closed'], false) $$,
  'a delivery out of attempts is not offered again');
select is((select status::text from public.outbox_delivery where consumer = 'tally'), 'failed',
  'and is marked failed');
select lives_ok(
  $$ select public.finish_outbox_delivery((select id from public.outbox_delivery where consumer = 'feedback'), true) $$,
  'a consumer marks its delivery done');
select is((select status::text from public.outbox_delivery where consumer = 'feedback'), 'delivered', 'and it stays done');

select * from finish();
rollback;
