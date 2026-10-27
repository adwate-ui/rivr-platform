-- A session's TDS basis (#563; the owner's answer to #548): my_sessions also gives the basis TDS was withheld on in the
-- visit (session, day or financial_year; null with none), so the detail can say when it was on the period's winnings
-- rather than the session's alone. Otherwise as before (20261028390200_my_sessions.sql).
drop function public.my_sessions();
drop function private.my_sessions();

create function private.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text)
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
           (array_agg(upper(left(c.id::text, 8)) order by c.created_at desc) filter (where c.kind = 'cash_out'))[1] as receipt,
           (array_agg(w.basis order by c.created_at desc) filter (where w.due_paise > 0))[1] as tds_basis
    from mine m
    left join public.cage_transaction c
      on c.member_id = m.member_id and c.kind in ('buy_in', 'cash_out') and c.created_at > m.opened_at and c.created_at <= m.closed_at
    left join lateral private.cash_out_outcome(c.id) o on c.kind = 'cash_out'
    left join public.tds_withholding w on w.cage_transaction_id = c.id
    group by m.id
  ),
  credit as (
    select m.id as visit_id, coalesce(sum(k.amount_paise), 0)::bigint as markers
    from mine m
    left join public.marker k on k.member_id = m.member_id and k.issued_at > m.opened_at and k.issued_at <= m.closed_at
    group by m.id
  ),
  sessions as (
    select m.id, m.opened_at, m.closed_at, l.name, l.small_blind_paise, l.big_blind_paise, l.others, l.seconds,
           c.bought + k.markers as buy_in, c.bonus, c.cashed, c.tds, c.paid, c.cashed - c.tds - c.bought - k.markers as net,
           c.receipt, private.league_month(m.opened_at) as month, c.tds_basis
    from mine m
    join longest l on l.visit_id = m.id
    join cage c on c.visit_id = m.id
    join credit k on k.visit_id = m.id
  )
  select s.id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.others, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

create function public.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_sessions(); $$;

revoke execute on function private.my_sessions(), public.my_sessions() from public, anon;
grant execute on function private.my_sessions(), public.my_sessions() to authenticated;
