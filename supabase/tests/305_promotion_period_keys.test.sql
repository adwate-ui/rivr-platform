-- A promotion grant's period key (console v3, money audit): the same as @rivr/domain's periodKey whatever the session's
-- DateStyle, so the unique (promotion, member, period key) index holds a once-a-day or once-a-week reward to one grant.
-- Club days turn at 06:00 IST; a club week starts on Monday. And which old rule promotions become versions.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.key_at(p_per text, p_at timestamptz) returns text language sql as $$
  select private.promo_period_key(jsonb_build_object('perMember', p_per), 'k1', p_at, null);
$$;

set local datestyle = 'SQL, DMY';
select is(pg_temp.key_at('per_day', '2026-11-18 05:59:59+05:30'), 'day:2026-11-17', 'before 06:00 IST it is the club day before, written ISO');
select is(pg_temp.key_at('per_day', '2026-11-18 06:00:00+05:30'), 'day:2026-11-18', 'from 06:00 IST, the new club day');
select is(pg_temp.key_at('per_week', '2026-11-23 03:00:00+05:30'), 'week:2026-11-16', 'Monday 03:00 is still the week before');
select is(pg_temp.key_at('per_week', '2026-11-23 07:00:00+05:30'), 'week:2026-11-23', 'Monday 07:00 starts the new week');
set local datestyle = 'German, DMY';
select is(pg_temp.key_at('per_day', '2026-11-18 06:00:00+05:30'), 'day:2026-11-18', 'the same key in another DateStyle');
set local datestyle = 'ISO, MDY';
select is(pg_temp.key_at('once', now()), 'once', 'once is once');
select is(pg_temp.key_at('none', now()), 'event:k1', 'no limit keys the event');

-- A rule promotion the model cannot say exactly stays on the old path, unversioned: two grants a member a day, or a
-- budget by the month.
reset datestyle;
create temp table ids (name text primary key, id uuid);
with p as (insert into public.promotion (venue_id, name, status, priority, per_player_limit, per_player_period)
           values ('00000000-0000-4000-8000-000000000001', 'Twice a day', 'live', 5, 2, 'day') returning id)
insert into ids select 'twice', id from p;
with p as (insert into public.promotion (venue_id, name, status, priority)
           values ('00000000-0000-4000-8000-000000000001', 'Monthly budget', 'live', 5) returning id)
insert into ids select 'monthly', id from p;
with p as (insert into public.promotion (venue_id, name, status, priority, per_player_limit, per_player_period)
           values ('00000000-0000-4000-8000-000000000001', 'Once a day', 'live', 5, 1, 'day') returning id)
insert into ids select 'daily', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
select '00000000-0000-4000-8000-000000000001', id, 'buy_in', '{}', '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}' from ids;
insert into public.promotion_budget (venue_id, promotion_id, cap_paise, period)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'monthly'), 1000000, 'month');
select private.version_promotions('00000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.promotion_version v join ids on ids.id = v.promotion_id where ids.name in ('twice', 'monthly')), 0,
  'two grants a member a day, or a monthly budget, stay on the old path');
select is((select v.limits ->> 'perMember' from public.promotion_version v join ids on ids.id = v.promotion_id where ids.name = 'daily'), 'per_day',
  'once a day becomes a version, once a day');

select * from finish();
rollback;
