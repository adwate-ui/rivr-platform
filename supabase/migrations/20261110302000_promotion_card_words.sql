-- The words promotions already hold (audit F-055): never "bonus" alone (the owner, 8 Nov), and no call the floor did not
-- make (the owner, 9 Nov). A new venue's templates say the same. Buy-in bonus Tuesday keeps its name, as the seed and
-- a staging flow read it and buy-in bonuses no longer start.
-- Not an ended one: its last change is the day the list says it ended.

update public.promotion set detail = 'Front of every waitlist' where detail = 'First call on every waitlist' and status <> 'ended';
update public.promotion_version set detail = 'Front of every waitlist' where detail = 'First call on every waitlist' and status <> 'ended';
update public.promotion set name = 'Four-hour bonus chips' where name = 'Four-hour bonus' and status <> 'ended';
update public.promotion_version set name = 'Four-hour bonus chips' where name = 'Four-hour bonus' and status <> 'ended';

CREATE OR REPLACE FUNCTION private.add_promotion_templates(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '1,000 bonus chips on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'Front of every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus chips', '1,000 bonus chips after four hours at the tables', 'Every night', 1, 'day'),
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
$function$;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
