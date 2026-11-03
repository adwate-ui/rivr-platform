-- The word-only promotion cards retire (owner, 3 Nov; decision 0498): high hands, the bad-beat jackpot, RIVR Rewards,
-- Ladies' Night, the RIVR League and RIVR Sunday. They gave nothing (no rule, no version) and only showed words on the
-- player's Tonight, the TVs and the website. Each ends, kept for history; nothing reads them as live again, so the
-- cards leave every screen. The features they named go on: high hands are claimed and paid at the tables
-- (high_hand_claim), the bad beat from its jackpot, points, the League and RIVR Sunday from their own screens.

-- 1. Every venue's card ends. A card in versions does not exist (the cards had no rule to convert).
update public.promotion p
set status = 'ended'
where p.template_key in ('high_hands', 'bad_beat', 'rivr_rewards', 'ladies_night', 'league', 'sunday_guarantee') and p.status <> 'ended'
  and not exists (select 1 from public.promotion_version v where v.promotion_id = p.id);

-- 2. A new venue's templates, as 20261107140000_promotion_versions_from_rules.sql made them, without the cards.
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
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '1,000 bonus chips on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
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

-- 3. The practice venue's reset keeps the cards ended (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
