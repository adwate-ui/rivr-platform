-- Up to N times a member and a budget each month (owner, 3 Nov; decision 0499). The terms' check takes them; the engine
-- gives a member up to N in a period, each keyed as theirs (the unique key holds the Nth); a monthly budget counts its
-- own month and approving one writes the wheel's monthly cap; and the old rules with either are now versions, their
-- grants numbered in their periods. The twins are proved on the golden file (024_golden_twins).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts: only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.terms_ok(p_limits jsonb) returns boolean language sql as $$
  select private.is_promotion_terms('{"kind": "buyin_bonus", "mode": "percent", "percent": 20}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', p_limits,
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;
select ok(pg_temp.terms_ok('{"perMember": "per_day", "timesPerMember": 2}') and pg_temp.terms_ok('{"perMember": "once", "timesPerMember": 20}'),
  'up to 2 a day, or 20 ever, are terms');
select ok(not pg_temp.terms_ok('{"perMember": "none", "timesPerMember": 2}'), 'but not up to N with no period');
select ok(not pg_temp.terms_ok('{"perMember": "per_day", "timesPerMember": 21}') and not pg_temp.terms_ok('{"perMember": "per_day", "timesPerMember": 1}'),
  'nor fewer than 2 or more than 20');
select ok(pg_temp.terms_ok('{"perMember": "none", "budgetChips": 10000, "budgetPeriod": "month"}')
          and pg_temp.terms_ok('{"perMember": "none", "maxGrants": 10, "budgetPeriod": "month"}'), 'a budget or most grants each month are');
select ok(not pg_temp.terms_ok('{"perMember": "none", "budgetPeriod": "month"}'), 'but not a month with nothing to count');

-- A version live from yesterday, every day all day, for everyone at every stake.
create function pg_temp.live(p_name text, p_reward jsonb, p_limits jsonb) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', p_name, p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          p_limits, '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
create function pg_temp.buy_in(p_member text, p_key text, p_chips bigint default 10000) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'buy_in:' || p_key, 'amount_paise', p_chips * 100,
                       'method', 'cash', 'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3')));
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;

-- Up to twice a day: the second grant is keyed #2, and a third is not given.
insert into ids select 'twice', pg_temp.live('Twice a day', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}', '{"perMember": "per_day", "timesPerMember": 2}');
select is(pg_temp.buy_in('211', 't-1') + pg_temp.buy_in('211', 't-2') + pg_temp.buy_in('211', 't-3'), 2, 'a member has it twice a day, and not a third time');
select results_eq($$ select period_key from public.promotion_grant where promotion_id = (select id from ids where name = 'twice') order by created_at, period_key $$,
  $$ values ('day:' || to_char(private.club_day_of(now()), 'YYYY-MM-DD')), ('day:' || to_char(private.club_day_of(now()), 'YYYY-MM-DD') || '#2') $$,
  'the first keyed by the day, the second as the member''s second that day');
select is(pg_temp.buy_in('212', 't-4'), 1, 'another member has it too');
select throws_ok($$ insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, points,
                                                          source_key, period_key, club_day)
                    select '00000000-0000-4000-8000-000000000001', v.promotion_id, v.id, '00000000-0000-4000-8000-000000000211', 'buy_in', '{}', 0, 0,
                           'buy_in:race', 'day:' || to_char(private.club_day_of(now()), 'YYYY-MM-DD') || '#2', private.club_day_of(now())
                    from public.promotion_version v where v.promotion_id = (select id from ids where name = 'twice') $$,
  '23505', null, 'a racing second grant on the same key is refused by the unique key');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'twice');

-- A monthly budget of 1,000 chips: last month's 1,000 do not count; this month's 1,000 do.
insert into ids select 'monthly', pg_temp.live('Monthly', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}',
  '{"perMember": "none", "budgetChips": 1000, "budgetPeriod": "month"}');
insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, points, chips, source_key,
                                    period_key, club_day)
select '00000000-0000-4000-8000-000000000001', v.promotion_id, v.id, '00000000-0000-4000-8000-000000000213', 'buy_in', '{}', 100000, 0, 1000,
       'buy_in:last-month', 'event:buy_in:last-month', (date_trunc('month', private.club_day_of(now())) - interval '1 day')::date
from public.promotion_version v where v.promotion_id = (select id from ids where name = 'monthly');
select is(pg_temp.buy_in('213', 'm-1') + pg_temp.buy_in('214', 'm-2'), 2, 'last month''s spend does not count: 500 and 500 are given this month');
select is(pg_temp.buy_in('215', 'm-3'), 0, 'and with this month''s 1,000 spent, no more until the next');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'monthly');

-- Approving a monthly budget writes the wheel's and the reports' monthly cap.
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
grant select on ids to authenticated;
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Spin month') returning id)
insert into ids select 'spin', id from p;
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, author_staff_id, submitted_at)
select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'spin'), 1, 'awaiting_approval', 'Spin month',
       '{"kind": "free_spin", "spins": 1, "afterMinutes": 240}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', private.club_day_of(now())::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "per_day", "budgetChips": 20000, "maxGrants": 300, "budgetPeriod": "month"}', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}',
       s.id, now()
from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000107';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_version((select v.id from public.promotion_version v where v.promotion_id = (select id from ids where name = 'spin'))) $$,
  'a super admin approves a monthly budget');
reset role;
select results_eq($$ select cap_paise, cap_count, period from public.promotion_budget where promotion_id = (select id from ids where name = 'spin') $$,
  $$ values (2000000::bigint, 300, 'month'::text) $$, 'and the budget the wheel reads is monthly too');

-- An old rule with up to two a day and a monthly budget becomes a version, its grants numbered in their days.
select set_config('request.jwt.claims', '', true);
with p as (insert into public.promotion (venue_id, name, status, priority, per_player_limit, per_player_period, starts_at)
           values ('00000000-0000-4000-8000-000000000001', 'Old twice a day', 'live', 5, 2, 'day', now() - interval '3 days') returning id)
insert into ids select 'old', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'old'), 'buy_in', '{}', '{"kind": "bonus", "amount_paise": 50000, "expires_days": 7}');
insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count, period)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'old'), 1000000, null, 'month');
insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day, created_at)
select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'old'), r.id, '00000000-0000-4000-8000-000000000216', 'buy_in',
       r.effect, 50000, 0, g.key, private.club_day_of(g.at), g.at
from public.promotion_rule r,
     (values ('buy_in:old-1', '2026-11-03T20:00:00+05:30'::timestamptz), ('buy_in:old-2', '2026-11-03T21:00:00+05:30'::timestamptz)) as g (key, at)
where r.promotion_id = (select id from ids where name = 'old');
select private.version_promotions('00000000-0000-4000-8000-000000000001');
select results_eq($$ select v.limits from public.promotion_version v where v.promotion_id = (select id from ids where name = 'old') $$,
  $$ values ('{"perMember": "per_day", "timesPerMember": 2, "budgetChips": 10000, "budgetPeriod": "month"}'::jsonb) $$,
  'the old rule is a version: up to two a day, 10,000 chips a month');
select results_eq($$ select period_key from public.promotion_grant g where g.promotion_id = (select id from ids where name = 'old') order by created_at $$,
  $$ values ('day:2026-11-03'::text), ('day:2026-11-03#2') $$, 'its two grants of one day are numbered, so the unique key takes both');
select results_eq($$ select chips from public.promotion_grant g where g.promotion_id = (select id from ids where name = 'old') order by created_at $$,
  $$ values (500::bigint), (500::bigint) $$, 'and count their chips, which the old path wrote in rupees only');

-- An old rule whose monthly budget is spent this month stays spent once a version: its old grants count (money audit).
create function pg_temp.old_rule(p_name text, p_limit integer, p_period text, p_cap_paise bigint, p_budget_period text) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name, status, priority, per_player_limit, per_player_period, starts_at)
  values ('00000000-0000-4000-8000-000000000001', p_name, 'live', 5, p_limit, p_period, now() - interval '3 days') returning id into v_promotion;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 'buy_in', '{}', '{"kind": "bonus", "amount_paise": 50000, "expires_days": 7}');
  if p_cap_paise is not null then
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, period) values ('00000000-0000-4000-8000-000000000001', v_promotion, p_cap_paise, p_budget_period);
  end if;
  return v_promotion;
end;
$$;
insert into ids select 'spent', pg_temp.old_rule('Spent this month', 2, 'day', 100000, 'month');
insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day)
select '00000000-0000-4000-8000-000000000001', r.promotion_id, r.id, '00000000-0000-4000-8000-000000000217', 'buy_in', r.effect, 50000, 0, k.key,
       private.club_day_of(now())
from public.promotion_rule r, (values ('buy_in:spent-1'), ('buy_in:spent-2')) as k (key)
where r.promotion_id = (select id from ids where name = 'spent');
-- Up to three ever on any buy-in, and a whole budget under 50 chips.
insert into ids select 'thrice', pg_temp.old_rule('Three ever', 3, 'promotion', null, null);
insert into ids select 'tiny', pg_temp.old_rule('Tiny budget', 2, 'day', 4000, 'promotion');
-- The first grant a club day, up to two a member: the model counts members a day, so it stays on the old path.
insert into ids select 'first-n', pg_temp.old_rule('First one a day', 2, 'day', null, null);
update public.promotion_rule set conditions = '{"first_n": {"count": 1, "per": "day"}}' where promotion_id = (select id from ids where name = 'first-n');
select private.version_promotions('00000000-0000-4000-8000-000000000001');
-- Only the spent one runs for the buy-in below.
update public.promotion_version set status = 'ended' where promotion_id in (select id from ids where name in ('old', 'thrice'));
update public.promotion set status = 'ended' where id in (select id from ids where name in ('tiny', 'first-n'));
select is(pg_temp.buy_in('218', 's-1'), 0, 'a monthly budget the old path spent this month gives nothing more as a version');
select results_eq($$ select v.reward, v.limits from public.promotion_version v where v.promotion_id = (select id from ids where name = 'thrice') $$,
  $$ values ('{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}'::jsonb, '{"perMember": "once", "timesPerMember": 3}'::jsonb) $$,
  'up to three ever on a buy-in is a fixed bonus on any buy-in, three times, not the first buy-in''s chips');
select is_empty($$ select 1 from public.promotion_version v where v.promotion_id = (select id from ids where name = 'tiny') $$,
  'a budget under 50 chips stays on the old path, never dropped');
select is_empty($$ select 1 from public.promotion_version v where v.promotion_id = (select id from ids where name = 'first-n') $$,
  'and the first grant a club day, up to two a member, stays too: members a day would let one member take it twice');

select * from finish();
rollback;
