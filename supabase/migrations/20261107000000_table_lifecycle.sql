-- Tables come and go (console v3, Phase 6; decision 0432). The super admin (tables.manage) deactivates a table, which
-- hides it from everything live (the live floor, the waitlists, the player app, the TVs, the website) and keeps its
-- history; reactivates it, closed; or deletes it for good, keeping its history rows for reports. Neither while anyone
-- sits at the table (RVSTD) or waits on its list (RVWTG): the reasons @rivr/domain's tableRetireRefusal gives.

alter table public.game_table
  add column active boolean not null default true,
  add column deleted_at timestamptz,
  -- A deleted table is inactive, and an inactive one closed: nothing live reaches either.
  add constraint game_table_deleted_inactive check (deleted_at is null or not active),
  add constraint game_table_inactive_closed check (active or not is_open);

comment on column public.game_table.active is 'False once the super admin deactivates the table: hidden from everything live, its history kept (decision 0432).';
comment on column public.game_table.deleted_at is 'When the super admin deleted the table, for good: setup no longer lists it; reports keep it (decision 0432).';
grant select (active, deleted_at) on public.game_table to authenticated;

-- Members see the active tables only; staff see every table not deleted, as setup lists the inactive ones.
drop policy "staff and members see the venue's tables" on public.game_table;
create policy "staff and members see the venue's tables" on public.game_table for select to authenticated
  using ((deleted_at is null and venue_id in (select private.staff_venues()))
         or (active and venue_id = (select private.current_member_venue_id())
             and (select private.has_feature(private.current_member_id(), 'floor.live_view'))));

-- A table in play: a player seated at it (RVSTD), or a place waiting on its list or called to it (RVWTG). The SQL twin
-- of @rivr/domain tableRetireRefusal, seated first.
create function private.assert_table_empty(p_table_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.seat_session s where s.table_id = p_table_id and s.ended_at is null) then
    raise exception 'Move the players before taking the table away' using errcode = 'RVSTD';
  end if;
  if exists (select 1 from public.waitlist_entry e
             where e.status = 'waiting' and (e.table_id = p_table_id or e.call_table_id = p_table_id)) then
    raise exception 'Take the players off its waitlist first' using errcode = 'RVWTG';
  end if;
end;
$$;
revoke execute on function private.assert_table_empty(uuid) from public, anon, authenticated;

-- Takes a table out of play: inactive and closed, no longer feeding a main table nor fed. Again is nothing. Refusals:
-- 42501 not tables.manage, RVFRZ frozen, 22023 deleted, RVSTD/RVWTG in play.
create function private.deactivate_game_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  -- Locked against a seating, a call or a join at the table meanwhile.
  select * into v_table from public.game_table g where g.id = p_table_id for update;
  perform private.assert_tables_manager(v_table.venue_id);
  if v_table.deleted_at is not null then
    raise exception 'That table was deleted' using errcode = '22023';
  end if;
  if not v_table.active then return; end if;
  perform private.assert_table_empty(v_table.id);
  update public.game_table set must_move_to_table_id = null where must_move_to_table_id = v_table.id;
  update public.game_table set active = false, is_open = false, must_move_to_table_id = null where id = v_table.id;
end;
$$;

-- Brings an inactive table back, closed until the floor opens it. Again is nothing. Refusals as above, less in play.
create function private.reactivate_game_table(p_table_id uuid)
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
    raise exception 'A deleted table does not come back' using errcode = '22023';
  end if;
  update public.game_table set active = true where id = v_table.id and not active;
end;
$$;

-- Deletes a table for good: inactive, closed, out of setup; its hands, seats and runs stay for reports. Again is nothing.
-- Refusals as deactivating.
create function private.delete_game_table(p_table_id uuid)
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
  if v_table.deleted_at is not null then return; end if;
  perform private.assert_table_empty(v_table.id);
  update public.game_table set must_move_to_table_id = null where must_move_to_table_id = v_table.id;
  update public.game_table set active = false, is_open = false, must_move_to_table_id = null, deleted_at = now() where id = v_table.id;
end;
$$;

create function public.deactivate_game_table(p_table_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.deactivate_game_table(p_table_id); $$;
create function public.reactivate_game_table(p_table_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.reactivate_game_table(p_table_id); $$;
create function public.delete_game_table(p_table_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.delete_game_table(p_table_id); $$;

revoke execute on function private.deactivate_game_table(uuid), private.reactivate_game_table(uuid), private.delete_game_table(uuid),
  public.deactivate_game_table(uuid), public.reactivate_game_table(uuid), public.delete_game_table(uuid) from public, anon;
grant execute on function private.deactivate_game_table(uuid), private.reactivate_game_table(uuid), private.delete_game_table(uuid),
  public.deactivate_game_table(uuid), public.reactivate_game_table(uuid), public.delete_game_table(uuid) to authenticated;

-- As 20261101100000_tables_setup.sql made it, with a deleted table refused (22023), and the stake kept while the table's
-- own waitlist has places (RVSTD): a list's places are at its table's stake.
create or replace function private.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer)
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
  if p_table_type_id is distinct from v_table.table_type_id
     and (exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.ended_at is null)
          or exists (select 1 from public.waitlist_entry e
                     where e.status = 'waiting' and (e.call_table_id = v_table.id or e.table_id = v_table.id))) then
    raise exception 'Move the players before changing the table''s stake' using errcode = 'RVSTD';
  end if;
  begin
    update public.game_table set name = trim(p_name), table_type_id = p_table_type_id, seats = p_seats where id = v_table.id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue and 2 to 10 seats' using errcode = '22023';
  end;
end;
$$;

-- As 20261019091800_seat_sessions.sql made it, with an inactive table opened by nobody (22023): reactivate it first.
create or replace function private.set_table_open(p_table_id uuid, p_is_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  select * into v_table from public.game_table t where t.id = p_table_id for update;
  if v_table.id is null or not private.has_permission(v_table.venue_id, 'floor.manage') then
    raise exception 'Only floor managers open and close tables' using errcode = '42501';
  end if;
  perform private.assert_writable(v_table.venue_id);
  if p_is_open and not v_table.active then
    raise exception 'Reactivate the table before opening it' using errcode = '22023';
  end if;
  if not p_is_open and (exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.ended_at is null)
                        or exists (select 1 from public.waitlist_entry e where e.call_table_id = v_table.id and e.status = 'waiting' and e.called_at is not null)) then
    raise exception 'Move the players before closing the table' using errcode = 'RVSTD';
  end if;
  update public.game_table set is_open = p_is_open where id = v_table.id;
end;
$$;

-- As 20261019091800_seat_sessions.sql made it, with active tables only on either side (22023).
create or replace function private.set_must_move(p_table_id uuid, p_main_table_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
begin
  perform 1 from public.game_table t where t.id in (p_table_id, p_main_table_id) order by t.id for no key update;
  select * into v_table from public.game_table t where t.id = p_table_id;
  if v_table.id is null or not private.has_permission(v_table.venue_id, 'floor.manage') then
    raise exception 'Only floor managers set must-move tables' using errcode = '42501';
  end if;
  perform private.assert_writable(v_table.venue_id);
  if not v_table.active or (p_main_table_id is not null and (not exists (
       select 1 from public.game_table m
       where m.id = p_main_table_id and m.id <> v_table.id and m.venue_id = v_table.venue_id and m.active
         and m.table_type_id = v_table.table_type_id and m.must_move_to_table_id is null)
     or exists (select 1 from public.game_table f where f.must_move_to_table_id = v_table.id))) then
    raise exception 'A must-move table feeds a main table of the same game' using errcode = '22023';
  end if;
  update public.game_table set must_move_to_table_id = p_main_table_id where id = v_table.id;
end;
$$;

-- The live reads, active tables only. As 20261021120000_home_tonight.sql made it.
create or replace function private.floor_open_seats()
returns table (table_id uuid, open_seats integer)
language sql
stable
security definer
set search_path = ''
as $$
  -- A seat counts once: the floor may seat a called member in the seat held for them before their place closes.
  select t.id, greatest(t.seats - (select count(*)::integer from (
    select s.seat from public.seat_session s where s.table_id = t.id and s.ended_at is null
    union
    select e.call_seat from public.waitlist_entry e where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null
  ) taken), 0)
  from public.game_table t
  where t.active
    and ((t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
         or t.venue_id in (select private.staff_venues()));
$$;

-- As 20261019092200_live_floor.sql made it.
create or replace function private.floor_tonight(p_venue_id uuid, p_at timestamptz)
returns table (table_id uuid, hands integer, hands_last_hour integer, dealer_name text, rake_paise bigint, venue_rake_paise bigint,
               rake_basis_points integer, rake_cap_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with night as (
    select g.id, tt.code,
           (select count(*) from public.hand h where h.table_id = g.id and h.played_at >= private.tonight_began(p_at) and h.played_at <= p_at)::integer as hands,
           (select count(*) from public.hand h where h.table_id = g.id and h.played_at > p_at - interval '1 hour' and h.played_at <= p_at)::integer as hands_last_hour,
           (select s.full_name from public.dealer_down d join public.staff s on s.id = d.staff_id
            where d.table_id = g.id and d.ended_at is null order by d.started_at desc limit 1) as dealer_name,
           (select coalesce(sum(h.rake_paise), 0) from public.hand h
            where h.table_id = g.id and h.played_at >= private.tonight_began(p_at) and h.played_at <= p_at)::bigint as rake_paise
    from public.game_table g
    join public.table_type tt on tt.id = g.table_type_id
    where g.venue_id = p_venue_id and g.active and private.has_permission(p_venue_id, 'members.read')
  )
  select n.id, n.hands, n.hands_last_hour, n.dealer_name,
         case when private.has_permission(p_venue_id, 'ledger.read') then n.rake_paise end,
         case when private.has_permission(p_venue_id, 'ledger.read') then sum(n.rake_paise) over ()::bigint end,
         (private.setting_at(p_venue_id, 'rake.config', n.code, p_at) ->> 'rate_basis_points')::integer,
         (private.setting_at(p_venue_id, 'rake.config', n.code, p_at) ->> 'cap_paise')::bigint
  from night n;
$$;

-- The website's and link-in-bio's tables: active ones only. As 20261105110200_frozen_room_off_the_games.sql made it.
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
         t.buy_in_min_paise, t.buy_in_max_paise, t.straddle_paise, g.seats,
         (select count(*)::integer from public.seat_session s where s.table_id = g.id and s.ended_at is null)
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  join public.venue v on v.id = g.venue_id
  where not v.is_practice and g.active
    and not exists (select 1 from public.control_state c where c.venue_id = v.id and c.level = 'venue_freeze' and c.released_at is null);
$$;
