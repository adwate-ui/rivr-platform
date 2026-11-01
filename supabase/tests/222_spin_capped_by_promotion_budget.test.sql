-- A spin's bonus within its promotion's budget (audit of 28 Oct, A2-03). Spin the wheel has a ₹1,000 budget, the wheel
-- one ₹1,000 bonus, and the month's spin budget is far above. Yash's spin wins the bonus, which spends the promotion's
-- budget; Mihir's spin after it can draw no bonus, however much spin budget is left, so it wins points once points are
-- on the wheel. A monthly budget counts only its month's grants. Aditya (103, an admin) spins.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A spin from Spin the wheel, as the engine gives one (as in 183).
create function pg_temp.give_spin(p_member uuid, p_key text) returns uuid language sql as $$
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day)
  select p.venue_id, p.id, r.id, p_member, r.trigger, r.effect, 0, 0, p_key, current_date
  from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'spin_wheel'
  returning id;
$$;
create temporary table grants on commit drop as
select pg_temp.give_spin('00000000-0000-4000-8000-000000000214', 'test:222:1') as yash,
       pg_temp.give_spin('00000000-0000-4000-8000-000000000213', 'test:222:2') as mihir,
       pg_temp.give_spin('00000000-0000-4000-8000-000000000213', 'test:222:3') as mihir_again,
       pg_temp.give_spin('00000000-0000-4000-8000-000000000214', 'test:222:4') as yash_again,
       (select id from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = 'spin_wheel') as promotion;
grant select on grants to authenticated;

-- The budgets and the wheel, as the system sets them.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'spin.budget', '', '{"monthly_paise": 10000000}', now(), 'Test');
delete from public.promotion_budget where promotion_id = (select promotion from grants);
insert into public.promotion_budget (venue_id, promotion_id, cap_paise, period)
values ('00000000-0000-4000-8000-000000000001', (select promotion from grants), 100000, 'promotion');
update public.spin_wheel set removed_at = now() where removed_at is null;
insert into public.spin_wheel (venue_id, kind, amount, weight) values ('00000000-0000-4000-8000-000000000001', 'bonus', 100000, 1);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash from grants)) $$,
  $$ values ('bonus'::text, 100000::bigint) $$, 'Yash wins the ₹1,000 bonus, which the promotion''s budget allows');
select throws_ok($$ select * from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select mihir from grants)) $$, 'RVSPN', null,
  'with the promotion''s budget spent, a spin draws no bonus, though the month''s spin budget has plenty left');
select isnt(public.add_spin_prize('00000000-0000-4000-8000-000000000001', 'points', 500, 1), null, 'points go on the wheel');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select mihir from grants)) $$,
  $$ values ('points'::text, 500::bigint) $$, 'so Mihir''s spin wins points, the one prize it can');
select is((select sum(cost_paise)::bigint from public.promotion_grant where id in (select yash from grants union all select mihir from grants)),
  100000::bigint, 'and the promotion has cost its budget, no more');

-- A monthly budget: Yash's bonus was last month's, so this month has the whole budget again.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
update public.promotion_budget set period = 'month' where promotion_id = (select promotion from grants);
update public.promotion_grant set club_day = (club_day - interval '1 month')::date where id = (select yash from grants);
update public.spin_wheel set removed_at = now() where removed_at is null and kind = 'points';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select mihir_again from grants)) $$,
  $$ values ('bonus'::text, 100000::bigint) $$, 'a monthly budget counts only this month''s grants');

-- With no budget, the month's spin budget alone limits the bonus, as before.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
delete from public.promotion_budget where promotion_id = (select promotion from grants);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount from public.spin_the_wheel('00000000-0000-4000-8000-000000000001', (select yash_again from grants)) $$,
  $$ values ('bonus'::text, 100000::bigint) $$, 'a promotion with no budget of its own is limited by the spin budget alone');

select * from finish();
rollback;
