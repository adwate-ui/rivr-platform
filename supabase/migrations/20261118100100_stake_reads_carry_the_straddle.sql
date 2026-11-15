-- A stake's straddle reaches every screen that names a stake (redesign of 15 Nov 2026, RD-17 follow-up, issue 990): the
-- owner's rule is that a stake with a straddle is written with it, "NLH 100/200/500", wherever a stake or a table's stake
-- is named. Six reads named a stake without it; each now returns the stake's straddle, and its game where the screen
-- writes the game before the figures. The new columns come last, so a caller that reads by name is unchanged.
--
-- Each function is as the newest migration before this one left it, with those columns added. What a function returns
-- cannot be changed in place, so each is dropped and made again, with its grants. Written by a script from the
-- database's own definitions (hence the layout of each definition).

-- The member's places on tonight's lists, each with its stake's game and straddle.
drop function public.my_waitlist();
drop function private.my_waitlist();
CREATE OR REPLACE FUNCTION private.my_waitlist()
 RETURNS TABLE(entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, joined_at timestamp with time zone, place integer, call_table_name text, call_seat integer, hold_until timestamp with time zone, away_until timestamp with time zone, is_request boolean, table_id uuid, table_name text, called_at timestamp with time zone, on_way_at timestamp with time zone, game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, e.joined_at, r.place, ct.name, e.call_seat, e.hold_until,
         private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.approved_at is null, e.table_id, asked.name, e.called_at,
         case when e.on_way_at >= e.called_at then e.on_way_at end, t.game, t.straddle_paise
  from public.waitlist_entry e
  join public.table_type t on t.id = e.table_type_id
  left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
  left join public.game_table ct on ct.id = e.call_table_id
  left join public.game_table asked on asked.id = e.table_id
  where e.member_id = private.current_member_id() and e.status = 'waiting' and e.joined_at >= private.tonight_began(now())
  order by e.joined_at;
$function$;

CREATE OR REPLACE FUNCTION public.my_waitlist()
 RETURNS TABLE(entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, joined_at timestamp with time zone, place integer, call_table_name text, call_seat integer, hold_until timestamp with time zone, away_until timestamp with time zone, is_request boolean, table_id uuid, table_name text, called_at timestamp with time zone, on_way_at timestamp with time zone, game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.my_waitlist(); $function$;

revoke execute on function private.my_waitlist(), public.my_waitlist() from public, anon;
grant execute on function private.my_waitlist(), public.my_waitlist() to authenticated;

-- The member's seat, with its stake's game and straddle.
drop function public.my_seat();
drop function private.my_seat();
CREATE OR REPLACE FUNCTION private.my_seat()
 RETURNS TABLE(table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer, is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamp with time zone, call_time_ends_at timestamp with time zone, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer, add_time_choices integer[], game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.name, s.seat, s.away_since is not null, s.call_time_minutes > 0,
         case when f.sees_call_time then private.session_call_time(s, now()) end,
         floor(extract(epoch from now() - s.started_at))::integer, s.leaving_at is not null, private.top_up_state(s),
         case when f.sees_call_time then s.call_time_minutes end, s.started_at,
         case when f.sees_call_time and s.call_time_minutes > 0 and s.away_since is null
              then now() + make_interval(secs => private.session_call_time(s, now())) end,
         t.name, t.small_blind_paise, t.big_blind_paise,
         (select r.minutes from public.call_time_request r where r.session_id = s.id and r.status = 'requested'),
         private.add_time_choices(s.venue_id), t.game, t.straddle_paise
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type t on t.id = g.table_type_id
  cross join lateral (select private.has_feature(s.member_id, 'call_time.view') as sees_call_time) f
  where s.member_id = private.current_member_id() and s.ended_at is null;
$function$;

CREATE OR REPLACE FUNCTION public.my_seat()
 RETURNS TABLE(table_name text, seat integer, is_away boolean, has_call_time boolean, call_time_left integer, played_seconds integer, is_leaving boolean, top_up text, call_time_minutes integer, started_at timestamp with time zone, call_time_ends_at timestamp with time zone, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, time_request_minutes integer, add_time_choices integer[], game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.my_seat(); $function$;

revoke execute on function private.my_seat(), public.my_seat() from public, anon;
grant execute on function private.my_seat(), public.my_seat() to authenticated;

-- The member's past sessions: a cash session with the straddle of the stake it was played at; a tournament has none.
drop function public.my_sessions();
drop function private.my_sessions();
CREATE OR REPLACE FUNCTION private.my_sessions()
 RETURNS TABLE(session_id uuid, visit_id uuid, opened_at timestamp with time zone, closed_at timestamp with time zone, table_name text, small_blind_paise bigint, big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  tabled as (
    select k.visit_id, k.table_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, tt.straddle_paise, k.seconds
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where k.seconds >= 60 or k.is_longest
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
           0::bigint as buy_in, 0::bigint as bonus, 0::bigint as cashed, 0::bigint as tds,
           0::bigint as paid, 0::bigint as net,
           null::text as receipt, private.club_month(l.opened_at) as month,
           null::text as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants, l.straddle_paise as straddle
    from mine m
    join tabled l on l.visit_id = m.id
    union all
    select t.id, t.id, t.opened_at, t.closed_at, t.name, 0::bigint, 0::bigint, greatest(0, extract(epoch from t.closed_at - t.opened_at))::bigint,
           t.bought, 0::bigint, t.won, t.tds, t.won - t.tds, t.won - t.tds - t.bought, null::text, private.club_month(t.opened_at), null::text,
           'tournament'::text, t.place, t.entrants, null::bigint
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants, s.straddle
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.my_sessions()
 RETURNS TABLE(session_id uuid, visit_id uuid, opened_at timestamp with time zone, closed_at timestamp with time zone, table_name text, small_blind_paise bigint, big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.table_name, s.small_blind_paise, s.big_blind_paise, s.played_seconds,
         s.buy_in_paise, s.bonus_paise, s.cash_out_paise, s.tds_paise, s.paid_paise, s.net_paise, s.receipt, s.month,
         (count(*) over w)::integer, (sum(s.played_seconds) over w)::bigint, (sum(s.net_paise) over w)::bigint,
         s.tds_basis, s.kind, s.place, s.entrants, s.straddle_paise
  from private.my_sessions() s
  cross join lateral (select coalesce((select p.hidden_sessions from public.member_preference p where p.member_id = private.current_member_id()), '{}')
                      as ids) h
  where not (s.session_id = any (h.ids) or s.visit_id = any (h.ids))
  window w as (partition by s.month)
  order by s.opened_at desc;
$function$;

revoke execute on function private.my_sessions(), public.my_sessions() from public, anon;
grant execute on function private.my_sessions(), public.my_sessions() to authenticated;

-- The TV's waitlist board, each table with its stake's game and straddle.
drop function public.tv_waitlist_board();
drop function private.tv_waitlist_board();
CREATE OR REPLACE FUNCTION private.tv_waitlist_board()
 RETURNS TABLE(table_id uuid, table_name text, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, is_open boolean, place integer, display_name text, call_table_name text, is_away boolean, game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with tables as (select g.* from public.game_table g where g.venue_id = private.tv_showing('waitlist') and g.active),
  ranked as (select r.* from private.ranked_waitlist(array(select distinct x.table_type_id from tables x)) r)
  select g.id, g.name, ty.name, ty.small_blind_paise, ty.big_blind_paise, g.is_open, r.place,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         ct.name, e.stepped_away_at is not null, ty.game, ty.straddle_paise
  from tables g
  join public.table_type ty on ty.id = g.table_type_id
  left join ranked r on r.table_id = g.id
  left join public.waitlist_entry e on e.id = r.entry_id
  left join public.member m on m.id = r.member_id
  left join public.member_preference p on p.member_id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  where g.is_open or exists (select 1 from ranked w where w.table_id = g.id)
  order by g.position, g.name, r.place;
$function$;

CREATE OR REPLACE FUNCTION public.tv_waitlist_board()
 RETURNS TABLE(table_id uuid, table_name text, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, is_open boolean, place integer, display_name text, call_table_name text, is_away boolean, game text, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.tv_waitlist_board(); $function$;

revoke execute on function private.tv_waitlist_board(), public.tv_waitlist_board() from public, anon;
grant execute on function private.tv_waitlist_board(), public.tv_waitlist_board() to authenticated;

-- The TV's call time board, which had the stake's name alone: its game, blinds and straddle too.
drop function public.tv_call_time_board();
drop function private.tv_call_time_board();
CREATE OR REPLACE FUNCTION private.tv_call_time_board()
 RETURNS TABLE(table_id uuid, table_name text, stake_name text, seat integer, display_name text, call_time_left integer, is_away boolean, leaving_at timestamp with time zone, game text, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, g.name, ty.name, s.seat,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         private.session_call_time(s, now()), s.away_since is not null, s.leaving_at, ty.game, ty.small_blind_paise, ty.big_blind_paise, ty.straddle_paise
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type ty on ty.id = g.table_type_id
  join public.member m on m.id = s.member_id
  left join public.member_preference p on p.member_id = s.member_id
  where s.venue_id = private.tv_showing('call_time') and s.ended_at is null
    and (s.leaving_at is not null or private.session_call_time(s, now()) > 0)
  order by g.position, s.seat;
$function$;

CREATE OR REPLACE FUNCTION public.tv_call_time_board()
 RETURNS TABLE(table_id uuid, table_name text, stake_name text, seat integer, display_name text, call_time_left integer, is_away boolean, leaving_at timestamp with time zone, game text, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.tv_call_time_board(); $function$;

revoke execute on function private.tv_call_time_board(), public.tv_call_time_board() from public, anon;
grant execute on function private.tv_call_time_board(), public.tv_call_time_board() to authenticated;

-- The dealer tablet's seats, with the table's stake's straddle beside its blinds.
drop function public.tablet_seats();
drop function private.tablet_seats();
CREATE OR REPLACE FUNCTION private.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select n.seat, s.id, m.id, m.full_name, s.away_since, g.min_buy_in_paise,
         case when s.id is not null then private.session_call_time(s, now()) end,
         s.leaving_at, tt.small_blind_paise, tt.big_blind_paise, tt.straddle_paise
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$function$;

CREATE OR REPLACE FUNCTION public.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.tablet_seats(); $function$;

revoke execute on function private.tablet_seats(), public.tablet_seats() from public, anon;
grant execute on function private.tablet_seats(), public.tablet_seats() to authenticated;
