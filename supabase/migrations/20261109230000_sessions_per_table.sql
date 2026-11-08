-- A session per table (the owner, 9 Nov: "What happens when a player moves between tables? It should show each table as
-- separate sessions"). A member's sessions were one per visit, named by the table played longest with "and 1 more". Now
-- each table they sat at in a visit is a session of its own (`session_id`, from the visit and the table), from their first
-- seat there to the last time they left it, with the time played there; the month's count counts them. A visit's money
-- (no screen shows it) stays whole on its first table's row, so the month's net is unchanged. A tournament is a session
-- as before (`session_id` and `visit_id` its own id). Hiding takes a session's id; a visit's id, as hidden before, still
-- hides all of that visit's. As 20261028392000_tournaments_in_sessions.sql and 20261103200600 made them otherwise.

drop function public.my_sessions();
drop function private.my_sessions();

create function private.my_sessions()
returns table (session_id uuid, visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint,
               tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer,
               month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer)
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
  -- When the member sat at each table that visit: from their first seat there to the last time they left it (a move
  -- keeps one seat session across tables; private.session_tables splits it).
  stints as (
    select m.id as visit_id, t.o_table_id as table_id, min(greatest(t.o_from, m.opened_at)) as opened_at,
           max(least(t.o_to, m.closed_at)) as closed_at
    from mine m
    join public.seat_session s on s.visit_id = m.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < m.closed_at
    group by m.id, t.o_table_id
  ),
  -- Each table a session of its own (the owner, 9 Nov). A table sat at for under a minute in a visit of more than one
  -- (a move made by mistake and undone) is none, but a visit always keeps the table it was played at longest.
  kept as (
    select st.visit_id, st.table_id, st.opened_at, st.closed_at, coalesce(p.seconds, 0)::bigint as seconds,
           row_number() over (partition by st.visit_id order by coalesce(p.seconds, 0) desc, st.opened_at) = 1 as is_longest
    from stints st
    left join played p on p.visit_id = st.visit_id and p.table_id = st.table_id
  ),
  -- The visit's first session carries its money.
  tabled as (
    select k.visit_id, k.table_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, k.seconds,
           case when row_number() over (partition by k.visit_id order by k.opened_at, g.name) = 1 then 1 else 0 end as share
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where k.seconds >= 60 or k.is_longest
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
    select md5(m.id::text || ':' || l.table_id::text)::uuid as session_id, m.id as visit_id, l.opened_at, l.closed_at, l.name,
           l.small_blind_paise, l.big_blind_paise, l.seconds,
           (c.bought + k.markers) * l.share as buy_in, c.bonus * l.share as bonus, c.cashed * l.share as cashed, c.tds * l.share as tds,
           c.paid * l.share as paid, (c.cashed - c.tds - c.bought - k.markers) * l.share as net,
           case when l.share = 1 then c.receipt end as receipt, private.league_month(l.opened_at) as month,
           case when l.share = 1 then c.tds_basis end as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants
    from mine m
    join tabled l on l.visit_id = m.id
    join cage c on c.visit_id = m.id
    join credit k on k.visit_id = m.id
    union all
    select t.id, t.id, t.opened_at, t.closed_at, t.name, 0::bigint, 0::bigint, greatest(0, extract(epoch from t.closed_at - t.opened_at))::bigint,
           t.bought, 0::bigint, t.won, t.tds, t.won - t.tds, t.won - t.tds - t.bought, null::text, private.league_month(t.opened_at), null::text,
           'tournament'::text, t.place, t.entrants
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

create function public.my_sessions()
returns table (session_id uuid, visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint,
               tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer,
               month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer)
language sql stable security invoker set search_path = ''
as $$
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.table_name, s.small_blind_paise, s.big_blind_paise, s.played_seconds,
         s.buy_in_paise, s.bonus_paise, s.cash_out_paise, s.tds_paise, s.paid_paise, s.net_paise, s.receipt, s.month,
         (count(*) over w)::integer, (sum(s.played_seconds) over w)::bigint, (sum(s.net_paise) over w)::bigint,
         s.tds_basis, s.kind, s.place, s.entrants
  from private.my_sessions() s
  cross join lateral (select coalesce((select p.hidden_sessions from public.member_preference p where p.member_id = private.current_member_id()), '{}')
                      as ids) h
  where not (s.session_id = any (h.ids) or s.visit_id = any (h.ids))
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

revoke execute on function private.my_sessions(), public.my_sessions() from public, anon;
grant execute on function private.my_sessions(), public.my_sessions() to authenticated;

-- As 20261029100000_player_sessions_hidden.sql made it, taking a session's id (or a whole visit's).
create or replace function private.hide_my_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'sessions.history') then
    raise exception 'Only a member with session history hides a session' using errcode = '42501';
  end if;
  if p_session_id is null
     or not exists (select 1 from private.my_sessions() s where s.session_id = p_session_id or s.visit_id = p_session_id) then
    raise exception 'One of your sessions to hide' using errcode = '22023';
  end if;
  insert into public.member_preference (member_id, venue_id, hidden_sessions)
  values (v_member_id, v_venue_id, array[p_session_id])
  on conflict (member_id) do update
    set hidden_sessions = case when p_session_id = any (public.member_preference.hidden_sessions) then public.member_preference.hidden_sessions
                               else public.member_preference.hidden_sessions || p_session_id end;
end;
$$;
