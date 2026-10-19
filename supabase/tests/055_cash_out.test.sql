-- Cash-out (#75; design prompt flow 8). Neel Bose (217) has finished his identity check and been in
-- three times (seed); here he gets ₹1,00,000 of credit, sits at Table 2 (which checks him in) and signs
-- two markers, ₹50,000 then ₹20,000. 104 is a cashier; 103 a floor manager; 106 a dealer; Rohan (204)
-- has no finished check; Kunal (216) has finished it but is not in the room.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.balance(p_code text, p_member uuid) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is not distinct from p_member;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000217', 10000000, 'A regular'), 'active', 'Neel has ₹1,00,000 of credit');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 7, '9000000217'),
  null, 'and sits at Table 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'older', public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 5000000, 'M10 40 L 60 20', gen_random_uuid());
reset role;
update public.marker set issued_at = issued_at - interval '2 hours', due_at = due_at - interval '2 hours' where id = (select id from ids where name = 'older');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'newer', public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 2000000, 'M10 40 L 60 20', gen_random_uuid());
reset role;
create temp table before as select pg_temp.balance('venue.chips_outstanding', null) as chips, pg_temp.balance('venue.cash_drawer', null) as drawer;
grant select on before to authenticated;

-- Less than the older marker: ₹30,000 settles part of it, nothing to Neel.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'part', o.cage_transaction_id from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 3000000, 'cash', '00000000-0000-4000-8000-0000000c7501') o;
reset role;
select results_eq($$ select outstanding_paise, settled_at is null from public.marker where id in ((select id from ids where name = 'older'), (select id from ids where name = 'newer')) order by issued_at $$,
  $$ values (2000000::bigint, true), (2000000::bigint, true) $$, '₹30,000 settles part of the ₹50,000 marker first; the ₹20,000 waits');
select is(pg_temp.balance('venue.cash_drawer', null) - (select drawer from before), 0::bigint, 'and no cash leaves the drawer');

-- More than both markers settles them, oldest first, and the rest goes to his wallet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'full', o.cage_transaction_id from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 12000000, 'wallet', '00000000-0000-4000-8000-0000000c7502') o;
select results_eq($$ select cage_transaction_id, markers_settled_paise, to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 12000000, 'wallet', '00000000-0000-4000-8000-0000000c7502') $$,
  $$ select id, 4000000::bigint, 8000000::bigint from ids where name = 'full' $$, 'a retried tap cashes out once, and says what it came to');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 2000000, 'wallet',
  '00000000-0000-4000-8000-0000000c7502') $$, '22023', null, 'a request id is for one cash-out');
reset role;
select is_empty($$ select id from public.marker where member_id = '00000000-0000-4000-8000-000000000217' and settled_at is null $$,
  '₹1,20,000 settles the ₹20,000 left of the older and the ₹20,000 newer marker');
select is(pg_temp.balance('member.receivable', '00000000-0000-4000-8000-000000000217'), 0::bigint, 'he owes nothing');
select is(-pg_temp.balance('member.cash', '00000000-0000-4000-8000-000000000217'), 8000000::bigint, 'and ₹80,000 is in his wallet');
select is((select chips from before) - pg_temp.balance('venue.chips_outstanding', null), -15000000::bigint, '₹1,50,000 of chips came back');
select results_eq($$ select amount_paise from public.marker_settlement order by created_at, amount_paise desc $$,
  $$ values (3000000::bigint), (2000000::bigint), (2000000::bigint) $$, 'what each cash-out paid off each marker is kept');
select is((select count(*)::integer from public.outbox_event where event_type = 'marker.settled'), 2, 'marker.settled for each marker paid off, not the part');
select pg_temp.as_person('00000000-0000-4000-8000-000000000217');
select results_eq($$ select a.code, e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
                     where e.transaction_id = (select c.ledger_transaction_id from public.cage_transaction c where c.id = (select id from ids where name = 'full'))
                     order by a.code $$,
  $$ values ('member.cash'::text, -8000000::bigint), ('member.receivable', -4000000) $$, 'his movements show both lines: to his wallet, and his markers');
reset role;

-- No markers: all of it in cash from the drawer.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select markers_settled_paise, to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 1000000, 'cash', gen_random_uuid()) $$, $$ values (0::bigint, 1000000::bigint) $$, '₹10,000 in cash');
reset role;
select is((select drawer from before) - pg_temp.balance('venue.cash_drawer', null), 1000000::bigint, 'from the cash drawer');

-- Flow 8 in cash: ₹1,20,000 with a ₹50,000 marker open settles it and pays ₹70,000 from the drawer.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'flow8', public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 5000000, 'M10 40 L 60 20', gen_random_uuid());
reset role;
create temp table flow8 as select pg_temp.balance('venue.cash_drawer', null) as drawer, private.room_exposure('00000000-0000-4000-8000-000000000001') as exposure;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select markers_settled_paise, to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 12000000, 'cash', gen_random_uuid()) $$, $$ values (5000000::bigint, 7000000::bigint) $$,
  'flow 8: the marker first, ₹70,000 to hand over');
reset role;
select is((select drawer from flow8) - pg_temp.balance('venue.cash_drawer', null), 7000000::bigint, '₹70,000 from the drawer');
select is((select exposure from flow8) - private.room_exposure('00000000-0000-4000-8000-000000000001'), 5000000::bigint, 'and the room''s exposure drops by ₹50,000');

-- What is refused.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000020, 'cash', gen_random_uuid()) $$,
  'RVCHP', null, 'a cash-out is whole ₹50 chips');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'upi', gen_random_uuid()) $$,
  '22023', null, 'to cash or the wallet');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash', gen_random_uuid()) $$,
  'RVKYC', null, 'never without a finished identity check');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'cash', gen_random_uuid()) $$,
  'RVOUT', null, 'nor for a member not checked in, who has no chips to hand back');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 1000000, 'cash', gen_random_uuid()) $$,
  'RVNOM', null, 'nor for a member of another venue');
select is((select count(*)::integer from public.marker_settlement), 4, 'the cashier sees every settlement');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.marker_settlement), 4, 'and so does the floor manager who sets limits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash', gen_random_uuid()) $$,
  '42501', null, 'a dealer cashes no one out');
select is_empty($$ select id from public.marker_settlement $$, 'nor sees settlements');
select pg_temp.as_person('00000000-0000-4000-8000-000000000217');
select is((select count(*)::integer from public.marker_settlement), 4, 'Neel sees what his cash-outs settled');
select is((select count(*)::integer from public.cage_transaction where kind = 'cash_out'), 4, 'and his cash-outs');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select id from public.marker_settlement $$, 'Arjun sees none of them');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.marker_settlement $$, 'the practice venue''s cashier sees no club settlement');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash', gen_random_uuid()) $$,
  '42501', null, 'nor cashes out at the club');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Frozen: the member, then the venue.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000217', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash', gen_random_uuid()) $$,
  'RVMBR', null, 'a frozen member is not cashed out');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'cash', gen_random_uuid()) $$,
  'RVFRZ', null, 'and nobody while the venue is frozen');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'cage.cash_out'), 4, 'cage.cash_out for each');
select is((select count(*)::integer from public.outbox_event where event_type = 'marker.settled'), 3, 'and marker.settled for each marker paid off');

select * from finish();
rollback;
