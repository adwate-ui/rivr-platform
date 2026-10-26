-- Tournament prize and bounty TDS in the TDS ledger (#477; decision 0233). Tournaments pay each prize and bounty
-- after TDS on that payment alone (decision 0205), and kept the TDS on the payout only, so the TDS ledger, the
-- quarterly return and members' certificates left it out. Each payout now records its TDS in tds_withholding too,
-- as a cash-out does: the section, whether the member had a PAN, the rate, the winnings (prize and bounty), and
-- what was withheld, or shadow while TDS is switched off. A cash-out's period still counts only cash-outs' TDS:
-- a prize is taxed on its own, so it neither raises nor lowers what a cash-out bears.

alter table public.tds_withholding alter column cage_transaction_id drop not null;
alter table public.tds_withholding add column tournament_payout_id uuid unique references public.tournament_payout (id);
alter table public.tds_withholding add constraint tds_withholding_one_source
  check (num_nonnulls(cage_transaction_id, tournament_payout_id) = 1);
-- A payment taxed alone has no period: it is its own.
alter table public.tds_withholding drop constraint tds_withholding_basis_check;
alter table public.tds_withholding add constraint tds_withholding_basis_check
  check (basis in ('session', 'day', 'financial_year', 'payment'));
comment on table public.tds_withholding is 'TDS on each cash-out (#22) and each tournament prize or bounty (#477): the parameters, the winnings, and what was withheld, or shadow while the switch is off.';

-- Records one tournament payout's TDS, as private.tournament_prize_tds worked it out when it was paid: on the prize
-- and bounty alone, with the parameters in force then. Nothing while no tds.config was set, or for nothing won.
create function private.record_tournament_payout_tds(p_payout_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tds_withholding (venue_id, member_id, tournament_payout_id, section, basis, period_start, winnings_paise, already_paise,
                                      has_pan, rate_basis_points, due_paise, amount_paise, is_shadow, created_at)
  select p.venue_id, p.member_id, p.id, c.value ->> 'section', 'payment', p.created_at, p.prize_paise + p.bounty_paise, 0,
         pan.has_pan, t.rate_basis_points, t.due_paise, p.tds_paise, p.is_tds_shadow, p.created_at
  from public.tournament_payout p
  cross join lateral (select private.setting_at(p.venue_id, 'tds.config', '', p.created_at) as value) c
  cross join lateral (select exists (select 1 from public.kyc_record k where k.member_id = p.member_id and k.pan is not null) as has_pan) pan
  cross join lateral private.tds_amount(p.prize_paise + p.bounty_paise, 0, p.prize_paise + p.bounty_paise, pan.has_pan,
    (c.value -> 'rate_basis_points')::integer, (c.value -> 'threshold_paise')::bigint, (c.value -> 'pan_required')::boolean,
    (c.value -> 'no_pan_rate_basis_points')::integer) t
  where p.id = p_payout_id and c.value is not null and p.prize_paise + p.bounty_paise > 0;
$$;

-- Every payout records its TDS as it is paid; a practice reset reloads both tables from the seed, so not then.
create function private.record_tournament_tds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.purging(new.venue_id), false) then
    perform private.record_tournament_payout_tds(new.id);
  end if;
  return null;
end;
$$;

revoke execute on function private.record_tournament_payout_tds(uuid), private.record_tournament_tds() from public, anon, authenticated;

create trigger tournament_payout_tds after insert on public.tournament_payout
  for each row execute function private.record_tournament_tds();

-- Payouts made before today: whether the member had a PAN is as it is now.
select private.record_tournament_payout_tds(p.id) from public.tournament_payout p
where not exists (select 1 from public.tds_withholding w where w.tournament_payout_id = p.id);

-- TDS on a cash-out, as before (#22, decision 0068), but what the period already recorded counts cash-outs only.
create or replace function private.tds_on_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_payout_paise bigint)
returns table (section text, basis text, period_start timestamptz, winnings_paise bigint, already_paise bigint, has_pan boolean,
               rate_basis_points integer, due_paise bigint, amount_paise bigint, is_shadow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with config as (
    select c.value, least(private.tds_period_start(p_venue_id, p_member_id, c.value ->> 'basis', now()),
                          (select v.opened_at from public.visit v where v.member_id = p_member_id and v.closed_at is null)) as since
    from (select private.setting_at(p_venue_id, 'tds.config', '', now()) as value) c
    where c.value is not null
  ),
  period as (
    select config.value, config.since,
           (coalesce((select sum(t.amount_paise) from public.cage_transaction t
                      where t.member_id = p_member_id and t.kind = 'cash_out' and t.created_at >= config.since), 0)
            + p_amount_paise
            - coalesce((select sum(t.amount_paise) from public.cage_transaction t
                        where t.member_id = p_member_id and t.kind = 'buy_in' and t.method <> 'bonus' and t.created_at >= config.since), 0)
            - coalesce((select sum(k.amount_paise) from public.marker k where k.member_id = p_member_id and k.issued_at >= config.since), 0))::bigint as winnings,
           coalesce((select sum(w.amount_paise) from public.tds_withholding w
                     where w.member_id = p_member_id and w.cage_transaction_id is not null and w.created_at >= config.since), 0)::bigint as already,
           exists (select 1 from public.kyc_record k where k.member_id = p_member_id and k.pan is not null) as has_pan
    from config
  )
  select p.value ->> 'section', p.value ->> 'basis', p.since, p.winnings, p.already, p.has_pan, t.rate_basis_points, t.due_paise, t.amount_paise,
         not (p.value -> 'enabled')::boolean
  from period p
  cross join lateral private.tds_amount(p.winnings, p.already, p_payout_paise, p.has_pan, (p.value -> 'rate_basis_points')::integer,
    (p.value -> 'threshold_paise')::bigint, (p.value -> 'pan_required')::boolean, (p.value -> 'no_pan_rate_basis_points')::integer) t;
$$;

-- The reports count payments now, cash-outs and tournament payouts: what each paid is the chips cashed out, or the
-- prize and bounty won.
drop function public.tds_ledger(uuid, date, date);
drop function private.tds_ledger(uuid, date, date);
drop function public.my_tds_certificates();
drop function private.my_tds_certificates();

-- The withholding ledger (#93): each member's TDS from the start of `p_from` up to the end of `p_to` (India's
-- days): the payments that recorded it, what they paid, what was withheld, and what would have been while TDS was
-- switched off. The PAN shows its last four characters only. For ledger readers.
create function private.tds_ledger(p_venue_id uuid, p_from date, p_to date)
returns table (member_id uuid, full_name text, member_number bigint, pan_last4 text, payments integer, paid_paise bigint,
               withheld_paise bigint, shadow_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, m.member_number, right(k.pan, 4), count(*)::integer,
         sum(coalesce(c.amount_paise, p.prize_paise + p.bounty_paise))::bigint,
         coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0)::bigint,
         coalesce(sum(w.amount_paise) filter (where w.is_shadow), 0)::bigint
  from public.tds_withholding w
  left join public.cage_transaction c on c.id = w.cage_transaction_id
  left join public.tournament_payout p on p.id = w.tournament_payout_id
  join public.member m on m.id = w.member_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where w.venue_id = p_venue_id and private.has_permission(p_venue_id, 'ledger.read')
    and w.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and w.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
  group by m.id, m.full_name, m.member_number, k.pan
  order by coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0) desc, m.full_name;
$$;

-- The quarterly return extract (#93), as before, with tournament payouts: a prize or bounty is taxed on what it
-- won alone, and a cash-out on its period's winnings above what earlier cash-outs in the period were taxed on.
create or replace function private.tds_return_extract(p_venue_id uuid, p_quarter_start date)
returns table (deducted_at timestamptz, full_name text, pan text, section text, taxed_winnings_paise bigint, rate_basis_points integer,
               tds_paise bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'exports.table') then
    raise exception 'Only staff who export tables take the TDS return' using errcode = '42501';
  end if;
  if p_quarter_start is null or date_trunc('quarter', p_quarter_start)::date <> p_quarter_start
     or exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'A quarter''s first day, at a venue that files returns' using errcode = '22023';
  end if;
  perform private.audit(p_venue_id, 'export.tds_return', 'tds_withholding', p_quarter_start::text);
  return query
  select w.created_at, m.full_name, coalesce(k.pan, 'PANNOTAVBL'), w.section,
         case when w.tournament_payout_id is not null then w.winnings_paise
              else private.tds_taxed_winnings(w.winnings_paise, coalesce((
                     select max(p.winnings_paise) from public.tds_withholding p
                     where p.member_id = w.member_id and p.cage_transaction_id is not null and p.created_at >= w.period_start and p.due_paise > 0
                       and (p.created_at, p.already_paise) < (w.created_at, w.already_paise)), 0)) end,
         w.rate_basis_points, w.amount_paise
  from public.tds_withholding w
  join public.member m on m.id = w.member_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where w.venue_id = p_venue_id and not w.is_shadow and w.amount_paise > 0
    and private.tds_quarter_start(w.created_at) = p_quarter_start
  order by w.created_at, w.id;
end;
$$;

-- Certificate data (#93): the signed-in member's TDS withheld, by venue, quarter and section, from cash-outs and
-- tournament payouts, with the deductor's name and TAN and the last four characters of their PAN.
create function private.my_tds_certificates()
returns table (venue_id uuid, legal_name text, tan text, quarter_start date, section text, pan_last4 text, payments integer,
               paid_paise bigint, tds_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.venue_id, vc.legal_name, vc.tan, private.tds_quarter_start(w.created_at), w.section, right(k.pan, 4), count(*)::integer,
         sum(coalesce(c.amount_paise, p.prize_paise + p.bounty_paise))::bigint, sum(w.amount_paise)::bigint
  from public.member m
  join public.tds_withholding w on w.member_id = m.id
  left join public.cage_transaction c on c.id = w.cage_transaction_id
  left join public.tournament_payout p on p.id = w.tournament_payout_id
  join public.venue_config vc on vc.venue_id = w.venue_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where m.user_id = (select auth.uid()) and not w.is_shadow and w.amount_paise > 0
  group by w.venue_id, vc.legal_name, vc.tan, private.tds_quarter_start(w.created_at), w.section, k.pan
  order by 4 desc, 2;
$$;

create function public.tds_ledger(p_venue_id uuid, p_from date, p_to date)
returns table (member_id uuid, full_name text, member_number bigint, pan_last4 text, payments integer, paid_paise bigint,
               withheld_paise bigint, shadow_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tds_ledger(p_venue_id, p_from, p_to); $$;
create function public.my_tds_certificates()
returns table (venue_id uuid, legal_name text, tan text, quarter_start date, section text, pan_last4 text, payments integer,
               paid_paise bigint, tds_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tds_certificates(); $$;

revoke execute on function private.tds_ledger(uuid, date, date), private.my_tds_certificates(), public.tds_ledger(uuid, date, date),
  public.my_tds_certificates() from public, anon;
grant execute on function private.tds_ledger(uuid, date, date), private.my_tds_certificates(), public.tds_ledger(uuid, date, date),
  public.my_tds_certificates() to authenticated;

-- The backfill adds rows to a table the practice reset reloads, and a column without a default (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
