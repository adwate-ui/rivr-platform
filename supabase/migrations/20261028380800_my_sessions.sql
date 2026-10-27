-- A member's own sessions (#127): each closed visit at which they sat, newest first, with the table they played longest
-- (and how many others), the hours, what went in and came out, the TDS withheld, and the club month's totals.
--   * A visit's money is every buy-in, cash-out and marker of the member's from check-in to check-out: a cash-out after
--     their last seat ended has no seat to tie it to.
--   * Net is what came out, less the TDS withheld and what went in. What went in counts chips on credit (markers) and
--     not bonus chips, as net winnings do for TDS (20261020090800_tds.sql); bonus chips show on their own.
--   * Paid is what the cage handed over: the cash-outs less the markers they settled and the TDS.
--   * The receipt is the last cash-out's, as the cage printed it: the first eight characters of its id.
--   * The month is the club's: a night that runs past midnight belongs to the day it began (06:00 to 06:00 IST).
-- Gated by tier (sessions.history): without it a member reads no history.
create function private.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v
    where v.member_id = private.current_member_id() and v.closed_at is not null
      and private.has_feature(v.member_id, 'sessions.history')
  ),
  played as (
    select m.id as visit_id, t.o_table_id as table_id, sum(t.o_played)::bigint as seconds
    from mine m
    cross join lateral private.visit_table_time(m.id) t
    group by m.id, t.o_table_id
  ),
  longest as (
    select distinct on (p.visit_id) p.visit_id, g.name, tt.small_blind_paise, tt.big_blind_paise,
           (count(*) over (partition by p.visit_id) - 1)::integer as others,
           sum(p.seconds) over (partition by p.visit_id)::bigint as seconds
    from played p
    join public.game_table g on g.id = p.table_id
    join public.table_type tt on tt.id = g.table_type_id
    order by p.visit_id, p.seconds desc, g.name
  ),
  cage as (
    select m.id as visit_id,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'buy_in' and c.method <> 'bonus'), 0)::bigint as bought,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'buy_in' and c.method = 'bonus'), 0)::bigint as bonus,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'cash_out'), 0)::bigint as cashed,
           coalesce(sum(o.o_tds_paise), 0)::bigint as tds,
           coalesce(sum(o.o_to_member_paise), 0)::bigint as paid,
           (array_agg(upper(left(c.id::text, 8)) order by c.created_at desc) filter (where c.kind = 'cash_out'))[1] as receipt
    from mine m
    left join public.cage_transaction c
      on c.member_id = m.member_id and c.kind in ('buy_in', 'cash_out') and c.created_at between m.opened_at and m.closed_at
    left join lateral private.cash_out_outcome(c.id) o on c.kind = 'cash_out'
    group by m.id
  ),
  credit as (
    select m.id as visit_id, coalesce(sum(k.amount_paise), 0)::bigint as markers
    from mine m
    left join public.marker k on k.member_id = m.member_id and k.issued_at between m.opened_at and m.closed_at
    group by m.id
  ),
  sessions as (
    select m.id, m.opened_at, m.closed_at, l.name, l.small_blind_paise, l.big_blind_paise, l.others, l.seconds,
           c.bought + k.markers as buy_in, c.bonus, c.cashed, c.tds, c.paid, c.cashed - c.tds - c.bought - k.markers as net,
           c.receipt, date_trunc('month', (m.opened_at at time zone 'Asia/Kolkata') - interval '6 hours')::date as month
    from mine m
    join longest l on l.visit_id = m.id
    join cage c on c.visit_id = m.id
    join credit k on k.visit_id = m.id
  )
  select s.id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.others, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

create function public.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_sessions(); $$;

revoke execute on function private.my_sessions(), public.my_sessions() from public, anon;
grant execute on function private.my_sessions(), public.my_sessions() to authenticated;
