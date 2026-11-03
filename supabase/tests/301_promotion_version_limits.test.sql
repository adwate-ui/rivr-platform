-- The engine on versions (console v3 phase 7; decisions 0470 to 0472): a live version's limits and budget, held in the
-- database. Each block puts one version live at Gurugram and weighs events for the seed's members: buy-ins at Tables 3
-- and 5, check-ins and a sign-up. The engine's twins are proved on the golden files (024_golden_twins); this proves
-- they are put together as the domain does, and that the unique period key holds a member's limit.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts (decision 0491): only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

-- A version live from yesterday, every day all day, for everyone at every stake unless told otherwise.
create function pg_temp.live(p_name text, p_reward jsonb, p_limits jsonb, p_eligibility jsonb default '{"stakes": "all", "tiers": "all", "audience": "everyone"}')
returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', p_name, p_reward, p_eligibility,
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          p_limits, '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
-- A buy-in of so many chips at a table, paid in cash unless told otherwise: the grants given.
create function pg_temp.buy_in(p_member text, p_key text, p_chips bigint default 10000, p_table text default 'Table 3', p_method text default 'cash')
returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'buy_in:' || p_key, 'amount_paise', p_chips * 100,
                       'method', p_method,
                       'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_table)));
$$;
create function pg_temp.check_in(p_member text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'check_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'check_in:' || p_key));
$$;
create function pg_temp.chips(p_promotion uuid) returns bigint language sql as $$
  select coalesce(sum(chips), 0)::bigint from public.promotion_grant where promotion_id = p_promotion;
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;

-- A budget in chips, whole or not at all: 20% of 10,000 is 2,000; with 1,000 left, it is not given; 1,000 still fits.
insert into ids select 'budget', pg_temp.live('Budget', '{"kind": "buyin_bonus", "mode": "percent", "percent": 20}', '{"perMember": "none", "budgetChips": 3000}');
select is(pg_temp.buy_in('211', 'b-1'), 1, 'a budget of 3,000: the first 2,000 is given');
select is(pg_temp.buy_in('212', 'b-2'), 0, 'budget exhausted mid-grant: 2,000 more is not given, nor part of it');
select is(pg_temp.buy_in('212', 'b-3', 5000), 1, 'but 20% of 5,000 still fits');
select is(pg_temp.chips((select id from ids where name = 'budget')), 3000::bigint, 'the whole budget, and never more');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'budget');

-- A cap smaller than the percent; a buy-in paid from bonus earns none.
insert into ids select 'cap', pg_temp.live('Cap', '{"kind": "buyin_bonus", "mode": "percent", "percent": 50, "capChips": 500}', '{"perMember": "none"}');
select is(pg_temp.buy_in('213', 'c-1'), 1, 'half of 10,000 with a 500 cap is given');
select is((select chips from public.promotion_grant where source_key = 'buy_in:c-1'), 500::bigint, 'as 500');
select is(pg_temp.buy_in('213', 'c-2', 10000, 'Table 3', 'bonus'), 0, 'a buy-in paid from bonus earns none');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'cap');

-- The first two buy-ins at each table this club day.
insert into ids select 'first', pg_temp.live('First two', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500, "firstNBuyinsPerTable": 2}',
                                             '{"perMember": "none"}');
select is(pg_temp.buy_in('211', 'f-1') + pg_temp.buy_in('212', 'f-2') + pg_temp.buy_in('213', 'f-3'), 2, 'the first two at Table 3, not the third');
select is(pg_temp.buy_in('214', 'f-4', 10000, 'Table 5'), 1, 'and the first at Table 5');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'first');

-- Members a day, and the most grants.
insert into ids select 'members', pg_temp.live('Two a day', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 100}', '{"perMember": "none", "maxMembersPerDay": 2}');
select is(pg_temp.buy_in('211', 'm-1') + pg_temp.buy_in('212', 'm-2') + pg_temp.buy_in('213', 'm-3'), 2, 'two members a day, not a third');
select is(pg_temp.buy_in('211', 'm-4'), 1, 'one of the two may have it again, with no limit per member');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'members');
insert into ids select 'most', pg_temp.live('Three in all', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 100}', '{"perMember": "none", "maxGrants": 3}');
select is(pg_temp.buy_in('211', 'g-1') + pg_temp.buy_in('212', 'g-2') + pg_temp.buy_in('213', 'g-3') + pg_temp.buy_in('214', 'g-4'), 3,
  'three grants in all, not a fourth');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'most');

-- Once ever, across versions: version 2 does not give again what version 1 gave.
insert into ids select 'once', pg_temp.live('Once', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 200}', '{"perMember": "once"}');
select is(pg_temp.buy_in('216', 'o-1'), 1, 'once ever: Kunal has it');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'once');
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select venue_id, promotion_id, 2, 'live', 'Once, bigger', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 400}', eligibility, schedule, limits, channels
from public.promotion_version where promotion_id = (select id from ids where name = 'once') and version = 1;
select private.sync_promotion((select id from ids where name = 'once'));
select is(pg_temp.buy_in('216', 'o-2'), 0, 'and not again under version 2');
select is(pg_temp.buy_in('217', 'o-3'), 1, 'which Neel has');
select throws_ok($$ insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, points,
                                                          source_key, period_key, club_day)
                    select venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, 0, 0, 'race', period_key, club_day
                    from public.promotion_grant where source_key = 'buy_in:o-1' $$,
  '23505', null, 'the period key is unique per promotion and member, so a race cannot give twice');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'once');

-- Bonus chips from two promotions stack; two of one perk for a visit give one.
insert into ids select 'chips-a', pg_temp.live('Chips A', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}', '{"perMember": "per_day"}');
insert into ids select 'chips-b', pg_temp.live('Chips B', '{"kind": "bonus_chips", "chips": 200, "on": "visit"}', '{"perMember": "per_day"}');
insert into ids select 'priority-a', pg_temp.live('Priority A', '{"kind": "waitlist_priority"}', '{"perMember": "per_day"}');
insert into ids select 'priority-b', pg_temp.live('Priority B', '{"kind": "waitlist_priority"}', '{"perMember": "per_day"}');
select is(pg_temp.check_in('214', 's-1'), 3, 'a check-in gives both bonuses and one waitlist priority');
select results_eq($$ select coalesce(g.perk, p.name), g.chips from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
                     where g.source_key = 'check_in:s-1' order by 1 $$,
  $$ values ('Chips A'::text, 100::bigint), ('Chips B', 200), ('waitlist_priority', 0) $$, 'both bonuses, and one waitlist priority (the older promotion''s)');
select is(pg_temp.check_in('214', 's-1'), 0, 'the same check-in again gives nothing more');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000214' and reason in ('Chips A', 'Chips B')
           and expires_at > now() + interval '6 days'), 2, 'each credited as bonus for seven days');
update public.promotion_version set status = 'ended' where promotion_id in (select id from ids where name in ('chips-a', 'chips-b', 'priority-a', 'priority-b'));

-- Who qualifies: a tier, and an event away from a table for a promotion of some stakes.
insert into ids select 'tier', pg_temp.live('Founders only', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}', '{"perMember": "per_day"}',
  jsonb_build_object('stakes', 'all', 'audience', 'everyone',
                     'tiers', jsonb_build_array((select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Founders'' Circle'))));
select is(pg_temp.check_in('212', 't-1'), 0, 'a member of another tier does not qualify');
insert into ids select 'stake', pg_temp.live('High stakes', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}', '{"perMember": "per_day"}',
  '{"stakes": ["nlh_100_200"], "tiers": "all", "audience": "everyone"}');
select is(pg_temp.check_in('213', 't-2'), 0, 'a promotion of some stakes gives nothing away from a table');
update public.promotion_version set status = 'ended' where promotion_id in (select id from ids where name in ('tier', 'stake'));

-- A sign-up: once a member's identity is verified, once.
insert into ids select 'signup', pg_temp.live('Welcome', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}', '{"perMember": "once"}');
update public.kyc_record set status = 'needs_review', verified_at = null where member_id = '00000000-0000-4000-8000-000000000212';
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000212';
select is(pg_temp.chips((select id from ids where name = 'signup')), 500::bigint, 'verified, Vihaan has the sign-up bonus');
update public.kyc_record set status = 'needs_review', verified_at = null where member_id = '00000000-0000-4000-8000-000000000212';
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000212';
select is(pg_temp.chips((select id from ids where name = 'signup')), 500::bigint, 'verified again after a recheck, nothing more');
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'signup');

-- A frozen member is given nothing, and their event goes on.
insert into ids select 'frozen', pg_temp.live('For anyone', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 100}', '{"perMember": "none"}');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000217', 'Test');
select is(pg_temp.buy_in('217', 'z-1'), 0, 'a frozen member is given nothing');

select * from finish();
rollback;
