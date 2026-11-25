-- Each stretch of a seat keeps the stake it was played at (the owner, 25 Nov; #1138). Until now every report and play-time
-- Bonus read a table's current stake, so changing a table's stake, even an empty one, moved every past night played at it
-- to the new stake. Now:
-- - seat_session.table_type_id is the stake of the seat's current stretch (from its table when seated or moved), and
--   seat_move.from_table_type_id the stake of the stretch a move ended; private.session_tables gives each stretch's stake,
--   and its readers that weigh or report by stake read it: play-time Bonus (visit_schedule_time, visit_schedule_time_at,
--   visit_window_time), rake shares, a member's sessions and the promotion replay.
-- - A table's stake changes with players seated (#1137): each one's seat ends a stretch at the old stake and goes on at
--   the new, as a seat_move on the same table and seat, so they stay seated with their call time and time away as they
--   were. The waiting list stays with the table, its places at the new stake.
-- - The past is repaired: every existing stretch gets the stake its table had when the stretch began, from the audit log
--   of game_table (private.table_stake_at). A stake could not change while anyone was seated, so no past stretch spans a
--   change. Bonus already decided stays as it was; it was weighed then, at the right stake.
-- - A stake games were played at is no longer deleted (RVHST): it stays as their stake.

alter table public.seat_session add column table_type_id uuid;
comment on column public.seat_session.table_type_id is 'The stake the seat''s current stretch is played at (#1138): its table''s when seated or moved, the new one when the table''s stake changes with the seat taken.';
alter table public.seat_move add column from_table_type_id uuid;
comment on column public.seat_move.from_table_type_id is 'The stake of the stretch the move ended (#1138). A move on the same table and seat is the table''s stake changing.';
create index seat_session_table_type_id_idx on public.seat_session (table_type_id);
create index seat_move_from_table_type_id_idx on public.seat_move (from_table_type_id);
-- A member's export carries them, as the rest of their seats and moves.
insert into private.member_export_column (table_name, column_name, kind)
select t, c, 'owed' from (values ('seat_session', 'table_type_id'), ('seat_move', 'from_table_type_id')) as x (t, c)
where exists (select 1 from private.member_export_column e where e.table_name = x.t);

-- A table's stake at a moment, from the audit log of game_table: the stake its latest insert or change at or before then
-- left; before the first one known, the stake that one changed from; with no history, or a stake since deleted, the stake
-- it has now. Latest and first by the log's own order: its id follows the table's row lock, where occurred_at is when a
-- transaction began, so two changes made at once would otherwise sort as they started rather than as they were made.
create function private.table_stake_at(p_table_id uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select t.id from public.table_type t where t.id = coalesce(
      (select (a.after ->> 'table_type_id')::uuid from public.audit_log a
       where a.entity = 'game_table' and a.entity_id = p_table_id::text and a.occurred_at <= p_at and a.after ? 'table_type_id'
       order by a.id desc limit 1),
      (select (a.before ->> 'table_type_id')::uuid from public.audit_log a
       where a.entity = 'game_table' and a.entity_id = p_table_id::text and a.before ? 'table_type_id'
       order by a.id limit 1))),
    (select g.table_type_id from public.game_table g where g.id = p_table_id));
$$;
revoke all on function private.table_stake_at(uuid, timestamptz) from public, anon, authenticated;

-- The repair: each existing stretch at the stake its table had when it began. A data step, not a change anyone made, so the
-- tables' own triggers (the audit, updated_at, the floor's signals, seat_move's never-changed guard) are held while it runs.
alter table public.seat_session disable trigger user;
alter table public.seat_move disable trigger user;
update public.seat_session s
set table_type_id = private.table_stake_at(s.table_id, coalesce((select max(m.created_at) from public.seat_move m where m.session_id = s.id), s.started_at));
update public.seat_move m
set from_table_type_id = private.table_stake_at(m.from_table_id, coalesce(
  (select max(p.created_at) from public.seat_move p where p.session_id = m.session_id and (p.created_at, p.id) < (m.created_at, m.id)),
  (select s.started_at from public.seat_session s where s.id = m.session_id)));
alter table public.seat_session enable trigger user;
alter table public.seat_move enable trigger user;
alter table public.seat_session alter column table_type_id set not null;
alter table public.seat_move alter column from_table_type_id set not null;
-- A stake of the seat's own venue, as its table is.
alter table public.seat_session add constraint seat_session_table_type_id_venue_id_fkey
  foreign key (table_type_id, venue_id) references public.table_type (id, venue_id);
alter table public.seat_move add constraint seat_move_from_table_type_id_venue_id_fkey
  foreign key (from_table_type_id, venue_id) references public.table_type (id, venue_id);

-- A seat takes its table's stake when it is seated and when it moves to another table; a seat added after its night (a
-- visit added by hand or from a file, already ended) takes the stake its table had when it began.
create function private.seat_session_stake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.table_type_id is null
     or tg_op = 'UPDATE' and new.table_id is distinct from old.table_id and new.table_type_id is not distinct from old.table_type_id then
    new.table_type_id := case
      when new.ended_at is not null then private.table_stake_at(new.table_id, new.started_at)
      else (select g.table_type_id from public.game_table g where g.id = new.table_id)
    end;
  end if;
  return new;
end;
$$;
revoke all on function private.seat_session_stake() from public, anon, authenticated;
create trigger seat_session_stake before insert or update of table_id on public.seat_session
for each row execute function private.seat_session_stake();

-- A move written without the stake of the stretch it ends (move_seat and set_game_table name it) takes its table's stake.
create function private.seat_move_stake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.from_table_type_id := coalesce(new.from_table_type_id, (select g.table_type_id from public.game_table g where g.id = new.from_table_id));
  return new;
end;
$$;
revoke all on function private.seat_move_stake() from public, anon, authenticated;
create trigger seat_move_stake before insert on public.seat_move for each row execute function private.seat_move_stake();

-- Each stretch of a seat at one table, with the stake it was played at: a move or a stake change ends one. A seat's end
-- corrected to before a move or a stake change ends its stretches there, and one that would begin after it is none.
drop function private.session_tables(uuid);
create function private.session_tables(p_session_id uuid)
returns table (o_table_id uuid, o_from timestamptz, o_to timestamptz, o_table_type_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with seat as (select s.id, s.table_id, s.table_type_id, s.started_at, coalesce(s.ended_at, 'infinity') as end_at
                from public.seat_session s where s.id = p_session_id),
  stretches as (
    select m.from_table_id as table_id, coalesce(lag(m.created_at) over (order by m.created_at, m.id), s.started_at) as from_at,
           m.created_at as to_at, m.from_table_type_id as table_type_id
    from public.seat_move m join seat s on s.id = m.session_id
    union all
    select s.table_id, coalesce((select max(m.created_at) from public.seat_move m where m.session_id = s.id), s.started_at), s.end_at, s.table_type_id
    from seat s
  )
  select st.table_id, least(st.from_at, s.end_at), least(st.to_at, s.end_at), st.table_type_id
  from stretches st cross join seat s
  where st.from_at < s.end_at or st.from_at = s.started_at;
$$;
revoke all on function private.session_tables(uuid) from public, anon, authenticated;

-- A table's details change with players seated and waiting (#1137): a new stake starts a new stretch for each seat taken,
-- the play so far keeping the old one, and they stay seated; the waiting list stays with the table, its places at the new
-- stake as a list's places are at its table's (20261107000000_table_lifecycle.sql). Fewer seats than one
-- taken is refused by the table's own trigger, as before. Otherwise as 20261116100100_table_min_buy_in.sql.
CREATE OR REPLACE FUNCTION private.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_min_buy_in_paise bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_table public.game_table;
begin
  select * into v_table from public.game_table g where g.id = p_table_id for update;
  perform private.assert_tables_manager(v_table.venue_id);
  if v_table.deleted_at is not null then
    raise exception 'That table was deleted' using errcode = '22023';
  end if;
  if p_table_type_id is distinct from v_table.table_type_id then
    perform private.assert_stake_ready(v_table.venue_id, p_table_type_id);
  end if;
  begin
    update public.game_table
    set name = trim(p_name), table_type_id = p_table_type_id, seats = p_seats, min_buy_in_paise = coalesce(p_min_buy_in_paise, min_buy_in_paise)
    where id = v_table.id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s' using errcode = '22023';
  end;
  if p_table_type_id is distinct from v_table.table_type_id then
    insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, moved_by_staff_id, from_table_type_id)
    select s.venue_id, s.id, s.table_id, s.seat, s.table_id, s.seat, private.current_staff_id(v_table.venue_id), s.table_type_id
    from public.seat_session s
    where s.table_id = v_table.id and s.ended_at is null;
    update public.seat_session set table_type_id = p_table_type_id where table_id = v_table.id and ended_at is null;
    update public.waitlist_entry set table_type_id = p_table_type_id where table_id = v_table.id and status = 'waiting';
  end if;
end;
$function$;

-- The readers of each stretch's stake, generated from the live definitions by gen1138.py, the stake read from the stretch.
CREATE OR REPLACE FUNCTION private.visit_schedule_time(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_table_type_id as table_type_id, t.o_from,
           private.seconds_in_schedule(p_schedule, greatest(t.o_from, private.hours_counted_from(v.member_id)), least(t.o_to, v.closed_at)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at and least(t.o_to, v.closed_at) > private.hours_counted_from(v.member_id)
  ),
  counted as (
    select st.*
    from stints st
    join public.table_type tt on tt.id = st.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;

CREATE OR REPLACE FUNCTION private.visit_schedule_time_at(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb, p_at timestamp with time zone)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visit_end as (
    select v.id, private.hours_counted_from(v.member_id) as counted_from, least(coalesce(v.closed_at, p_at), p_at) as ended_at
    from public.visit v where v.id = p_visit_id
  ),
  stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_table_type_id as table_type_id, t.o_from,
           private.seconds_in_schedule(p_schedule, greatest(t.o_from, e.counted_from), least(t.o_to, e.ended_at)) as seconds,
           floor(extract(epoch from (least(coalesce(s.ended_at, e.ended_at), e.ended_at) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (e.ended_at - s.away_since))))::bigint else 0 end as away_seconds
    from visit_end e
    join public.seat_session s on s.visit_id = e.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < e.ended_at and least(t.o_to, e.ended_at) > e.counted_from
  ),
  counted as (
    select st.*
    from stints st
    join public.table_type tt on tt.id = st.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;

CREATE OR REPLACE FUNCTION private.visit_window_time(p_visit_id uuid, p_conditions jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_table_type_id as table_type_id, t.o_from,
           private.seconds_in_window(greatest(t.o_from, private.hours_counted_from(v.member_id)), least(t.o_to, v.closed_at), p_conditions) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at and least(t.o_to, v.closed_at) > private.hours_counted_from(v.member_id)
  ),
  counted as (
    select st.*
    from stints st
    join public.table_type tt on tt.id = st.table_type_id
    where (not p_conditions ? 'stakes' or p_conditions -> 'stakes' ? tt.code)
      and (not p_conditions ? 'table_ids' or p_conditions -> 'table_ids' ? st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;

CREATE OR REPLACE FUNCTION private.week_rake_shares(p_venue_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(member_id uuid, stake text, share_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with seated as materialized (
    select s.member_id, t.o_table_id, t.o_table_type_id, t.o_from, t.o_to
    from public.seat_session s
    cross join lateral private.session_tables(s.id) t
    where s.venue_id = p_venue_id and s.started_at < p_to and (s.ended_at > p_from or s.ended_at is null)
  ),
  shares as (
    select o.member_id, tt.code as stake, private.rake_share(h.rake_paise, (count(*) over (partition by h.id))::integer) as share
    from public.hand h
    join seated o on o.o_table_id = h.table_id and o.o_from <= h.played_at and o.o_to > h.played_at
    join public.table_type tt on tt.id = o.o_table_type_id
    where h.venue_id = p_venue_id and h.played_at >= p_from and h.played_at < p_to and h.rake_paise > 0
  )
  select s.member_id, s.stake, sum(s.share)::bigint from shares s group by s.member_id, s.stake having sum(s.share) > 0;
$function$;

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
  -- Time played at each table that visit, at each stake played there (#1138): each seat's stretches, less their share of
  -- its time away, as private.visit_table_time counts a table's.
  played as (
    select r.visit_id, r.table_id, r.table_type_id, sum(r.seconds)::bigint as seconds
    from (select m.id as visit_id, t.o_table_id as table_id, t.o_table_type_id as table_type_id,
                 private.table_played_seconds(floor(sum(extract(epoch from (least(t.o_to, m.closed_at) - t.o_from))))::bigint, w.wall,
                                              greatest(0, w.wall - s.away_seconds)) as seconds
          from mine m
          join public.seat_session s on s.visit_id = m.id
          cross join lateral (select floor(extract(epoch from (coalesce(s.ended_at, m.closed_at) - s.started_at)))::bigint as wall) w
          cross join lateral private.session_tables(s.id) t
          where t.o_from < m.closed_at
          group by m.id, s.id, t.o_table_id, t.o_table_type_id, w.wall, s.away_seconds) r
    group by r.visit_id, r.table_id, r.table_type_id
  ),
  -- When the member sat at each table that visit, at each stake played there: from their first seat there to the last
  -- time they left it (a move keeps one seat session across tables; private.session_tables splits it).
  stints as (
    select m.id as visit_id, t.o_table_id as table_id, t.o_table_type_id as table_type_id, min(greatest(t.o_from, m.opened_at)) as opened_at,
           max(least(t.o_to, m.closed_at)) as closed_at
    from mine m
    join public.seat_session s on s.visit_id = m.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < m.closed_at
    group by m.id, t.o_table_id, t.o_table_type_id
  ),
  -- Each table a session of its own (the owner, 9 Nov), and each stake played there (#1138). A table or stake sat at for
  -- under a minute in a visit of more than one (a move made by mistake and undone) is none, but a visit always keeps the
  -- one it was played at longest.
  kept as (
    select st.visit_id, st.table_id, st.table_type_id, st.opened_at, st.closed_at, coalesce(p.seconds, 0)::bigint as seconds,
           row_number() over (partition by st.visit_id order by coalesce(p.seconds, 0) desc, st.opened_at) = 1 as is_longest
    from stints st
    left join played p on p.visit_id = st.visit_id and p.table_id = st.table_id and p.table_type_id = st.table_type_id
  ),
  tabled as (
    select k.visit_id, k.table_id, k.table_type_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, tt.straddle_paise, k.seconds,
           row_number() over (partition by k.visit_id, k.table_id order by k.opened_at, k.table_type_id) = 1 as is_first_stake
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = k.table_type_id
    where k.seconds >= 60 or k.is_longest
  ),
  me as (
    select private.current_member_id() as member_id
    where private.has_feature(private.current_member_id(), 'sessions.history')
  ),
  tournaments as (
    select t.id, t.name, t.starts_at, t.entries
    from me
    join public.tournament_interest i on i.member_id = me.member_id
    join public.tournament t on t.id = i.tournament_id and t.is_published and t.starts_at <= now()
    where private.has_feature(me.member_id, 'tournaments.register')
  ),
  sessions as (
    -- The first stake shown for a table keeps the id the table's row always had, so a session hidden stays hidden; a later
    -- stake there has an id of its own.
    select (case when l.is_first_stake then md5(m.id::text || ':' || l.table_id::text)
                 else md5(m.id::text || ':' || l.table_id::text || ':' || l.table_type_id::text) end)::uuid as session_id,
           m.id as visit_id, l.opened_at, l.closed_at, l.name,
           l.small_blind_paise, l.big_blind_paise, l.seconds,
           0::bigint as buy_in, 0::bigint as bonus, 0::bigint as cashed, 0::bigint as tds,
           0::bigint as paid, 0::bigint as net,
           null::text as receipt, private.club_month(l.opened_at) as month,
           null::text as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants, l.straddle_paise as straddle
    from mine m
    join tabled l on l.visit_id = m.id
    union all
    select t.id, t.id, t.starts_at, t.starts_at, t.name, 0::bigint, 0::bigint, 0::bigint,
           0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, null::text, private.club_month(t.starts_at), null::text,
           'tournament'::text, null::integer, t.entries, null::bigint
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) filter (where s.kind = 'cash') over w)::integer,
         (sum(s.seconds) over w)::bigint, (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants, s.straddle
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$function$;

CREATE OR REPLACE FUNCTION private.replay_version_events(p_version promotion_version, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with seats as (
    select s.id, s.started_at as at, s.member_id, s.visit_id, s.table_id, tt.code as stake,
           row_number() over (partition by s.visit_id order by s.started_at, s.id) as nth
    from public.seat_session s
    -- The stake they were seated at: their first stretch's (#1138).
    left join public.table_type tt on tt.id = coalesce((select m.from_table_type_id from public.seat_move m where m.session_id = s.id
                                                        order by m.created_at, m.id limit 1), s.table_type_id)
    where private.promotion_event_kind(p_version.reward) = 'seated'
      and s.venue_id = p_version.venue_id and s.started_at >= p_from and s.started_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.o_table_id as table_id from private.visit_table_time(v.id) e
                       group by e.o_table_id order by sum(e.o_played) desc, e.o_table_id limit 1) lt on true
    -- The stake of their latest stretch at the table they played longest (#1138).
    left join public.table_type tt on tt.id = (select st.o_table_type_id from public.seat_session s cross join lateral private.session_tables(s.id) st
                                               where s.visit_id = v.id and st.o_table_id = lt.table_id order by st.o_to desc limit 1)
    where private.promotion_event_kind(p_version.reward) in ('time_played', 'hours_step')
      and v.venue_id = p_version.venue_id and v.closed_at >= p_from and v.closed_at < p_to and w.o_seconds > 0
  ),
  visits as (
    select v.id, v.opened_at as at, v.member_id,
           (select count(*) from public.visit x where x.member_id = v.member_id and x.opened_at <= v.opened_at
              and x.opened_at >= date_trunc('month', v.opened_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as in_month
    from public.visit v
    where private.promotion_event_kind(p_version.reward) = 'visit'
      and v.venue_id = p_version.venue_id and v.opened_at >= p_from and v.opened_at < p_to
  ),
  others as (
    select r.id, r.completed_at as at, side.member_id
    from public.referral r cross join lateral (values (r.member_id), (r.referrer_member_id)) side (member_id)
    where private.promotion_event_kind(p_version.reward) = 'referral'
      and r.venue_id = p_version.venue_id and r.completed_at >= p_from and r.completed_at < p_to
    union all
    select k.id, k.verified_at, k.member_id from public.kyc_record k
    where private.promotion_event_kind(p_version.reward) = 'signup'
      and k.venue_id = p_version.venue_id and k.status = 'verified' and k.verified_at >= p_from and k.verified_at < p_to
  ),
  hits as (
    select h.id, h.created_at as at, h.member_id, h.table_id, tt.code as stake, h.hand, h.rank
    from public.high_hand_hit h
    -- The stake its table had at the hit (#1138).
    left join public.table_type tt on tt.id = private.table_stake_at(h.table_id, h.created_at)
    where private.promotion_event_kind(p_version.reward) = 'high_hand'
      and h.venue_id = p_version.venue_id and h.created_at >= p_from and h.created_at < p_to
  ),
  entries as (
    select s.at, s.id::text as id, s.member_id, 'seated' as kind,
           jsonb_build_object('tableId', s.table_id, 'stake', s.stake, 'isFirstOfVisit', s.nth = 1, 'visitId', 'v' || dense_rank() over (order by s.visit_id)) as more
    from seats s
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
    union all
    select h.at, h.id::text, h.member_id, 'high_hand',
           jsonb_build_object('tableId', h.table_id, 'stake', h.stake, 'hand', h.hand, 'rank', h.rank,
                              'confirmed', '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}'::jsonb)
    from hits h
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$function$;

-- A move keeps the stake of the stretch it ends (#1138). Generated from the live definition.
CREATE OR REPLACE FUNCTION private.move_seat(p_session_id uuid, p_table_id uuid, p_seat integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_to public.game_table := private.floor_table(p_table_id);
begin
  select * into v_session from public.seat_session s where s.id = p_session_id and s.ended_at is null for update;
  select * into v_to from public.game_table t where t.id = v_to.id for no key update;
  if v_session.id is null or v_session.venue_id <> v_to.venue_id or not v_to.is_open or p_seat is null or p_seat not between 1 and v_to.seats
     or (v_session.table_id = v_to.id and v_session.seat = p_seat) then
    raise exception 'Move a seated player to another seat at an open table' using errcode = '22023';
  end if;
  perform private.assert_writable(v_to.venue_id, null, v_session.member_id);
  if private.is_seat_held(v_to.id, p_seat, v_session.member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  begin
    update public.seat_session
    set table_id = v_to.id, seat = p_seat, seated_here_at = case when table_id = v_to.id then seated_here_at else now() end
    where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
  end;
  -- The stretch that ends keeps the stake it was played at (#1138); the seat takes the new table's from the trigger.
  insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, moved_by_staff_id, from_table_type_id)
  values (v_to.venue_id, v_session.id, v_session.table_id, v_session.seat, v_to.id, p_seat, private.current_staff_id(v_to.venue_id),
          v_session.table_type_id);
  perform private.emit(v_to.venue_id, 'seat.moved',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_to.id, 'seat', p_seat),
                       'seat.moved:' || v_session.id || ':' || now());
end;
$function$;

-- A stake games were played at stays (#1138). Generated from the live definition.
CREATE OR REPLACE FUNCTION private.delete_table_type(p_type_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_type public.table_type;
begin
  select * into v_type from public.table_type t where t.id = p_type_id for update;
  if v_type.id is null then
    -- Nothing to delete; still nobody but a tables manager learns that.
    if not exists (select 1 from private.venues_where('tables.manage')) then
      raise exception 'Only the super admin sets up tables' using errcode = '42501';
    end if;
    return;
  end if;
  perform private.assert_tables_manager(v_type.venue_id);
  if exists (select 1 from public.game_table g where g.table_type_id = v_type.id) then
    raise exception 'A table still uses that stake' using errcode = 'RVUSE';
  end if;
  -- Games played at it keep it as their stake (#1138), so it stays.
  if exists (select 1 from public.seat_session s where s.table_type_id = v_type.id)
     or exists (select 1 from public.seat_move m where m.from_table_type_id = v_type.id) then
    raise exception 'Games were played at that stake, so it stays for their history' using errcode = 'RVHST';
  end if;
  begin
    delete from public.table_type where id = v_type.id;
  exception when foreign_key_violation then
    raise exception 'A table still uses that stake' using errcode = 'RVUSE';
  end;
end;
$function$;

-- The seat Bonus is weighed at the stake they sat down at, though the sweep runs minutes, or a freeze's length, later
-- (#1138). Generated from the live definitions.
CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version promotion_version, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member uuid := (p_context ->> 'member_id')::uuid;
  v_table uuid := (p_context ->> 'table_id')::uuid;
  v_visit uuid := coalesce((p_context ->> 'visit_id')::uuid, private.current_visit(v_member));
  v_base jsonb;
  v_time record;
begin
  v_base := jsonb_build_object('kind', p_kind, 'key', p_context ->> 'key', 'at', now(), 'memberId', v_member, 'visitId', v_visit,
    'tableId', v_table,
    -- The stake the event names (a seat weighed after it began: its first stretch's, #1138), else its table's now.
    'stake', (select tt.code from public.table_type tt
              where tt.id = coalesce((p_context ->> 'table_type_id')::uuid, (select g.table_type_id from public.game_table g where g.id = v_table))));
  if p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60);
  elsif p_kind = 'hours_step' then
    select * into v_time from private.visit_schedule_time_at(v_visit, p_version.schedule, p_version.eligibility,
                                                             least(coalesce((p_context ->> 'at')::timestamptz, now()), now()));
    -- At the time weighed (#1134): a visit added or edited after the night is weighed on its own night, its weekday and period.
    return v_base || jsonb_build_object('at', least(coalesce((p_context ->> 'at')::timestamptz, now()), now()),
      'minutes', v_time.o_seconds / 60, 'stepMinutes', (p_context ->> 'step_minutes')::integer);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$function$;

CREATE OR REPLACE FUNCTION private.sweep_seat_bonus(p_from timestamp with time zone DEFAULT (now() - '1 day'::interval))
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_seat record;
begin
  for v_seat in
    select s.id, s.venue_id, s.member_id, f.o_table_id as table_id, f.o_table_type_id as table_type_id, s.visit_id, s.started_at
    from public.seat_session s
    -- The table and stake they sat down at: the seat's first stretch (#1138).
    cross join lateral (select t.o_table_id, t.o_table_type_id from private.session_tables(s.id) t order by t.o_from, t.o_to limit 1) f
    where s.started_at > p_from and not private.is_undoable(s.started_at)
      and (s.ended_at is null or s.ended_at >= s.started_at + interval '2 minutes')
      and exists (select 1 from public.promotion_version v where v.venue_id = s.venue_id and v.status = 'live' and v.reward ->> 'kind' = 'seat_bonus')
      and not exists (select 1 from private.seat_bonus_weighed w where w.seat_session_id = s.id)
      and not exists (select 1 from public.staff st join public.member m on m.id = s.member_id
                      where st.id = s.seated_by_staff_id and (st.user_id = m.user_id or st.phone = m.phone))
    order by s.started_at, s.id
  loop
    begin
      perform private.assert_writable(v_seat.venue_id, 'promotions', v_seat.member_id);
    exception when others then
      continue;
    end;
    begin
      perform private.evaluate_promotions(v_seat.venue_id, 'seated', jsonb_build_object(
        'member_id', v_seat.member_id, 'table_id', v_seat.table_id, 'table_type_id', v_seat.table_type_id, 'visit_id', v_seat.visit_id,
        'key', 'seated:' || v_seat.id, 'at', v_seat.started_at));
      insert into private.seat_bonus_weighed (seat_session_id) values (v_seat.id) on conflict do nothing;
    exception when others then
      raise warning 'seat bonus: seat % not weighed: %', v_seat.id, sqlerrm;
    end;
  end loop;
end;
$function$;

-- The Players report and the Door: a stake change goes on in the seat's row (#1137).
-- Generated from the live definition.
CREATE OR REPLACE FUNCTION private.players_by_seat(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, session_id uuid, table_name text, tables jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, played_seconds bigint, away_seconds bigint, is_first_row boolean, bonus_used_paise bigint, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today, private.club_day_of(s.starts_at) as club_day
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  players as (select * from private.todays_players(p_venue_id, p_day)),
  -- The day's visits: opened that club day, or still open today.
  visits as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v cross join day
    where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
  ),
  seats as (
    select s.member_id, s.id as session_id, s.visit_id, t.o_table_id as table_id, t.o_from as seated_at, nullif(t.o_to, 'infinity') as left_at,
           least(floor(greatest(0, extract(epoch from least(t.o_to, now()) - t.o_from)))::bigint, w.wall) as seconds, w.wall, w.away
    from public.seat_session s
    cross join day
    cross join lateral (
      select floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::bigint as wall,
             s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                   then greatest(0, floor(extract(epoch from (now() - s.away_since))))::bigint else 0 end as away) w
    -- A row a seat, as before (the owner, 19 Nov); a stake change goes on in the same row (#1137).
    cross join lateral (
      select i.o_table_id, min(i.o_from) as o_from, max(i.o_to) as o_to
      from (select x.o_table_id, x.o_from, x.o_to,
                   count(*) filter (where not x.is_stake_change) over (order by x.o_from, x.o_to rows unbounded preceding) as sitting
            from (select t.o_table_id, t.o_from, t.o_to,
                         exists (select 1 from public.seat_move m
                                 where m.session_id = s.id and m.created_at = t.o_from and m.from_table_id = m.to_table_id and m.from_seat = m.to_seat)
                           as is_stake_change
                  from private.session_tables(s.id) t) x) i
      group by i.sitting, i.o_table_id) t
    where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Bonus used at a seat (private.redeem_bonus_at_seat, private.add_bonus_use): each use on the stretch of its seat session at
  -- its table that began last by the time it was used; one used before any such stretch, on the session's last.
  uses as (
    select r.amount_paise, r.session_id, at_seat.table_id, at_seat.seated_at
    from public.bonus_redemption r
    cross join lateral (
      select st.table_id, st.seated_at from seats st
      where st.session_id = r.session_id
      order by (st.table_id = r.table_id and st.seated_at <= coalesce(r.used_at, r.created_at)) desc, st.seated_at desc
      limit 1) at_seat
    where r.venue_id = p_venue_id and r.session_id in (select st.session_id from seats st)
  ),
  -- Bonus used without a seat (private.use_bonus, the owner, 20 Nov) that falls on this day, as above. Only the day's uses
  -- and the uses of the day's visits can.
  visit_uses as (
    select c.visit_id, sum(c.amount_paise)::bigint as paise
    from (select r.id, r.visit_id, r.amount_paise, r.created_at from public.bonus_redemption r cross join day
          where r.venue_id = p_venue_id and r.session_id is null and r.created_at >= day.starts_at and r.created_at < day.ends_at
          union
          select r.id, r.visit_id, r.amount_paise, r.created_at from visits vs join public.bonus_redemption r on r.visit_id = vs.id) c
    join public.visit v on v.id = c.visit_id
    cross join day
    cross join lateral (select private.club_day_of(c.created_at) as used_on, private.club_day_of(v.opened_at) as opened_on) d
    cross join lateral (
      select d.used_on = d.opened_on
             or exists (select 1 from public.seat_session s where s.visit_id = v.id and private.club_day_of(s.started_at) = d.used_on)
             as has_row_that_day) h
    where case when h.has_row_that_day then d.used_on else d.opened_on end = day.club_day
       or (day.is_today and v.closed_at is null)
    group by c.visit_id
  ),
  seat_rows as (
  select p.member_id, p.full_name, p.member_number, p.status, st.session_id, g.name as table_name,
         jsonb_build_array(jsonb_build_object('table', g.name, 'seconds', played.seconds)) as tables,
         st.seated_at, st.left_at, v.opened_at as checked_in_at, v.closed_at as checked_out_at,
         -- The wait that ended in this seat: the list's entry seated as the seat began, from the waitlist, or ended as seated
         -- when the floor seated the member by name or number (private.seat_member), in the same moment.
         (select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at, coalesce(e.seated_at, e.left_at))
          from public.waitlist_entry e
          where e.venue_id = p_venue_id and e.member_id = st.member_id
            and (e.seated_at = st.seated_at or (e.left_reason = 'seated' and e.left_at = st.seated_at))
          order by e.joined_at limit 1) as waiting_seconds,
         played.seconds as played_seconds, st.seconds - played.seconds as away_seconds,
         (select coalesce(sum(u.amount_paise), 0) from uses u
          where u.session_id = st.session_id and u.table_id = st.table_id and u.seated_at = st.seated_at)::bigint as bonus_used_paise,
         st.visit_id
  from players p
  join seats st on st.member_id = p.member_id
  join public.game_table g on g.id = st.table_id
  join public.visit v on v.id = st.visit_id
  cross join lateral (select private.table_played_seconds(st.seconds, st.wall, least(st.wall, greatest(0, st.wall - st.away))) as seconds) played
  union all
  -- A row without a seat: each visit of the day with none, the open one too while the member waits again for a seat; and
  -- one with no visit for a member with none that day (on a list from the app, never in), or waiting again from outside
  -- once their visits are over.
  select p.member_id, p.full_name, p.member_number, p.status, null, null, '[]'::jsonb, null, null, sv.opened_at, sv.closed_at,
         last_wait.seconds, 0, null, null, sv.id
  from players p
  cross join day
  cross join lateral (
    select v.id, v.opened_at, v.closed_at from visits v where v.member_id = p.member_id
    union all select null::uuid, null::timestamptz, null::timestamptz) sv
  -- The visit's current wait, else its last: one still running first, then the one that ended latest; one that ended in a
  -- seat only when there is no other.
  left join lateral (
    -- On a visit's row a wait ends at the visit's check-out at the latest (the reviews of the batch PR): it goes on after
    -- on the member's own row, and counted past it on both it would be counted twice, running or since ended.
    select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at,
                                       least(coalesce(e.left_at, e.seated_at, now()), coalesce(sv.closed_at, 'infinity'))) as seconds
    from public.waitlist_entry e
    where e.venue_id = p_venue_id and e.member_id = p.member_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
      and (sv.id is null or (coalesce(e.left_at, e.seated_at, now()) >= sv.opened_at and e.joined_at <= coalesce(sv.closed_at, now())))
    order by (e.seated_at is null and e.left_reason is distinct from 'seated') desc, coalesce(e.left_at, e.seated_at, 'infinity') desc,
             e.joined_at
    limit 1) last_wait on true
  where (sv.id is null and not exists (select 1 from visits v where v.member_id = p.member_id)
                       and not exists (select 1 from seats st where st.member_id = p.member_id))
     or (sv.id is null and day.is_today and p.status = 'waiting'
                       and not exists (select 1 from visits v where v.member_id = p.member_id and v.closed_at is null))
     or (sv.id is not null and not exists (select 1 from seats st where st.visit_id = sv.id))
     or (sv.id is not null and day.is_today and p.status = 'waiting' and sv.closed_at is null)
  )
  -- The first row of the member's latest visit that day (the open one for one back in), by when they sat, a row without a
  -- seat last; a row with no visit only when they had none: it carries what is not a
  -- seat's own. An erased member's name links nowhere.
  select r.member_id, r.full_name, r.member_number, r.status, r.session_id, r.table_name, r.tables, r.seated_at, r.left_at,
         r.checked_in_at, r.checked_out_at, r.waiting_seconds, r.played_seconds, r.away_seconds,
         row_number() over (partition by r.member_id
                            order by r.checked_in_at desc nulls last, r.checked_out_at desc nulls first, r.seated_at nulls last, r.table_name) = 1,
         case when vu.paise is not null
                   and row_number() over (partition by r.visit_id order by r.seated_at nulls last, r.table_name, r.session_id) = 1
              then coalesce(r.bonus_used_paise, 0) + vu.paise
              else r.bonus_used_paise end,
         r.visit_id, case when m.erased_at is null then r.member_id end
  from seat_rows r
  join public.member m on m.id = r.member_id
  left join visit_uses vu on vu.visit_id = r.visit_id;
$function$;

-- A leave undone after the table's stake changed goes on at the new stake; a seat taken just before a stake change is not
-- undone, the change being part of its history (#1138). Generated from the live definitions.
CREATE OR REPLACE FUNCTION private.undo_leave(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_table public.game_table;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a leave' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  select * into v_table from public.game_table t where t.id = v_session.table_id for no key update;
  if v_session.ended_at is null or v_session.end_reason <> 'left' or not private.is_undoable(v_session.ended_at)
     or not v_table.active or not v_table.is_open
     or exists (select 1 from public.early_departure e where e.session_id = v_session.id)
     or exists (select 1 from public.visit v where v.id = v_session.visit_id and v.closed_at is not null)
     or exists (select 1 from public.outbox_event e where e.venue_id = v_session.venue_id and e.idempotency_key = 'seat.left:' || v_session.id) then
    raise exception 'Only the floor''s leave of the last two minutes, at an open table, not let go early, is undone' using errcode = '22023';
  end if;
  if private.is_seat_held(v_table.id, v_session.seat, v_session.member_id) then
    raise exception 'That seat is held for a member called from the waitlist' using errcode = 'RVHLD';
  end if;
  if (select r.break_until from private.member_restrictions(v_session.member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be seated until it ends' using errcode = 'RVBRK';
  end if;
  begin
    update public.seat_session set ended_at = null, end_reason = null, leave_reason = null where id = v_session.id;
  exception when unique_violation then
    raise exception 'Someone sits in that seat, or the player sits elsewhere' using errcode = 'RVOCC';
  end;
  -- The table's stake changed while the seat was left (#1138): the seat goes on at the new one from now.
  if v_table.table_type_id is distinct from v_session.table_type_id then
    insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, moved_by_staff_id, from_table_type_id)
    values (v_session.venue_id, v_session.id, v_table.id, v_session.seat, v_table.id, v_session.seat, private.current_staff_id(v_session.venue_id),
            v_session.table_type_id);
    update public.seat_session set table_type_id = v_table.table_type_id where id = v_session.id;
  end if;
  update public.top_up_request set closed_at = null, outcome = null
  where session_id = v_session.id and outcome = 'left' and closed_at = v_session.ended_at;
  perform private.emit(v_session.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat), 'seat.taken:' || v_session.id || ':' || clock_timestamp());
end;
$function$;

CREATE OR REPLACE FUNCTION private.undo_seat(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor undoes a seat' using errcode = '42501';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  -- A stake change since is a move on the same seat (#1138), kept as the seat's history.
  if v_session.ended_at is not null or not private.is_undoable(v_session.started_at) or v_session.seated_here_at <> v_session.started_at
     or exists (select 1 from public.seat_move m where m.session_id = v_session.id) then
    raise exception 'Only a seat taken in the last two minutes, not moved since nor its table''s stake changed, is undone' using errcode = '22023';
  end if;
  -- The place they were seated from, and the places seating took them off, wait again uncalled (a call moved on stays moved).
  update public.waitlist_entry e
  set status = 'waiting', seated_at = null, left_at = null, left_reason = null,
      called_at = null, hold_until = null, call_table_id = null, call_seat = null, on_way_at = null
  where e.member_id = v_session.member_id and e.venue_id = v_session.venue_id
    and ((e.status = 'seated' and e.seated_at >= v_session.started_at)
         or (e.status = 'left' and e.left_reason = 'seated' and e.left_at >= v_session.started_at));
  begin
    delete from public.seat_session where id = v_session.id;
  exception when foreign_key_violation then
    raise exception 'Something was already recorded at that seat' using errcode = '22023';
  end;
  -- The member's lock screen heard the seat taken: it hears it go. The TV's call-time board hears a seat taken or changed;
  -- a seat gone is told here.
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'undone'), 'seat.left:' || v_session.id || ':undone');
  perform private.signal_tv(v_session.venue_id, 'call_time');
end;
$function$;

-- A hand sent late is raked by the stake its table had when it was played (#1138). Generated from the live definition.
CREATE OR REPLACE FUNCTION private.rake_rules_at(p_table_id uuid, p_at timestamp with time zone)
 RETURNS TABLE(rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint, drop_above_paise bigint, has_variation boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (rake.config ->> 'rate_basis_points')::numeric::integer, (rake.config ->> 'cap_paise')::numeric::bigint,
         coalesce((jackpot.config ->> 'drop_paise')::numeric::bigint, 0) > 0, coalesce((jackpot.config ->> 'drop_paise')::numeric::bigint, 0),
         coalesce((jackpot.config ->> 'above_paise')::numeric::bigint, 0), tt.has_variation
  from public.game_table t
  -- The stake the table had then: a hand sent after a stake change was played at the old one (#1138).
  join public.table_type tt on tt.id = private.table_stake_at(t.id, p_at)
  cross join lateral (select private.setting_at(t.venue_id, 'rake.config', tt.code, p_at) as config) rake
  cross join lateral (select private.setting_at(t.venue_id, 'jackpot.drop', '', p_at) as config) jackpot
  where t.id = p_table_id and rake.config is not null;
$function$;
