-- Every venue's promotions in versions (decision 0461): each promotion run by one rule the typed model can say becomes
-- version 1, in the status it had; Founders' Circle priority and the cab home, cards only until now, become waitlist
-- priority and a cab home from the fourth visit; and every venue gains Double points and Triple points as points
-- multipliers (drafts, from today). A rule the model cannot say (a hand, call time, visits so far, a new player), and the
-- cards that are only words (high hands, the bad beat, RIVR Rewards, Ladies' Night, the League, RIVR Sunday), stay as
-- they are. The rules stay as history: grants already given keep them, and count towards the version's limits.

-- The reward a rule gives, in the typed model, or null when the model cannot say it.
create function private.reward_from_rule(p_promotion public.promotion, p_rule public.promotion_rule)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(case
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'points' and (e ->> 'multiplier_percent')::integer between 125 and 500
         and (e ->> 'multiplier_percent')::integer % 25 = 0 and not c ? 'min_hours'
      then jsonb_build_object('kind', 'points_multiplier', 'multiplier', (e ->> 'multiplier_percent')::numeric / 100)
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and (e ->> 'percent_bps')::integer % 100 = 0
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'percent', 'percent', (e ->> 'percent_bps')::integer / 100,
                              'capChips', (e ->> 'cap_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and p_promotion.per_player_period = 'promotion'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100, 'on', 'first_buyin')
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'fixed', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and c ? 'min_hours'
      then jsonb_build_object('kind', 'hours_bonus', 'chips', (e ->> 'amount_paise')::bigint / 100, 'afterMinutes', (c ->> 'min_hours')::integer * 60)
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'spin' and c ? 'min_hours'
      then jsonb_build_object('kind', 'free_spin', 'spins', 1, 'afterMinutes', (c ->> 'min_hours')::integer * 60)
    when p_rule.trigger in ('referral', 'check_in') and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'on', case p_rule.trigger when 'referral' then 'referral' else 'visit' end)
    when p_rule.trigger = 'graduation' and e ->> 'kind' = 'freeroll_ticket'
      then jsonb_build_object('kind', 'tournament_entry', 'tournamentId', e ->> 'tournament')
  end)
  from (select p_rule.effect as e, p_rule.conditions as c) x
  -- Only the conditions the typed model has; first N per table only for a buy-in, where it is the reward's.
  where not exists (select 1 from jsonb_object_keys(p_rule.conditions) k
                    where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours'))
    and (not p_rule.conditions ? 'first_n' or p_rule.conditions #>> '{first_n,per}' = 'day' or p_rule.trigger = 'buy_in');
$$;

-- A promotion and its reward as version 1's terms: its days, window, stakes, tables and tiers; its per-member limit,
-- first N a day and budget; on every channel, as its card was.
create function private.insert_version_from_rule(p_promotion public.promotion, p_reward jsonb, p_conditions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget public.promotion_budget;
  v_status text := case p_promotion.status when 'pending' then 'awaiting_approval' else p_promotion.status end;
begin
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  if v_status = 'awaiting_approval' and p_promotion.requested_by_staff_id is null then
    v_status := 'draft';
  end if;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, rules_text, link,
                                        detail, runs, author_staff_id, submitted_at, decided_by_staff_id, decided_at, rejected_reason)
  values (p_promotion.venue_id, p_promotion.id, 1, v_status, p_promotion.name, p_reward,
          jsonb_strip_nulls(jsonb_build_object('stakes', coalesce(p_conditions -> 'stakes', '"all"'), 'tiers', coalesce(p_conditions -> 'tier_ids', '"all"'),
                                               'audience', 'everyone', 'tableIds', p_conditions -> 'table_ids')),
          jsonb_strip_nulls(jsonb_build_object('days', coalesce(p_conditions -> 'days', '[1, 2, 3, 4, 5, 6, 7]'), 'from', coalesce(p_conditions ->> 'from', '06:00'),
                             'to', coalesce(p_conditions ->> 'until', '06:00'), 'startsOn', private.club_day_of(p_promotion.starts_at)::text,
                             'timezone', 'Asia/Kolkata',
                             -- No end date, no last day: greatest() skips a null, which made the start day the last.
                             'endsOn', case when p_promotion.ends_at is not null
                                            then greatest(private.club_day_of(p_promotion.ends_at - interval '1 second'),
                                                          private.club_day_of(p_promotion.starts_at))::text end)),
          jsonb_strip_nulls(jsonb_build_object(
            'perMember', case when p_promotion.per_player_limit = 1 and p_promotion.per_player_period = 'day' then 'per_day'
                              when p_promotion.per_player_limit = 1 and p_promotion.per_player_period = 'promotion' then 'once'
                              else 'none' end,
            'maxMembersPerDay', case when p_conditions #>> '{first_n,per}' = 'day' then (p_conditions #>> '{first_n,count}')::integer end,
            'budgetChips', nullif(v_budget.cap_paise / 5000 * 50, 0), 'maxGrants', v_budget.cap_count)),
          '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}', p_promotion.rules, p_promotion.link, p_promotion.detail, p_promotion.runs,
          p_promotion.requested_by_staff_id, p_promotion.requested_at, p_promotion.decided_by_staff_id, p_promotion.decided_at, p_promotion.refused_reason);
  perform set_config('rivr.promotion_sync', 'on', true);
  update public.promotion set current_version = 1 where id = p_promotion.id and status in ('live', 'paused', 'ended');
  perform set_config('rivr.promotion_sync', 'off', true);
  -- Grants already given count in their period, so a once-only promotion stays once.
  update public.promotion_grant g
  set period_key = private.promo_period_key(v.limits, g.source_key, g.created_at, null)
  from public.promotion_version v
  where v.promotion_id = p_promotion.id and v.version = 1 and g.promotion_id = p_promotion.id and g.period_key is null;
end;
$$;

-- Double and Triple points, from today: points multipliers on time played, every day, for everyone (owner's decision 5).
create function private.add_points_multiplier_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
begin
  for v_promotion in
    insert into public.promotion (venue_id, template_key, name, detail, runs)
    values (p_venue_id, 'double_points', 'Double points', '2× points', 'All stakes · every day'),
           (p_venue_id, 'triple_points', 'Triple points', '3× points', 'All stakes · every day')
    on conflict (venue_id, template_key) do nothing
    returning *
  loop
    insert into public.promotion_version (venue_id, promotion_id, version, name, reward, eligibility, schedule, limits, channels, detail, runs)
    values (p_venue_id, v_promotion.id, 1, v_promotion.name,
            jsonb_build_object('kind', 'points_multiplier', 'multiplier', case v_promotion.template_key when 'double_points' then 2 else 3 end),
            '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
            jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', private.club_day_of(now())::text,
                               'timezone', 'Asia/Kolkata'),
            '{"perMember": "per_visit"}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}', v_promotion.detail, v_promotion.runs);
  end loop;
end;
$$;

-- A venue's promotions in versions: every one run by a rule the model can say, Founders' Circle priority, the cab home,
-- and the points multipliers. A promotion that has versions already is left alone.
create function private.version_promotions(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
  v_rule public.promotion_rule;
  v_reward jsonb;
begin
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and not exists (select 1 from public.promotion_version v where v.promotion_id = p.id)
    order by p.created_at, p.id
  loop
    select * into v_rule from public.promotion_rule r where r.promotion_id = v_promotion.id order by r.position limit 1;
    if v_rule.id is not null and (select count(*) from public.promotion_rule r where r.promotion_id = v_promotion.id) = 1 then
      v_reward := private.reward_from_rule(v_promotion, v_rule);
    elsif v_rule.id is null and v_promotion.template_key = 'founders_priority' then
      v_reward := '{"kind": "waitlist_priority"}';
    elsif v_rule.id is null and v_promotion.template_key = 'cab' then
      v_reward := '{"kind": "cab_home", "fromVisitInMonth": 4}';
    else
      v_reward := null;
    end if;
    -- A rule the model cannot say exactly stays on the old path (decision 0461; money audit): more than one grant a member
    -- in its period, which a version would loosen to no limit, or a monthly budget, which a version's whole-promotion
    -- budget would spend for good.
    if coalesce(v_promotion.per_player_limit, 1) > 1
       or exists (select 1 from public.promotion_budget b where b.promotion_id = v_promotion.id and b.period = 'month') then
      v_reward := null;
    end if;
    if v_reward is not null then
      perform private.insert_version_from_rule(v_promotion, v_reward,
        case when v_promotion.template_key = 'founders_priority'
             then jsonb_strip_nulls(jsonb_build_object('tier_ids',
                    (select jsonb_agg(t.id) from public.tier t where t.venue_id = p_venue_id and t.name = 'Founders'' Circle')))
             else coalesce(v_rule.conditions, '{}') end);
    end if;
  end loop;
  perform private.add_points_multiplier_templates(p_venue_id);
end;
$$;

-- As 20261029120000_promotion_words_without_rupees.sql made it, then in versions.
create or replace function private.add_promotion_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'high_hands', 'High hands', 'Royal flush 25,000 · Straight flush 10,000 · Four of a kind 2,000, in chips', 'Every night', null, null),
    (p_venue_id, 'bad_beat', 'Bad-beat jackpot', 'The pool pays the losing hand, the winner and the table', 'Every night', null, null),
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '1,000 bonus chips on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'rivr_rewards', 'RIVR Rewards', 'Points the club gives you, to spend on rewards', 'Every game', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'ladies_night', 'Ladies'' Night', 'An evening for women players', null, null, null),
    (p_venue_id, 'league', 'RIVR League', 'Points from cash games and tournaments, a champion each season', 'Every month', null, null),
    (p_venue_id, 'sunday_guarantee', 'RIVR Sunday', 'A guaranteed prize pool', 'Sundays', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus', '1,000 bonus chips after four hours at the tables', 'Every night', 1, 'day'),
    (p_venue_id, 'graduate_freeroll', 'Graduate freeroll', 'A RIVR Sunday freeroll entry when you graduate from the Academy', 'On graduation', 1, 'promotion'),
    (p_venue_id, 'spin_wheel', 'Spin the wheel', 'A spin of the RIVR wheel after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb),
    ('graduate_freeroll', 'graduation', '{}'::jsonb, '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}'::jsonb),
    ('spin_wheel', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "spin"}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
  perform private.version_promotions(p_venue_id);
end;
$$;

select private.version_promotions(v.id) from public.venue v;

revoke execute on function private.reward_from_rule(public.promotion, public.promotion_rule),
  private.insert_version_from_rule(public.promotion, jsonb, jsonb), private.add_points_multiplier_templates(uuid), private.version_promotions(uuid)
  from public, anon, authenticated;

-- The practice venue's reset keeps its promotions in versions (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
