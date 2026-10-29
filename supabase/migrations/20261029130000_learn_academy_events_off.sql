-- Learn, Academy and Events off (owner, 29 Oct, #637; decision 0284). They are switched off by their feature keys,
-- learn.library (the Learn tab), academy.booking and events.book, for every tier of every venue from now, and a new
-- venue's tiers start with them off. A super admin turns one back on for a tier, as with any tier feature. Their
-- screens and data stay.

-- Every tier of an existing venue: off from now, and hidden rather than shown locked.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, false, 'hidden', now()
from public.tier t cross join (values ('learn.library'), ('academy.booking'), ('events.book')) as k (key);

-- As before (20261028350000_tournament_satellites.sql), with Learn, the Academy and Events off for a new venue.
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

  -- Every gateable feature for every tier, but Learn, the Academy and Events, which start off and hidden (#637).
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, not o.is_off, case when o.is_off then 'hidden' else 'locked' end::public.feature_display_mode, '-infinity'
  from public.tier t cross join public.feature f
  cross join lateral (select f.key in ('learn.library', 'academy.booking', 'events.book') as is_off) o
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
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.tournament_tickets', 'Satellite tickets held', 'liability', 'paise', true),
    (p_venue_id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false),
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
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$$;
