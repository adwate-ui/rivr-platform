-- Bonus balances (#17). 211 Ishaan (identity check finished) is granted two bonuses, sits at Table 3
-- (NLH 100/200, buy-in ₹10,000) and buys chips with bonus, the grant ending sooner drawn first; what
-- is left expires at its end, reversed by the sweep. 201 Arjun's ₹4,000 is the seed's. 103 Aditya is
-- the floor; 104 a cashier (cage.transact); 106 Pema a dealer; 212 Vihaan another member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- An account's natural balance: what the member holds, or what the venue has spent.
create function pg_temp.held(p_code text, p_member uuid default null) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint * case when p_member is null then 1 else -1 end
  from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is not distinct from p_member;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create temp table opening as select pg_temp.held('venue.bonus_expense') as expense, pg_temp.held('venue.chips_outstanding') as chips;

-- The seed: Arjun's ₹4,000 is one grant, and what is left of it is what his bonus account holds
-- (a week after seeding the sweep has expired both).
select is((select amount_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000201'), 400000::bigint, 'Arjun''s ₹4,000 bonus is one grant');
select is((select remaining_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000201'),
  pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000201'), 'and what is left of it is what his bonus account holds');

-- Credit: once per request id, with an end and a reason; the server's alone.
insert into ids select 'later', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 800000,
  'Buy-in bonus Tuesday', now() + interval '2 days', 'test:bonus:later');
select is(private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 800000,
  'Buy-in bonus Tuesday', now() + interval '2 days', 'test:bonus:later'), (select id from ids where name = 'later'), 'a replay is the same grant');
select is((select count(*)::integer from public.ledger_transaction where idempotency_key = 'bonus:test:bonus:later'), 1, 'and posts nothing more');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 900000,
  'Buy-in bonus Tuesday', now() + interval '2 days', 'test:bonus:later') $$, '22023', null, 'a request id is for one bonus');
insert into ids select 'sooner', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 600000,
  'Referral', now() + interval '1 day', 'test:bonus:sooner');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000211'), 1400000::bigint, 'Ishaan holds ₹14,000 of bonus');
select is(pg_temp.held('venue.bonus_expense') - (select expense from opening), 1400000::bigint, 'spent from the venue''s bonus expense');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 0,
  'Referral', now() + interval '1 day', gen_random_uuid()::text) $$, '22023', null, 'a bonus is above nothing');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000,
  'Referral', now() - interval '1 second', gen_random_uuid()::text) $$, '22023', null, 'and ends later');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 100000,
  'Referral', now() + interval '1 day', gen_random_uuid()::text) $$, 'RVNOM', null, 'to a member of this venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000,
  'Referral', now() + interval '1 day', gen_random_uuid()::text) $$, '42501', null, 'no app credits bonus, not even an owner''s');
reset role;

-- Playable: a buy-in from bonus draws the grant ending sooner first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'bonus', '00000000-0000-4000-8000-0000000b0001'),
  null, 'a cashier issues ₹10,000 of chips from Ishaan''s bonus');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'bonus', gen_random_uuid()) $$,
  'RVBON', null, 'never more than the bonus in force');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 300000, 'bonus', gen_random_uuid()) $$,
  'RVMIN', null, 'nor below the table''s minimum');
reset role;
select results_eq($$ select remaining_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211' order by expires_at $$,
  $$ values (0::bigint), (400000::bigint) $$, 'the ₹6,000 ending tomorrow is used up first, then ₹4,000 of the ₹8,000');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000211'), 400000::bigint, 'Ishaan holds ₹4,000 of bonus');
select is((select chips from opening) - pg_temp.held('venue.chips_outstanding'), 1000000::bigint, 'and ₹10,000 of chips are out');
select is((select method from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000b0001'), 'bonus', 'the buy-in is recorded as bonus');

-- Not withdrawable: nothing but a buy-in and its end ever take bonus from a member.
select is_empty($$ select t.kind from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
                   join public.ledger_transaction t on t.id = e.transaction_id
                   where a.code = 'member.bonus' and e.amount > 0 and t.kind not in ('buy_in', 'bonus_expiry') $$,
  'no bonus leaves a member but as chips or at its end');
select throws_ok($$ select private.reverse_ledger_transaction((select ledger_transaction_id from public.bonus_grant where idempotency_key = 'test:bonus:later'),
  gen_random_uuid()::text, 'Mistake') $$, 'RVBON', null, 'a ledger reversal of a credit is refused: bonus moves only through its grants');
select throws_ok($$ select private.reverse_ledger_transaction((select ledger_transaction_id from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000b0001'),
  gen_random_uuid()::text, 'Mistake') $$, 'RVBON', null, 'and of a buy-in from bonus');

-- Who sees grants: the member his own, the cage and ledger staff the venue's, nobody else.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.bonus_grant), 2, 'Ishaan sees his two grants');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is_empty($$ select * from public.bonus_grant $$, 'another member sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.bonus_grant $$, 'nor does a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211'), 2, 'a cashier sees them');
select throws_ok($$ update public.bonus_grant set remaining_paise = amount_paise $$, '42501', null, 'and changes none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211'), 2, 'staff who read the ledger see them');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.bonus_grant $$, 'the practice venue''s cashier sees no club bonus');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Expiring: at its end a grant's remainder is reversed by the sweep, once.
select isnt_empty($$ select 1 from cron.job where jobname = 'bonus-expiry' and schedule = '* * * * *' $$, 'the sweep runs every minute');
update public.bonus_grant set expires_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000211', now()), 0::bigint, 'at their end Ishaan''s grants are no longer in force');
select lives_ok($$ select private.expire_bonus() $$, 'the sweep runs');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000211'), 0::bigint, 'the ₹4,000 left has expired');
select is(pg_temp.held('venue.bonus_expense') - (select expense from opening), 1000000::bigint, 'back to the venue: ₹10,000 of bonus was played');
select results_eq(
  $$ select g.remaining_paise, g.expired_at is not null, t.kind, (select sum(e.amount) from public.ledger_entry e where e.transaction_id = t.id and e.amount > 0)
     from public.bonus_grant g left join public.ledger_transaction t on t.id = g.expiry_transaction_id
     where g.member_id = '00000000-0000-4000-8000-000000000211' order by g.amount_paise $$,
  $$ values (0::bigint, true, null::text, null::numeric), (0::bigint, true, 'bonus_expiry'::text, 400000::numeric) $$,
  'both grants are closed; the ₹4,000 left of one is reversed by the entry recorded on it');
select lives_ok($$ select private.expire_bonus() $$, 'the sweep runs again');
select is((select count(*)::integer from public.ledger_transaction where kind = 'bonus_expiry'
           and idempotency_key in (select 'bonus_expiry:' || id from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211')), 1,
  'and reverses nothing twice');

-- A frozen member's grant waits for the release; other grants expire meanwhile.
insert into ids select 'frozen', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 200000,
  'Referral', now() + interval '1 day', 'test:bonus:frozen');
update public.bonus_grant set expires_at = now() where id in ((select id from ids where name = 'frozen'));
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000212', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
update public.bonus_grant set expires_at = now() where member_id = '00000000-0000-4000-8000-000000000201';
select lives_ok($$ select private.expire_bonus() $$, 'the sweep runs with a member frozen');
select is((select expired_at from public.bonus_grant where id = (select id from ids where name = 'frozen')), null, 'Vihaan''s grant waits');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000201'), 0::bigint, 'Arjun''s expires');

-- Promotions switched off: no bonus is credited.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000,
  'Referral', now() + interval '1 day', gen_random_uuid()::text) $$, 'RVKIL', null, 'no bonus while promotions are switched off');

select * from finish();
rollback;
