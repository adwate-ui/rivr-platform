-- Templates for every scheme in the deck (#85; scope-v1 module 7, "Templates ship for every scheme in
-- the deck"). Each venue has the eleven as draft promotions, keyed by `template_key`, with their card's
-- words; the floor publishes one when the club runs it (publish_promotion_template). Three are run by
-- the engine and carry their rule: the Tuesday buy-in bonus, referral and the graduate's first buy-in
-- (question #419). The rest are run elsewhere and are cards only, with no rule, so the engine never
-- pays them twice: high hands (paid in chips on the floor's approval, decision 0050), the bad-beat
-- jackpot (#48), RIVR Rewards (points from rake, #89), Founders' Circle priority (waitlist weights,
-- #40), the cab (lane C's cab.minimum_visits), Ladies' Night (the floor), the League (#147) and the ₹5
-- lakh Sunday guarantee (the tournament). Decision 0142.

alter table public.promotion
  add column template_key text check (template_key ~ '^[a-z0-9_]{2,40}$'),
  add constraint promotion_template_key_key unique (venue_id, template_key);

-- Publishes a draft template as it stands, card and rule: live at once, announced as a builder's
-- promotion is. Staff who manage promotions at its venue; not while the venue is frozen or
-- promotions are switched off; a template only once, from its draft.
create function private.publish_promotion_template(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
begin
  select * into v_promotion from public.promotion p where p.id = p_promotion_id for update;
  if v_promotion.id is null or not private.has_permission(v_promotion.venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions publish one' using errcode = '42501';
  end if;
  perform private.assert_writable(v_promotion.venue_id, 'promotions');
  if v_promotion.template_key is null or v_promotion.status <> 'draft' then
    raise exception 'Only a draft template is published this way' using errcode = '22023';
  end if;
  update public.promotion set status = 'live', starts_at = now() where id = p_promotion_id;
  perform private.emit(v_promotion.venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_promotion.id, 'name', v_promotion.name, 'detail', v_promotion.detail,
                                          'runs', v_promotion.runs),
                       'promotion.published:' || v_promotion.id);
end;
$$;

revoke execute on function private.publish_promotion_template(uuid) from public, anon;
grant execute on function private.publish_promotion_template(uuid) to authenticated;

-- The console's call, a security-invoker wrapper as the Supabase advisors accept it.
create function public.publish_promotion_template(p_promotion_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.publish_promotion_template(p_promotion_id); $$;

revoke execute on function public.publish_promotion_template(uuid) from public, anon;
grant execute on function public.publish_promotion_template(uuid) to authenticated;

-- Adds the templates a venue does not have yet, as drafts; a venue's tiers name the graduate's.
create function private.add_promotion_templates(p_venue_id uuid)
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
    (p_venue_id, 'high_hands', 'High hands', 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', 'Every night', null, null),
    (p_venue_id, 'bad_beat', 'Bad-beat jackpot', 'The pool pays the losing hand, the winner and the table', 'Every night', null, null),
    (p_venue_id, 'referral', 'Referral', '₹1,000 to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '₹1,000 on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'rivr_rewards', 'RIVR Rewards', '5% of your rake back as points', 'Every game', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'ladies_night', 'Ladies'' Night', 'An evening for women players', null, null, null),
    (p_venue_id, 'league', 'RIVR League', 'Points from cash games and tournaments, a champion each season', 'Every month', null, null),
    (p_venue_id, 'sunday_guarantee', 'RIVR Sunday', '₹5,00,000 guaranteed', 'Sundays', null, null)
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
end;
$$;

revoke execute on function private.add_promotion_templates(uuid) from public, anon, authenticated;

select private.add_promotion_templates(v.id) from public.venue v;

-- Lane 0's bootstrap_venue, as the SOP library left it, now adding the promotion templates too.
create or replace function private.bootstrap_venue(
  p_venue_id uuid,
  p_name text,
  p_slug text,
  p_is_practice boolean,
  p_legal_name text,
  p_address text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, true, 'locked', '-infinity'
  from public.tier t cross join public.feature f
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);

  return p_venue_id;
end;
$$;
