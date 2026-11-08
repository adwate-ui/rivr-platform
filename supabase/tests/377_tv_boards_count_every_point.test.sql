-- The TV boards (audit 8 Nov, F-043, F-044, F-136): the points leaders count every point credited this League month, not points
-- spent or points from before it; five redemptions show; a device set to the tournament clock, as the stream overlay is, reads no
-- waitlist names. 213 Mihir and 214 Yash are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e377', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000003771');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d377', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e377');
insert into public.tv_screen (device_id, venue_id, mode, rotation) values
  ('00000000-0000-4000-8000-00000000d377', '00000000-0000-4000-8000-000000000001', 'tournament_clock', array['rewards']::public.tv_mode[]);

-- A credit dated before this League month began, which must not count.
create function pg_temp.credit_before_this_month(p_member uuid, p_points bigint) returns void language plpgsql as $$
declare
  v_transaction uuid;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values ('00000000-0000-4000-8000-000000000001', 'points_earned', 'test:377:' || gen_random_uuid(), (private.league_month(now()) + interval '6 hours') at time zone 'Asia/Kolkata' - interval '1 hour', 'Test last month')
  returning id into v_transaction;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', v_transaction, a.id, case when a.code = 'member.points' then -p_points else p_points end
  from public.ledger_account a
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and ((a.member_id = p_member and a.code = 'member.points') or (a.member_id is null and a.code = 'venue.points_issued'));
end;
$$;
select pg_temp.credit_before_this_month('00000000-0000-4000-8000-000000000213', 5000000);

-- Mihir: given by hand and from a promotion. Spending takes nothing off what he earned this month. Yash: released from locked.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 900000, 'Test by hand', 'test:377:hand');
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 100000, 'Test promotion', 'test:377:promotion');
select private.debit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 400000, 'Test spent', 'test:377:spent');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000214', 500000, true, 'Test locked', gen_random_uuid()), null, 'Yash is given points locked');
select lives_ok($$ select public.unlock_points('00000000-0000-4000-8000-000000000214', 500000, 'Test released', gen_random_uuid()) $$, 'and has them released');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e377');
select results_eq($$ select display_name, points from public.tv_rewards_ticker() where kind = 'leader' and points >= 500000 order by place $$,
  $$ values ('Mihir S.'::text, 1000000::bigint), ('Yash G.', 500000) $$, 'every point credited this month counts, none from before it, and none spent is taken off');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'a device on the tournament clock reads no waitlist names');

-- Six redeemed this week: the board holds five.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.redeem_reward('00000000-0000-4000-8000-000000145002', 2500, 'test-377-' || n) from generate_series(1, 6) n $$, 'Mihir redeems six');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e377');
select is((select count(*)::integer from public.tv_rewards_ticker() where kind = 'redemption'), 5, 'the ticker shows five');

select * from finish();
rollback;
