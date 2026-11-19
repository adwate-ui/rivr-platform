-- A seating's Bonus buy-in is redeemed once (#914): a second call for the same seating redeems nothing more, and the ledger
-- transaction is keyed on the seat and when he sat down at the table (a table change is a seating of its own: 408). 211
-- Ishaan is a member; 103 Aditya the floor.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.chips() returns bigint language sql as $$
  select private.bonus_in_force('00000000-0000-4000-8000-000000000211', now()) / 100;
$$;
create temp table before on commit drop as select pg_temp.chips() as chips;

select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 150000, 'Welcome back', null, 'test:543');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'),
                     2, p_member_number => (select member_number from public.member where id = '00000000-0000-4000-8000-000000000211'),
                     p_bonus_chips => 1000) $$, 'the floor seats Ishaan, redeeming 1,000 Bonus chips');
reset role;
create temp table seat on commit drop as
  select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
grant select on seat to authenticated;

select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated')::text, true);
select lives_ok($$ select private.redeem_bonus_at_seat((select id from seat), 1000) $$, 'the same redemption again, for the same seating');
select set_config('request.jwt.claims', '', true);
select is(pg_temp.chips() - (select chips from before), 500::bigint, 'draws his Bonus once: 500 of the 1,500 left');
select results_eq($$ select count(*)::integer, min(x.idempotency_key) from public.bonus_redemption r
                     join public.ledger_transaction x on x.id = r.ledger_transaction_id where r.session_id = (select id from seat) $$,
  $$ select 1, 'bonus_buy_in:' || s.id || ':' || s.seat || ':' || extract(epoch from s.seated_here_at) from public.seat_session s where s.id = (select id from seat) $$,
  'one redemption for the seating, its transaction keyed on the seat and when he sat down');

-- Moved to seat 3 at the same table, which keeps when he sat down, with 200 more: a seating of its own, so it redeems.
update public.seat_session set seat = 3 where id = (select id from seat);
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated')::text, true);
select lives_ok($$ select private.redeem_bonus_at_seat((select id from seat), 200) $$, '200 more at another seat of the same table');
select set_config('request.jwt.claims', '', true);
select is(pg_temp.chips() - (select chips from before), 300::bigint, 'drawn: 300 left');

select * from finish();
rollback;
