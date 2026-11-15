-- The minimum buy-in belongs to the table (redesign RD-16; owner, 15 Nov). Until now it was the stake's
-- (table_type.buy_in_min_paise), set by the database to 100 big blinds with no field anywhere. Each table now has its own,
-- in integer paise, required, above zero and a whole ₹50 as the stake's was, with no maximum; Tables setup suggests 50
-- big blinds of the table's stake
-- (@rivr/domain suggestedMinBuyIn) and the admin may type another. Existing tables take their stake's present minimum.
-- The stake's two columns stay for now: the cage's buy-in functions still read them.

alter table public.game_table add column min_buy_in_paise bigint;
update public.game_table g set min_buy_in_paise = t.buy_in_min_paise from public.table_type t where t.id = g.table_type_id;
alter table public.game_table
  alter column min_buy_in_paise set not null,
  add constraint game_table_min_buy_in_whole_fifties check (min_buy_in_paise > 0 and min_buy_in_paise % 5000 = 0);

comment on column public.game_table.min_buy_in_paise is 'The least a player buys in for at this table, in paise: the table''s own, a whole ₹50 above zero, with no maximum (RD-16).';

drop function public.add_game_table(uuid, text, uuid, integer, text);
drop function private.add_game_table(uuid, text, uuid, integer, text);
drop function public.set_game_table(uuid, text, uuid, integer);
drop function private.set_game_table(uuid, text, uuid, integer);

-- As 20261101100000_tables_setup.sql made it, with the table's minimum buy-in, and a stake only once it has a call time
-- (RVNCT, 20261116100000_stake_call_time.sql). Refusals as before; 22023 also a minimum buy-in that is not a whole ₹50 above zero.
create function private.add_game_table(p_venue_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_min_buy_in_paise bigint,
                                       p_room text default 'main')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_tables_manager(p_venue_id);
  perform private.assert_stake_ready(p_venue_id, p_table_type_id);
  begin
    insert into public.game_table (venue_id, table_type_id, name, position, seats, is_open, room, min_buy_in_paise)
    values (p_venue_id, p_table_type_id, trim(p_name),
            coalesce((select max(g.position) from public.game_table g where g.venue_id = p_venue_id), 0) + 1, p_seats, false, coalesce(p_room, 'main'),
            p_min_buy_in_paise)
    returning id into v_id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s' using errcode = '22023';
  end;
  return v_id;
end;
$$;

-- As 20261107000000_table_lifecycle.sql made it, with the minimum buy-in: given, it is the table's from now; left out (a
-- console open on an older build), the table keeps its own. A new stake is given only once it has a call time (RVNCT).
create function private.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_min_buy_in_paise bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  select * into v_table from public.game_table g where g.id = p_table_id for update;
  perform private.assert_tables_manager(v_table.venue_id);
  if v_table.deleted_at is not null then
    raise exception 'That table was deleted' using errcode = '22023';
  end if;
  if p_table_type_id is distinct from v_table.table_type_id then
    if exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.ended_at is null)
       or exists (select 1 from public.waitlist_entry e
                  where e.status = 'waiting' and (e.call_table_id = v_table.id or e.table_id = v_table.id)) then
      raise exception 'Move the players before changing the table''s stake' using errcode = 'RVSTD';
    end if;
    perform private.assert_stake_ready(v_table.venue_id, p_table_type_id);
  end if;
  begin
    update public.game_table
    set name = trim(p_name), table_type_id = p_table_type_id, seats = p_seats, min_buy_in_paise = coalesce(p_min_buy_in_paise, min_buy_in_paise)
    where id = v_table.id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s' using errcode = '22023';
  end;
end;
$$;

create function public.add_game_table(p_venue_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_min_buy_in_paise bigint,
                                      p_room text default 'main')
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_game_table(p_venue_id, p_name, p_table_type_id, p_seats, p_min_buy_in_paise, p_room); $$;
create function public.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_min_buy_in_paise bigint default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_game_table(p_table_id, p_name, p_table_type_id, p_seats, p_min_buy_in_paise); $$;

revoke execute on function private.add_game_table(uuid, text, uuid, integer, bigint, text), private.set_game_table(uuid, text, uuid, integer, bigint),
  public.add_game_table(uuid, text, uuid, integer, bigint, text), public.set_game_table(uuid, text, uuid, integer, bigint) from public, anon;
grant execute on function private.add_game_table(uuid, text, uuid, integer, bigint, text), private.set_game_table(uuid, text, uuid, integer, bigint),
  public.add_game_table(uuid, text, uuid, integer, bigint, text), public.set_game_table(uuid, text, uuid, integer, bigint) to authenticated;

-- The website's and link-in-bio's tables. As 20261107000000_table_lifecycle.sql made it, with each table's own minimum
-- buy-in. The view keeps its maximum column while a website built before this still reads it: never below the minimum.
-- And no count of seats taken: nobody signed out, and no player, sees how many are seated (owner, 8 Nov and 15 Nov), and
-- nothing reads the column. It stays in the view, empty, so the view keeps its shape.
create or replace function private.public_table_status_rows()
returns table (venue_slug text, table_name text, table_position integer, is_open boolean, table_type_code text, table_type_name text,
               game text, small_blind_paise bigint, big_blind_paise bigint, buy_in_min_paise bigint, buy_in_max_paise bigint,
               straddle_paise bigint, seats integer, seats_taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, g.name, g.position, g.is_open, t.code, t.name, t.game, t.small_blind_paise, t.big_blind_paise,
         g.min_buy_in_paise, greatest(t.buy_in_max_paise, g.min_buy_in_paise), t.straddle_paise, g.seats, null::integer
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  join public.venue v on v.id = g.venue_id
  where not v.is_practice and g.active
    and not exists (select 1 from public.control_state c where c.venue_id = v.id and c.level = 'venue_freeze' and c.released_at is null);
$$;

-- The dealer's ring. As 20261110410050_tablet_seats_leaving_and_stakes.sql made it, with the table's own minimum.
create or replace function private.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint, call_time_left integer, leaving_at timestamptz, small_blind_paise bigint, big_blind_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select n.seat, s.id, m.id, m.full_name, s.away_since, g.min_buy_in_paise,
         (select r.amount_paise from public.buy_in_request r where r.session_id = s.id and r.status = 'waiting'),
         case when s.id is not null then private.session_call_time(s, now()) end,
         s.leaving_at, tt.small_blind_paise, tt.big_blind_paise
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$$;

-- The practice venue's tables are reloaded from its saved rows, which now need the new column (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
