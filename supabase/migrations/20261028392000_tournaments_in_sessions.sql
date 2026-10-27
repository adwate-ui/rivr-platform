-- Tournaments in a member's sessions (#549; the prototype's history has "RIVR Sunday · Tournament · 4th of 61"): each
-- finished tournament the member played is a session of its own, kind 'tournament', from when it started for them to
-- their last bust (or the finish), with what they paid in, won (a satellite's ticket among it) and had withheld, their
-- place and the field of runs. Tournament purchases are not cage transactions, so nothing is counted twice. The club month stays the night's start, as before
-- (decision 0262). Otherwise as 20261028391900_session_tds_basis.sql; cash sessions are kind 'cash'.
drop function public.my_sessions();
drop function private.my_sessions();

create function private.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text,
               kind text, place integer, entrants integer)
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
  me as (
    select private.current_member_id() as member_id
    where private.has_feature(private.current_member_id(), 'sessions.history')
  ),
  -- Each finished tournament the member played (an entry that sat, or a payout), from the later of the clock's start and
  -- their first buy (a Day 2 has none of its own) to their last bust, or the finish if they were still in. In: every buy
  -- of an entry not refunded, an entry paid with a satellite's ticket at its value. Won: prizes, bounties, and the
  -- tickets a satellite gave, which the target's buy or the ticket's refund then spends. And the TDS withheld.
  tournaments as (
    select t.id, t.name,
           greatest((select min(p.created_at) from public.tournament_purchase p where p.tournament_id = t.id and p.member_id = me.member_id),
                    t.clock_started_at) as opened_at,
           coalesce((select max(e.busted_at) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id
                       and e.status <> 'refunded' having bool_and(e.status = 'busted')), t.finished_at) as closed_at,
           (select coalesce(sum(p.price_paise), 0) from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
            where p.tournament_id = t.id and p.member_id = me.member_id and e.status <> 'refunded')::bigint as bought,
           (select coalesce(sum(o.prize_paise + o.bounty_paise), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint
           + (select coalesce(sum(k.value_paise), 0) from public.tournament_ticket k
              where k.satellite_id = t.id and k.member_id = me.member_id)::bigint as won,
           (select coalesce(sum(o.tds_paise) filter (where not o.is_tds_shadow), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint as tds,
           coalesce((select min(e.place) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status <> 'refunded'),
                    (select min(o.place) from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id and o.kind = 'prize')) as place,
           -- The field as places count it: every run, each entry not refunded.
           (select count(*) from public.tournament_entry e where e.tournament_id = t.id and e.status <> 'refunded')::integer as entrants
    from me
    join public.tournament t on t.finished_at is not null
      and (exists (select 1 from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status in ('seated', 'busted'))
           or exists (select 1 from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id))
  ),
  sessions as (
    select m.id, m.opened_at, m.closed_at, l.name, l.small_blind_paise, l.big_blind_paise, l.others, l.seconds,
           c.bought + k.markers as buy_in, c.bonus, c.cashed, c.tds, c.paid, c.cashed - c.tds - c.bought - k.markers as net,
           c.receipt, private.league_month(m.opened_at) as month, c.tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants
    from mine m
    join longest l on l.visit_id = m.id
    join cage c on c.visit_id = m.id
    join credit k on k.visit_id = m.id
    union all
    select t.id, t.opened_at, t.closed_at, t.name, 0::bigint, 0::bigint, 0, greatest(0, extract(epoch from t.closed_at - t.opened_at))::bigint,
           t.bought, 0::bigint, t.won, t.tds, t.won - t.tds, t.won - t.tds - t.bought, null::text, private.league_month(t.opened_at), null::text,
           'tournament'::text, t.place, t.entrants
    from tournaments t
  )
  select s.id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.others, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

create function public.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text,
               kind text, place integer, entrants integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_sessions(); $$;

revoke execute on function private.my_sessions(), public.my_sessions() from public, anon;
grant execute on function private.my_sessions(), public.my_sessions() to authenticated;
