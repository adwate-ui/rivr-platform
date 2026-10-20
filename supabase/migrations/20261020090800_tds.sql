-- The TDS engine (#22; scope-v1 module 5, "TDS engine"; decision 0068, question #369). tds.config holds the
-- switch and the parameters, effective-dated. Every cash-out computes TDS on the period's net winnings:
-- withheld from what the member gets while the switch is on (to venue.tds_payable), recorded as shadow
-- while it is off, so a ruling that lands later is a report, not a reconstruction.

insert into public.setting_key (key, description, scope, value_schema) values
  ('tds.config',
   'TDS on winnings (scope-v1 module 5, "TDS engine"): the switch (while off, every cash-out still records shadow TDS), the section, the rate in basis points (3000 is 30%), the threshold the period''s net winnings must exceed, the basis (per session, day or financial year), and whether a PAN must be on record, with the rate for a member without one.',
   'venue',
   '{"type":"object","properties":{"enabled":{"type":"boolean"},"section":{"type":"string","pattern":"^[0-9]{3}[A-Z]{0,2}$"},"rate_basis_points":{"type":"integer","minimum":0,"maximum":10000},"threshold_paise":{"type":"integer","minimum":0,"maximum":10000000000},"basis":{"type":"string","enum":["session","day","financial_year"]},"pan_required":{"type":"boolean"},"no_pan_rate_basis_points":{"type":"integer","minimum":0,"maximum":10000}},"required":["enabled","section","rate_basis_points","threshold_paise","basis","pan_required","no_pan_rate_basis_points"],"additionalProperties":false}');

-- What is withheld is the government's until paid over.
insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money)
select v.id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false from public.venue v
on conflict (venue_id, code, member_id) do nothing;

-- Shadow TDS from day one (scope-v1 module 5): every venue starts switched off, under 194B at 30% of a
-- financial year's net winnings above ₹10,000, until the owner sets their own (question #369).
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'tds.config', '',
       '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
       '-infinity', 'Switched off until the owner sets TDS (#22)'
from public.venue v
on conflict (venue_id, key, subject, effective_from) do nothing;

-- A new venue gets the account and the switched-off parameters too: #21's bootstrap with two lines more.
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

  return p_venue_id;
end;
$$;

-- @rivr/domain tdsOnCashOut in SQL, proved on the same golden file (packages/testing/golden/tds.json,
-- 024_golden_twins): the rate (the no-PAN rate where a PAN is required and there is none), what the
-- period owes (nothing at or below the threshold, the rate of all of it above, down to the rupee), and
-- what this cash-out bears (that less what is recorded, never below nothing nor above the payout).
create function private.tds_amount(p_winnings bigint, p_already bigint, p_payout bigint, p_has_pan boolean, p_rate integer,
                                   p_threshold bigint, p_pan_required boolean, p_no_pan_rate integer)
returns table (rate_basis_points integer, due_paise bigint, amount_paise bigint)
language sql
immutable
set search_path = ''
as $$
  with rate as (select case when p_pan_required and not p_has_pan then p_no_pan_rate else p_rate end as bp),
  due as (select rate.bp, case when p_winnings > p_threshold then p_winnings * rate.bp / 10000 / 100 * 100 else 0 end as paise from rate)
  select due.bp, due.paise::bigint, least(greatest(due.paise - p_already, 0), p_payout)::bigint from due;
$$;

revoke execute on function private.tds_amount(bigint, bigint, bigint, boolean, integer, bigint, boolean, integer) from public, anon, authenticated;

create table public.tds_withholding (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  cage_transaction_id uuid not null unique references public.cage_transaction (id),
  -- The parameters in force at the cash-out.
  section text not null,
  basis text not null check (basis in ('session', 'day', 'financial_year')),
  period_start timestamptz not null,
  -- The period's net winnings with this cash-out, and the TDS recorded in it before.
  winnings_paise bigint not null,
  already_paise bigint not null check (already_paise >= 0),
  has_pan boolean not null,
  rate_basis_points integer not null check (rate_basis_points between 0 and 10000),
  due_paise bigint not null check (due_paise >= 0),
  amount_paise bigint not null check (amount_paise >= 0),
  -- Computed while the switch was off: nothing was withheld.
  is_shadow boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.tds_withholding is 'TDS on each cash-out (#22): the parameters, the period''s winnings, and what was withheld, or shadow while the switch is off.';

create index tds_withholding_member_idx on public.tds_withholding (member_id, created_at);
create index tds_withholding_venue_idx on public.tds_withholding (venue_id, created_at);
create trigger tds_withholding_append_only before update or delete on public.tds_withholding
  for each row execute function private.refuse_change();
create trigger tds_withholding_no_truncate before truncate on public.tds_withholding
  for each statement execute function private.refuse_change();
create trigger tds_withholding_audit after insert on public.tds_withholding
  for each row execute function private.audit_row_change();

alter table public.tds_withholding enable row level security;
grant select on public.tds_withholding to authenticated;
create policy "members see their own TDS" on public.tds_withholding
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "ledger readers see the venue's TDS" on public.tds_withholding
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- Where a member's TDS period began, by the basis: their visit (session), the venue's calendar day, or
-- the financial year from 1 April, on the venue's clock.
create function private.tds_period_start(p_venue_id uuid, p_member_id uuid, p_basis text, p_at timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case p_basis
    when 'session' then coalesce((select v.opened_at from public.visit v where v.member_id = p_member_id and v.closed_at is null), p_at)
    when 'day' then date_trunc('day', p_at at time zone z.tz) at time zone z.tz
    else make_date(extract(year from p_at at time zone z.tz)::integer - case when extract(month from p_at at time zone z.tz) < 4 then 1 else 0 end, 4, 1)::timestamp
         at time zone z.tz
  end
  from (select v.time_zone as tz from public.venue v where v.id = p_venue_id) z;
$$;

-- TDS on a cash-out: the parameters in force now, the period's net winnings with this cash-out (chips
-- cashed out less chips bought with cash, UPI or the wallet, and markers; a bonus is not the member's
-- money in), what the period already recorded, and what this cash-out bears. No row with no tds.config.
-- A visit that began before the period did counts whole: chips bought before midnight and cashed out
-- after it are not winnings, and what its earlier cash-outs recorded counts as recorded.
create function private.tds_on_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_payout_paise bigint)
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
                     where w.member_id = p_member_id and w.created_at >= config.since), 0)::bigint as already,
           exists (select 1 from public.kyc_record k where k.member_id = p_member_id and k.pan is not null) as has_pan
    from config
  )
  select p.value ->> 'section', p.value ->> 'basis', p.since, p.winnings, p.already, p.has_pan, t.rate_basis_points, t.due_paise, t.amount_paise,
         not (p.value -> 'enabled')::boolean
  from period p
  cross join lateral private.tds_amount(p.winnings, p.already, p_payout_paise, p.has_pan, (p.value -> 'rate_basis_points')::integer,
    (p.value -> 'threshold_paise')::bigint, (p.value -> 'pan_required')::boolean, (p.value -> 'no_pan_rate_basis_points')::integer) t;
$$;

revoke execute on function private.tds_period_start(uuid, uuid, text, timestamptz), private.tds_on_cash_out(uuid, uuid, bigint, bigint)
  from public, anon, authenticated;

-- The cash-out and what it gives now include the TDS withheld, so the cashier can say it (#22).
drop function public.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean);
drop function private.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean);
drop function private.cash_out_outcome(uuid);

-- What a cash-out gave: what it settled, what the member got, and the TDS withheld from it.
create function private.cash_out_outcome(p_cage_transaction_id uuid)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint, o_tds_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, coalesce(sum(s.amount_paise), 0)::bigint, c.amount_paise - coalesce(sum(s.amount_paise), 0)::bigint - w.withheld, w.withheld
  from public.cage_transaction c
  left join public.marker_settlement s on s.cage_transaction_id = c.id
  cross join lateral (select coalesce((select t.amount_paise from public.tds_withholding t where t.cage_transaction_id = c.id and not t.is_shadow), 0)::bigint
                      as withheld) w
  where c.id = p_cage_transaction_id
  group by c.id, c.amount_paise, w.withheld;
$$;

revoke execute on function private.cash_out_outcome(uuid) from public, anon, authenticated;

-- #58's cash-out, with TDS (#22, decision 0068): withheld from what the member gets while the switch is on,
-- recorded as shadow while it is off; nothing while no tds.config is set.
create function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                                 p_is_final boolean)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint, o_tds_paise bigint, o_is_visit_closed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_final boolean := coalesce(p_is_final, false);
  v_owed record;
  v_markers uuid[];
  v_owes bigint[];
  v_split record;
  v_settled bigint;
  v_tds record;
  v_withheld bigint;
  v_paid bigint;
  v_lines jsonb;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier cashes out' using errcode = '42501';
  end if;
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_to is null or p_to not in ('cash', 'wallet') then
    raise exception 'Cash out to cash or to the wallet' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A twin tap that waited on the lock is the same cash-out.
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_kyc_for_cage(p_member_id);
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: nothing to cash out' using errcode = 'RVOUT';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds using errcode = 'RVCTS';
  end if;
  select array_agg(k.id order by k.issued_at, k.id), array_agg(k.outstanding_paise order by k.issued_at, k.id) into v_markers, v_owes
  from (select k.id, k.issued_at, k.outstanding_paise from public.marker k
        where k.member_id = p_member_id and k.settled_at is null order by k.issued_at, k.id for update) k;
  select * into v_split from private.cash_out_split(p_amount_paise, v_owes);
  if v_split.to_member_paise is null then
    raise exception 'A cash-out is whole ₹50 chips' using errcode = 'RVCHP';
  end if;
  v_settled := coalesce((select sum(s) from unnest(v_split.settled_paise) s), 0);
  select * into v_tds from private.tds_on_cash_out(p_venue_id, p_member_id, p_amount_paise, v_split.to_member_paise);
  v_withheld := case when v_tds.is_shadow is false then v_tds.amount_paise else 0 end;
  v_paid := v_split.to_member_paise - v_withheld;
  v_lines := jsonb_build_array(jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                                                   and a.code = 'venue.chips_outstanding' and a.member_id is null),
                                                  'amount', p_amount_paise::text));
  if v_settled > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.receivable'),
                                             'amount', (-v_settled)::text);
  end if;
  if v_paid > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and (
                                                              (p_to = 'wallet' and a.code = 'member.cash' and a.member_id = p_member_id)
                                                              or (p_to = 'cash' and a.code = 'venue.cash_drawer' and a.member_id is null))),
                                             'amount', (-v_paid)::text);
  end if;
  if v_withheld > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                                              and a.code = 'venue.tds_payable' and a.member_id is null),
                                             'amount', (-v_withheld)::text);
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'cash_out', 'cash_out:' || p_idempotency_key, v_lines, null, 'Cash-out at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, session_id, ledger_transaction_id, cashier_staff_id,
                                       idempotency_key, is_final)
  values (p_venue_id, p_member_id, 'cash_out', p_to, p_amount_paise,
          (select s.id from public.seat_session s where s.member_id = p_member_id and s.ended_at is null), v_txn,
          private.current_staff_id(p_venue_id), p_idempotency_key, v_is_final)
  returning id into v_id;
  if v_tds.section is not null then
    insert into public.tds_withholding (venue_id, member_id, cage_transaction_id, section, basis, period_start, winnings_paise, already_paise,
                                        has_pan, rate_basis_points, due_paise, amount_paise, is_shadow)
    values (p_venue_id, p_member_id, v_id, v_tds.section, v_tds.basis, v_tds.period_start, v_tds.winnings_paise, v_tds.already_paise,
            v_tds.has_pan, v_tds.rate_basis_points, v_tds.due_paise, v_tds.amount_paise, v_tds.is_shadow);
  end if;
  for i in 1 .. coalesce(array_length(v_split.settled_paise, 1), 0) loop
    update public.marker
    set outstanding_paise = outstanding_paise - v_split.settled_paise[i],
        settled_at = case when v_split.settled_paise[i] = v_owes[i] then now() end
    where id = v_markers[i];
    insert into public.marker_settlement (venue_id, marker_id, cage_transaction_id, amount_paise)
    values (p_venue_id, v_markers[i], v_id, v_split.settled_paise[i]);
    if v_split.settled_paise[i] = v_owes[i] then
      perform private.emit(p_venue_id, 'marker.settled',
                           jsonb_build_object('marker_id', v_markers[i], 'member_id', p_member_id, 'cage_transaction_id', v_id),
                           'marker.settled:' || v_markers[i]);
    end if;
  end loop;
  perform private.emit(p_venue_id, 'cage.cash_out',
                       jsonb_build_object('cage_transaction_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise,
                                          'markers_settled_paise', v_settled, 'to_member_paise', v_paid,
                                          'tds_paise', v_withheld, 'to', p_to,
                                          'is_final', v_is_final),
                       'cage.cash_out:' || v_id);
  if v_is_final then
    perform private.leave_on_cash_out(p_member_id);
  end if;
  return query select v_id, v_settled, v_paid, v_withheld, private.current_visit(p_member_id) is null;
end;
$$;

revoke execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) from public, anon;
grant execute on function private.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) to authenticated;

create function public.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                     p_is_final boolean default false)
returns table (cage_transaction_id uuid, markers_settled_paise bigint, to_member_paise bigint, tds_paise bigint, is_visit_closed boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.cage_cash_out(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, p_is_final); $$;

revoke execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) from public, anon;
grant execute on function public.cage_cash_out(uuid, uuid, bigint, text, uuid, boolean) to authenticated;

-- TDS on winnings outside a cash-out, such as a tournament prize (lane B): the parameters in force at a
-- time on those winnings alone, and whether it is shadow. No row with no tds.config.
create function private.tds_for(p_venue_id uuid, p_member_id uuid, p_winnings_paise bigint, p_at timestamptz)
returns table (amount_paise bigint, is_shadow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.amount_paise, not (c.value -> 'enabled')::boolean
  from (select private.setting_at(p_venue_id, 'tds.config', '', p_at) as value) c
  cross join lateral private.tds_amount(p_winnings_paise, 0, greatest(p_winnings_paise, 0),
    exists (select 1 from public.kyc_record k where k.member_id = p_member_id and k.pan is not null), (c.value -> 'rate_basis_points')::integer,
    (c.value -> 'threshold_paise')::bigint, (c.value -> 'pan_required')::boolean, (c.value -> 'no_pan_rate_basis_points')::integer) t
  where c.value is not null;
$$;

revoke execute on function private.tds_for(uuid, uuid, bigint, timestamptz) from public, anon, authenticated;
