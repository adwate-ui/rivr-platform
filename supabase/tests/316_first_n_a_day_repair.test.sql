-- The first N grants a club day, with no limit a member (decision 0501). A version 20261107140000 made of such a rule
-- said N members a day with no limit a member, so each could be given it again and again. The repair makes it one a
-- club day a member, N members a day, and keys its grants by their club day; the conversion now gives those limits
-- directly. Either way at most N grants a club day, however often one member tries.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts: only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

-- An old rule: 500 bonus chips on a buy-in, the first two a club day, no limit a member.
create function pg_temp.old_rule(p_name text) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name, status, priority, starts_at)
  values ('00000000-0000-4000-8000-000000000001', p_name, 'live', 5, now() - interval '3 days') returning id into v_promotion;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 'buy_in', '{"first_n": {"count": 2, "per": "day"}}',
          '{"kind": "bonus", "amount_paise": 50000, "expires_days": 7}');
  return v_promotion;
end;
$$;
create function pg_temp.buy_in(p_member text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'buy_in:' || p_key, 'amount_paise', 1000000,
                       'method', 'cash', 'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3')));
$$;
create function pg_temp.given_today(p_promotion uuid) returns integer language sql as $$
  select count(*)::integer from public.promotion_grant where promotion_id = p_promotion and club_day = private.club_day_of(now());
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;

-- 1. The repair. The version as 20261107140000 made it, live, with a grant it gave member 211 today under its old key.
insert into ids select 'old', pg_temp.old_rule('First two a day');
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'old'), 1, 'live', 'First two a day',
        '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
        jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 3)::text,
                           'timezone', 'Asia/Kolkata'),
        '{"perMember": "none", "maxMembersPerDay": 2}', '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}');
select private.sync_promotion((select id from ids where name = 'old'));
insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, points, chips, source_key,
                                    period_key, club_day)
select '00000000-0000-4000-8000-000000000001', v.promotion_id, v.id, '00000000-0000-4000-8000-000000000211', 'buy_in', v.reward, 50000, 0, 500,
       'buy_in:r-0', 'event:buy_in:r-0', private.club_day_of(now())
from public.promotion_version v where v.promotion_id = (select id from ids where name = 'old');
create function pg_temp.second_today_refusal() returns text language sql as $$
  select private.promo_check_limits(v.reward, v.limits, '{"chips": 500}',
    private.promotion_tally(v.promotion_id, '00000000-0000-4000-8000-000000000211',
                            private.promo_period_key(v.limits, 'buy_in:r-1', now(), null), null, private.club_day_of(now()), v.limits))
  from public.promotion_version v where v.promotion_id = (select id from ids where name = 'old');
$$;
select is(pg_temp.second_today_refusal(), null, 'as it was made, member 211 would be given it again today: the limit the repair mends');

select is(private.repair_first_n_a_day_versions(), 1, 'the repair mends the one version');
select results_eq($$ select status, limits from public.promotion_version where promotion_id = (select id from ids where name = 'old') $$,
  $$ values ('live'::text, '{"perMember": "per_day", "maxMembersPerDay": 2}'::jsonb) $$,
  'still live, now one a club day a member and two members a day');
select is((select period_key from public.promotion_grant where promotion_id = (select id from ids where name = 'old')),
  'day:' || to_char(private.club_day_of(now()), 'YYYY-MM-DD'), 'the grant it gave today is keyed by the club day');
select is(pg_temp.buy_in('211', 'r-2') + pg_temp.buy_in('211', 'r-3'), 0, 'so member 211, given it today, has it no more today');
select is(pg_temp.buy_in('212', 'r-4'), 1, 'a second member has it');
select is(pg_temp.buy_in('212', 'r-5') + pg_temp.buy_in('213', 'r-6'), 0, 'and then nobody: not 212 again, nor a third member');
select is(pg_temp.given_today((select id from ids where name = 'old')), 2, 'two grants this club day, as the rule meant');
select is(private.repair_first_n_a_day_versions(), 0, 'the repair, run again, finds nothing');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'old');

-- A promotion whose converted version 1 was followed by a version people wrote and approved is left alone, its grants
-- keeping the keys that version's limits gave them.
insert into ids select 'later', pg_temp.old_rule('First two a day, then once ever');
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'later'), n, s, 'First two a day, then once ever',
       '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 3)::text,
                          'timezone', 'Asia/Kolkata'),
       l, '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}'
from (values (1, 'ended', '{"perMember": "none", "maxMembersPerDay": 2}'::jsonb), (2, 'live', '{"perMember": "once"}'::jsonb)) as x (n, s, l);
insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, points, chips, source_key,
                                    period_key, club_day)
select '00000000-0000-4000-8000-000000000001', v.promotion_id, v.id, '00000000-0000-4000-8000-000000000211', 'buy_in', v.reward, 50000, 0, 500,
       'buy_in:l-0', 'once', private.club_day_of(now()) - 1
from public.promotion_version v where v.promotion_id = (select id from ids where name = 'later') and v.version = 2;
select is(private.repair_first_n_a_day_versions(), 0, 'a promotion with a later version is not repaired');
select is((select period_key from public.promotion_grant where promotion_id = (select id from ids where name = 'later')), 'once',
  'and its once-ever grant keeps its key');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'later');

-- 2. The conversion now gives those limits directly.
insert into ids select 'new', pg_temp.old_rule('First two a day, converted');
select private.version_promotions('00000000-0000-4000-8000-000000000001');
select results_eq($$ select limits from public.promotion_version where promotion_id = (select id from ids where name = 'new') $$,
  $$ values ('{"perMember": "per_day", "maxMembersPerDay": 2}'::jsonb) $$, 'converted, it says one a club day a member, two members a day');
select is(pg_temp.buy_in('214', 'c-1') + pg_temp.buy_in('214', 'c-2') + pg_temp.buy_in('214', 'c-3'), 1, 'one member trying three times is given it once');
select is(pg_temp.buy_in('215', 'c-4') + pg_temp.buy_in('216', 'c-5') + pg_temp.buy_in('215', 'c-6'), 1, 'one more member, then nobody');
select is(pg_temp.given_today((select id from ids where name = 'new')), 2, 'at most two grants a club day');

select * from finish();
rollback;
