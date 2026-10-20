-- Opening balances from the design prompt, posted as balanced ledger transactions. Each has an
-- idempotency key, so re-running the seed posts nothing new. Amounts in paise (points for points).

create function pg_temp.seed_account(p_venue_id uuid, p_code text, p_member_id uuid default null)
returns uuid
language sql
as $$
  select a.id from public.ledger_account a
  where a.venue_id = p_venue_id and a.code = p_code and a.member_id is not distinct from p_member_id;
$$;

create function pg_temp.seed_post(p_venue_id uuid, p_key text, p_debit uuid, p_credit uuid, p_amount bigint)
returns uuid
language sql
as $$
  select private.post_ledger_transaction(
    p_venue_id, 'opening_balance', p_key,
    jsonb_build_array(
      jsonb_build_object('account_id', p_debit, 'amount', p_amount::text),
      jsonb_build_object('account_id', p_credit, 'amount', (-p_amount)::text)), null);
$$;

do $$
declare
  gurugram constant uuid := '00000000-0000-4000-8000-000000000001';
  practice constant uuid := '00000000-0000-4000-8000-000000000002';
  arjun constant uuid := '00000000-0000-4000-8000-000000000201';
  asha constant uuid := '00000000-0000-4000-8000-000000000301';
begin
  -- Arjun Mehta: cash ₹1,85,000, bonus ₹4,000, an open marker of ₹50,000, 18,420 points.
  perform pg_temp.seed_post(gurugram, 'seed:arjun:cash',
    pg_temp.seed_account(gurugram, 'venue.opening_balance'), pg_temp.seed_account(gurugram, 'member.cash', arjun), 18500000);
  perform pg_temp.seed_post(gurugram, 'seed:arjun:bonus',
    pg_temp.seed_account(gurugram, 'venue.bonus_expense'), pg_temp.seed_account(gurugram, 'member.bonus', arjun), 400000);
  -- His bonus is one grant, ending at 23:59 on this week's Sunday (tonight, seeded on a Sunday): "expires Sunday".
  insert into public.bonus_grant (venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id)
  select gurugram, arjun, 400000, 400000,
         (date_trunc('week', now() at time zone 'Asia/Kolkata') + interval '6 days 23 hours 59 minutes') at time zone 'Asia/Kolkata',
         'Buy-in bonus Tuesday', 'seed:arjun:bonus', t.id
  from public.ledger_transaction t where t.venue_id = gurugram and t.idempotency_key = 'seed:arjun:bonus'
  on conflict (venue_id, idempotency_key) do nothing;
  perform pg_temp.seed_post(gurugram, 'seed:arjun:marker',
    pg_temp.seed_account(gurugram, 'member.receivable', arjun), pg_temp.seed_account(gurugram, 'venue.opening_balance'), 5000000);
  perform pg_temp.seed_post(gurugram, 'seed:arjun:points',
    pg_temp.seed_account(gurugram, 'venue.points_opening_balance'), pg_temp.seed_account(gurugram, 'member.points', arjun), 18420);
  -- Bad-beat jackpot ₹3,42,600.
  perform pg_temp.seed_post(gurugram, 'seed:jackpot:main',
    pg_temp.seed_account(gurugram, 'venue.opening_balance'), pg_temp.seed_account(gurugram, 'venue.jackpot.main'), 34260000);
  -- Practice venue: a trainee member with ₹50,000 to buy in with.
  perform pg_temp.seed_post(practice, 'seed:asha:cash',
    pg_temp.seed_account(practice, 'venue.opening_balance'), pg_temp.seed_account(practice, 'member.cash', asha), 5000000);
end;
$$;

-- Arjun's payout account (design prompt: "HDFC Bank, UPI verified"), verified by the cashier (#19).
insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, status, decided_at, decided_by_staff_id)
select s.venue_id, '00000000-0000-4000-8000-000000000201', 'upi', 'HDFC Bank', 'arjun.mehta@hdfcbank', 'verified', now() - interval '30 days', s.id
from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;
-- Vihaan Kapoor's UPI, verified: the Deposit flow's member pays from it (#29).
insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, status, decided_at, decided_by_staff_id)
select s.venue_id, '00000000-0000-4000-8000-000000000212', 'upi', 'Axis Bank', 'vihaan.kapoor@okaxis', 'verified', now() - interval '10 days', s.id
from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;