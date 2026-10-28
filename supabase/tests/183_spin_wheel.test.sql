-- The spin wheel (#150; decision 0266): Aditya (103, an admin: the floor and promotions) keeps the wheel and spins it
-- for Yash (214) and Mihir (213), each given spins by Spin the wheel. A points prize posts points; with a spin budget, a
-- bonus prize posts bonus until the month's budget is spent. Sana (104, a cashier) does none of it. A TV showing the
-- spin wheel reads the prizes and tonight's spins, and is told of each spin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Another club, whose wheel nobody here sees.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-spin', false, 'RIVR test', 'Test', 'TST');
insert into public.spin_wheel (venue_id, kind, amount, weight) values ('00000000-0000-4000-8000-0000000000aa', 'points', 500, 1);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.signals(p_event text) returns integer language sql security definer as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'tv:00000000-0000-4000-8000-000000000001' and m.event = p_event and m.inserted_at >= now();
$$;
grant execute on function pg_temp.signals(text) to authenticated;
-- A member's points, as the Rewards tab reads them.
create function pg_temp.points(p_member uuid) returns bigint language sql security definer as $$
  select coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points'), 0)::bigint;
$$;
grant execute on function pg_temp.points(uuid) to authenticated;

-- A spin from Spin the wheel, as the engine gives one for four hours at the tables.
create function pg_temp.give_spin(p_member uuid, p_key text) returns uuid language sql as $$
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day)
  select p.venue_id, p.id, r.id, p_member, r.trigger, r.effect, 0, 0, p_key, current_date
  from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'spin_wheel'
  returning id;
$$;
create temporary table grants on commit drop as
select pg_temp.give_spin('00000000-0000-4000-8000-000000000214', 'test:183:1') as yash,
       pg_temp.give_spin('00000000-0000-4000-8000-000000000213', 'test:183:2') as mihir,
       pg_temp.give_spin('00000000-0000-4000-8000-000000000214', 'test:183:3') as yash_again,
       pg_temp.points('00000000-0000-4000-8000-000000000214') as yash_points;
grant select on grants to authenticated;

-- The wheel starts empty, whatever an earlier flow left on it.
update public.spin_wheel set removed_at = now() where removed_at is null;

-- A TV at the club showing the spin wheel.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e183', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001831');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d183', '00000000-0000-4000-8000-000000000001', 'tv', 'Wheel TV', '00000000-0000-4000-8000-00000000e183');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d183', '00000000-0000-4000-8000-000000000001', 'spin_wheel');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'points', 100, 1) $$, '42501', null, 'a cashier adds no prize');
select throws_ok($$ select * from public.waiting_spins('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'sees no spins waiting');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash from grants)) $$, '42501', null,
  'and spins nothing');
select throws_ok($$ select * from public.spin_prizes('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor reads the wheel');
select is_empty($$ select * from public.spin_wheel $$, 'whose table shows a cashier nothing');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select set_eq(
  $$ select grant_id, member_name, promotion_name from public.waiting_spins('00000000-0000-4000-8000-000000000001')
     where grant_id in (select yash from grants union all select mihir from grants union all select yash_again from grants) $$,
  $$ select yash, 'Yash Gupta'::text as member_name, 'Spin the wheel'::text as promotion_name from grants union all select mihir, 'Mihir Shah', 'Spin the wheel' from grants
     union all select yash_again, 'Yash Gupta', 'Spin the wheel' from grants $$,
  'the floor sees each spin waiting, with the member and the promotion');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash from grants)) $$, 'RVSPN', null,
  'an empty wheel does not spin');
select throws_ok($$ select public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'bonus', 12345, 1) $$, '22023', null,
  'a bonus is whole ₹50 chips');
select throws_ok($$ select public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'points', 100, 0) $$, '22023', null,
  'and a weight is at least 1');
select isnt(public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'points', 100, 1), null, 'Aditya puts 100 points on the wheel');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash from grants)) $$,
  $$ values ('points'::text, 100::bigint) $$, 'Yash spins and wins 100 points');
select is(pg_temp.points('00000000-0000-4000-8000-000000000214') - (select yash_points from grants), 100::bigint, 'which are his to redeem');
select isnt((select fulfilled_at from public.promotion_grant where id = (select yash from grants)), null, 'and his spin is used');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash from grants)) $$, 'P0002', null,
  'a spin is spun once');
select is((select count(*)::integer from public.spin where grant_id = (select yash from grants)), 1, 'the floor sees the spin');
select is_empty($$ select * from public.spin_wheel where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'and no other club''s wheel');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.spin $$, 'a cashier sees no spins');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount, weight, is_drawable from public.spin_prizes('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('points'::text, 100::bigint, 1, true) $$, 'the floor reads the wheel, and what can be drawn');
select ok(pg_temp.signals('spin_wheel') > 0, 'the TVs are told of the spin');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e183');
select results_eq($$ select row_kind, place, prize_kind, amount, weight, display_name from public.tv_spin_wheel() $$,
  $$ values ('prize'::text, 1, 'points'::text, 100::bigint, 1, null::text), ('spin', null, 'points', 100, null, 'Yash G.') $$,
  'the TV shows the wheel and tonight''s spin, by first name and initial');

-- Bonus only, and no budget set: no spin.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.remove_spin_prize('00000000-0000-4000-8000-000000000001', (select id from public.spin_wheel where kind = 'points')) $$,
  'Aditya takes the points off the wheel');
select throws_ok($$ select public.remove_spin_prize('00000000-0000-4000-8000-000000000001', (select id from public.spin_wheel where kind = 'points')) $$,
  'P0002', null, 'a prize comes off once');
select isnt(public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'bonus', 50000, 1), null, 'and puts a ₹500 bonus on');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select mihir from grants)) $$, 'RVSPN', null,
  'with no spin budget set, a bonus is off the wheel');
select results_eq($$ select kind, is_drawable from public.spin_prizes('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('bonus'::text, false) $$, 'and the floor sees it cannot be drawn');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e183');
select is_empty($$ select * from public.tv_spin_wheel() where row_kind = 'prize' $$, 'the TV shows no prize that cannot be won');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');

-- A ₹500 budget this month: Mihir wins the bonus, and then it is spent.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'spin.budget', '', '{"monthly_paise": 50000}', now(), 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select mihir from grants)) $$,
  $$ values ('bonus'::text, 50000::bigint) $$, 'with a ₹500 budget Mihir wins the ₹500 bonus');
select results_eq($$ select s.bonus_grant_id, g.bonus_grant_id, b.amount_paise from public.spin s join public.promotion_grant g on g.id = s.grant_id
                     join public.bonus_grant b on b.id = s.bonus_grant_id where s.grant_id = (select mihir from grants) $$,
  $$ select s.bonus_grant_id, s.bonus_grant_id, 50000::bigint from public.spin s where s.grant_id = (select mihir from grants) $$,
  'posted as his bonus, and named on his grant');
select is((select cost_paise from public.promotion_grant where id = (select mihir from grants)), 50000::bigint,
  'and its cost, so the promotion''s budget counts it');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash_again from grants)) $$, 'RVSPN', null,
  'and once the month''s budget is spent the bonus is off the wheel');

-- With promotions switched off, the wheel neither spins nor changes.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'points', 100, 1) $$, 'RVKIL', null,
  'a prize is not added while promotions are off');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash_again from grants)) $$, 'RVKIL', null,
  'nor a spin spun');

select * from finish();
rollback;
