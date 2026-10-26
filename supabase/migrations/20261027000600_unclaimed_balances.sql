-- Unclaimed balances (#110; S-D1; decision 0230): the members who hold cash or bonus with the club and have
-- neither moved money themselves nor visited for the venue's period (reports.unclaimed_days, 365 days unless
-- set), the quietest first. Moving money means their cash, or a marker repaid; a bonus expiring or granted to
-- them is the club's doing, not theirs. One who never did either is seen when they joined. Staff who read
-- reports (reports.read).

insert into public.setting_key (key, description, scope, value_schema) values
  ('reports.unclaimed_days',
   'Unclaimed balances (decision 0230): a balance is unclaimed after this many days with no money moved and no visit. 365 unless set.',
   'venue',
   '{"type":"object","properties":{"days":{"type":"integer","minimum":30,"maximum":3650}},"required":["days"],"additionalProperties":false}');

create function private.unclaimed_balances(p_venue_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, cash_paise bigint, bonus_paise bigint, last_seen_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((private.setting_at(p_venue_id, 'reports.unclaimed_days', '', now()) ->> 'days')::integer, 365);
begin
  perform private.assert_reports(p_venue_id);
  return query
  with held as (
    select a.member_id,
           coalesce(-sum(e.amount) filter (where a.code = 'member.cash'), 0)::bigint as cash_paise,
           coalesce(-sum(e.amount) filter (where a.code = 'member.bonus'), 0)::bigint as bonus_paise
    from public.ledger_account a
    join public.ledger_entry e on e.account_id = a.id
    where a.venue_id = p_venue_id and a.code in ('member.cash', 'member.bonus')
    group by a.member_id
  ), seen as (
    select h.*, m.member_number, m.full_name,
           coalesce(greatest(
             (select max(t.occurred_at)
              from public.ledger_account a
              join public.ledger_entry e on e.account_id = a.id
              join public.ledger_transaction t on t.id = e.transaction_id
              where a.venue_id = p_venue_id and a.member_id = h.member_id and a.code in ('member.cash', 'member.receivable')),
             (select max(v.opened_at) from public.visit v where v.venue_id = p_venue_id and v.member_id = h.member_id)
           ), m.created_at) as last_seen_at
    from held h join public.member m on m.id = h.member_id
    where h.cash_paise > 0 or h.bonus_paise > 0
  )
  select s.member_id, s.member_number, s.full_name, s.cash_paise, s.bonus_paise, s.last_seen_at
  from seen s
  where s.last_seen_at < now() - make_interval(days => v_days)
  order by s.last_seen_at, s.member_number;
end;
$$;

create function public.unclaimed_balances(p_venue_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, cash_paise bigint, bonus_paise bigint, last_seen_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.unclaimed_balances(p_venue_id); $$;

revoke execute on function private.unclaimed_balances(uuid), public.unclaimed_balances(uuid) from public, anon;
grant execute on function private.unclaimed_balances(uuid), public.unclaimed_balances(uuid) to authenticated;
