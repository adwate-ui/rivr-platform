-- No rupee on Home, the TV or the console (owner, 29 Oct, #627, #628; decision 0284). The promotions every venue starts
-- with (private.add_promotion_templates) said their bonuses and prizes in rupees, and RIVR Rewards promised points from
-- rake, which no longer earns any (#629). Their words now say bonus chips and no rake. A promotion staff have reworded
-- keeps its words: only those still as the template wrote them change.

-- As before (20261028394000_spin_wheel.sql), with the new words.
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
end;
$$;

-- The venues' promotions still in the template's words take the new ones.
update public.promotion p set detail = w.new_detail
from (values
  ('high_hands', 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000',
   'Royal flush 25,000 · Straight flush 10,000 · Four of a kind 2,000, in chips'),
  ('referral', '₹1,000 to each side', '1,000 bonus chips to each side'),
  ('graduate_first_buy_in', '₹1,000 on an Academy graduate''s first buy-in', '1,000 bonus chips on an Academy graduate''s first buy-in'),
  ('rivr_rewards', '5% of your rake back as points', 'Points the club gives you, to spend on rewards'),
  ('sunday_guarantee', '₹5,00,000 guaranteed', 'A guaranteed prize pool'),
  ('hours_bonus', '₹1,000 bonus after four hours at the tables', '1,000 bonus chips after four hours at the tables')
) as w (template_key, old_detail, new_detail)
where p.template_key = w.template_key and p.detail = w.old_detail;

-- The practice venue's reset keeps the new words (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
