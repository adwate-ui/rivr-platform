-- The tournament accounts (#118, decision 0203) and lane A's private.debit_wallet, built here at lane A's
-- word: every venue gets venue.tournament_pool (players' money until the prizes are paid),
-- venue.tournament_fees (the club's revenue, which the nightly rake's GST invoice covers from #469, as the
-- owner answered #465) and venue.tournament_overlay (what the club adds to reach a guarantee).

insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, a.code, a.name, a.kind::public.ledger_account_kind, 'paise', a.is_players_money
from public.venue v
cross join (values ('venue.tournament_pool', 'Tournament prize pools', 'liability', true),
                   ('venue.tournament_fees', 'Tournament fees', 'revenue', false),
                   ('venue.tournament_overlay', 'Tournament overlay', 'expense', false)) as a (code, name, kind, is_players_money)
on conflict do nothing;

-- Lane 0's bootstrap_venue, as the promotion templates left it, now opening the tournament accounts too.
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
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
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

-- Moves a member's wallet cash to the venue accounts in p_to ([{"code": ..., "amount": paise}, ...]),
-- which add up to p_amount, as one ledger transaction of kind p_reason, once per p_idempotency_key (a
-- replay gives the first transaction). The buy-in path's checks: no such member here (RVNOM), a frozen
-- venue or member (RVFRZ), an identity check not passed (as the cage refuses), a break or self-exclusion
-- (RVBRK), and too little cash (RVSHT). Gives the ledger transaction.
create function private.debit_wallet(p_venue_id uuid, p_member_id uuid, p_amount bigint, p_reason text, p_idempotency_key text,
                                     p_to jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb := (select jsonb_agg(l.line) from (
       select jsonb_build_object('account_id', a.id, 'amount', p_amount::text) as line
       from public.ledger_account a where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.cash'
       union all
       select jsonb_build_object('account_id', a.id, 'amount', (-(t.value ->> 'amount')::bigint)::text)
       from jsonb_array_elements(p_to) t join public.ledger_account a on a.venue_id = p_venue_id and a.member_id is null and a.code = t.value ->> 'code'
     ) l);
  -- The same request again gives its transaction, whatever the wallet holds now; another with its id is refused.
  v_replay uuid := private.find_ledger_replay(p_venue_id, p_idempotency_key, p_reason, v_lines, null);
begin
  if v_replay is not null then
    return v_replay;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> (select sum((l.value ->> 'amount')::bigint) from jsonb_array_elements(p_to) l) then
    raise exception 'An amount above nothing, all of it to the venue' using errcode = '22023';
  end if;
  -- One wallet movement at a time per member, after any break or freeze committed meanwhile.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_kyc_for_cage(p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: no buy-ins until it ends' using errcode = 'RVBRK';
  end if;
  if private.wallet_cash(p_member_id) < p_amount then
    raise exception 'Not enough cash in the wallet' using errcode = 'RVSHT';
  end if;
  return private.post_ledger_transaction(p_venue_id, p_reason, p_idempotency_key, v_lines, null, p_reason);
end;
$$;


revoke execute on function private.debit_wallet(uuid, uuid, bigint, text, text, jsonb) from public, anon, authenticated;

-- Every venue has the tournament accounts, and the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
