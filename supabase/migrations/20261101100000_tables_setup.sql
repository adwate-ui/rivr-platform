-- Tables setup (#642; owner's feedback doc of 29 Oct, super admin module 1): the super admin adds tables, sets each one's
-- seats and its stakes, from the console. A permission of its own, tables.manage, as the Floor and Cashier roles (#644)
-- run the tables but do not set them up. A stake is a table type: its game and blinds, in whole ₹50 chips; a new one has
-- three hours of call time (#634). Buy-ins are off the consoles (decision 0284), so a new type's buy-in range is set from
-- its big blind and nobody is asked for it.

insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['tables.manage']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['tables.manage']) as permission;

-- Tables and table types are written only through the functions below, which check the freeze and who sits where: the
-- API writes neither directly any more (the floor opens and closes tables through set_table_open).
drop policy "floor managers add table types" on public.table_type;
drop policy "floor managers change table types" on public.table_type;
drop policy "floor managers add tables" on public.game_table;
drop policy "floor managers open, close and change tables" on public.game_table;

-- The refusals every setup function shares: 42501 not tables.manage at the venue, RVFRZ the venue frozen.
create function private.assert_tables_manager(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'tables.manage') then
    raise exception 'Only the super admin sets up tables' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
end;
$$;
revoke execute on function private.assert_tables_manager(uuid) from public, anon, authenticated;

-- A new stake: its name, game and blinds in paise (whole ₹50 chips, the big above the small); its code from its game and
-- blinds, `nlh_100_200`, with a number after it when one has it already; its buy-in range from its big blind; three hours
-- of call time from now. Refusal: 22023 a blind that does not fit (check_violation from the table's checks).
create function private.add_table_type(p_venue_id uuid, p_name text, p_game text, p_small_blind_paise bigint, p_big_blind_paise bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := coalesce(p_game, '') || '_' || coalesce(p_small_blind_paise / 100, 0) || '_' || coalesce(p_big_blind_paise / 100, 0);
  v_id uuid;
begin
  perform private.assert_tables_manager(p_venue_id);
  if exists (select 1 from public.table_type t where t.venue_id = p_venue_id and t.code = v_code) then
    v_code := v_code || '_' || (select count(*) + 1 from public.table_type t where t.venue_id = p_venue_id and t.code like v_code || '%');
  end if;
  begin
    insert into public.table_type (venue_id, code, name, game, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise)
    values (p_venue_id, v_code, trim(p_name), p_game, p_small_blind_paise, p_big_blind_paise, p_big_blind_paise * 100, p_big_blind_paise * 100)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name, a game and blinds in whole ₹50 chips, the big above the small' using errcode = '22023';
  end;
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'call_time.minutes', v_code, '{"minutes": 180}', now(), 'A new stake has three hours of call time (#634)');
  return v_id;
end;
$$;

-- A stake's name and blinds, changed; a table playing it plays the new blinds from the next hand. Refusals as above.
create function private.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.table_type;
begin
  select * into v_type from public.table_type t where t.id = p_type_id for update;
  perform private.assert_tables_manager(v_type.venue_id);
  begin
    update public.table_type
    set name = trim(p_name), small_blind_paise = p_small_blind_paise, big_blind_paise = p_big_blind_paise,
        buy_in_min_paise = least(buy_in_min_paise, p_big_blind_paise * 100), buy_in_max_paise = greatest(buy_in_max_paise, p_big_blind_paise * 100)
    where id = v_type.id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name and blinds in whole ₹50 chips, the big above the small' using errcode = '22023';
  end;
end;
$$;

-- A new table: its name, stake, seats (2 to 10) and room, last in floor order, closed until the floor opens it. Refusals as
-- above; 22023 a name the venue has, or seats out of range.
create function private.add_game_table(p_venue_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_room text default 'main')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_tables_manager(p_venue_id);
  begin
    insert into public.game_table (venue_id, table_type_id, name, position, seats, is_open, room)
    values (p_venue_id, p_table_type_id, trim(p_name),
            coalesce((select max(g.position) from public.game_table g where g.venue_id = p_venue_id), 0) + 1, p_seats, false, coalesce(p_room, 'main'))
    returning id into v_id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue and 2 to 10 seats' using errcode = '22023';
  end;
  return v_id;
end;
$$;

-- A table's name, stake and seats, changed. Its stake changes only while nobody sits there or is called to it (RVSTD); its
-- seats never drop below one taken (RVOCC, game_table_seats_not_below_taken). Refusals as above.
create function private.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer)
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
  if p_table_type_id is distinct from v_table.table_type_id
     and (exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.ended_at is null)
          or exists (select 1 from public.waitlist_entry e where e.call_table_id = v_table.id and e.status = 'waiting')) then
    raise exception 'Move the players before changing the table''s stake' using errcode = 'RVSTD';
  end if;
  begin
    update public.game_table set name = trim(p_name), table_type_id = p_table_type_id, seats = p_seats where id = v_table.id;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then
    raise exception 'A table has a name of its own, a stake at this venue and 2 to 10 seats' using errcode = '22023';
  end;
end;
$$;

create function public.add_table_type(p_venue_id uuid, p_name text, p_game text, p_small_blind_paise bigint, p_big_blind_paise bigint)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_table_type(p_venue_id, p_name, p_game, p_small_blind_paise, p_big_blind_paise); $$;
create function public.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_table_type(p_type_id, p_name, p_small_blind_paise, p_big_blind_paise); $$;
create function public.add_game_table(p_venue_id uuid, p_name text, p_table_type_id uuid, p_seats integer, p_room text default 'main')
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_game_table(p_venue_id, p_name, p_table_type_id, p_seats, p_room); $$;
create function public.set_game_table(p_table_id uuid, p_name text, p_table_type_id uuid, p_seats integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_game_table(p_table_id, p_name, p_table_type_id, p_seats); $$;

revoke execute on function private.add_table_type(uuid, text, text, bigint, bigint), private.set_table_type(uuid, text, bigint, bigint),
  private.add_game_table(uuid, text, uuid, integer, text), private.set_game_table(uuid, text, uuid, integer),
  public.add_table_type(uuid, text, text, bigint, bigint), public.set_table_type(uuid, text, bigint, bigint),
  public.add_game_table(uuid, text, uuid, integer, text), public.set_game_table(uuid, text, uuid, integer) from public, anon;
grant execute on function private.add_table_type(uuid, text, text, bigint, bigint), private.set_table_type(uuid, text, bigint, bigint),
  private.add_game_table(uuid, text, uuid, integer, text), private.set_game_table(uuid, text, uuid, integer),
  public.add_table_type(uuid, text, text, bigint, bigint), public.set_table_type(uuid, text, bigint, bigint),
  public.add_game_table(uuid, text, uuid, integer, text), public.set_game_table(uuid, text, uuid, integer) to authenticated;
