-- The leaving list and the TV's call-time board (owner, 26 Oct 2026; additions "TV modes"; #148;
-- decision 0163). A player who is up and wants to go tells the floor, which marks their seat leaving.
-- The console's Leaving list and the TV's call-time board count down the call time the player still
-- owes (#78): the seat opens once it is done, so the floor and the waitlist see which seats open, and
-- when. A TV may also turn to other boards in between its main one (tv_screen.rotation), so the live
-- promotions come round between the waitlist, the call-time board and the jackpot.

-- When the floor marked the player leaving, and who did; cleared when the floor takes it back.
alter table public.seat_session
  add column leaving_at timestamptz,
  add column leaving_by_staff_id uuid,
  add foreign key (leaving_by_staff_id, venue_id) references public.staff (id, venue_id);
create index seat_session_leaving_by_venue_idx on public.seat_session (leaving_by_staff_id, venue_id);

-- The boards a TV turns to after its main one, in order; each once, never the main one.
alter table public.tv_screen
  add column rotation public.tv_mode[] not null default '{}'
    check (cardinality(rotation) <= 8 and array_position(rotation, null) is null and not mode = any (rotation));
comment on column public.tv_screen.rotation is 'The boards a TV turns to after its main mode, in order (decision 0163).';

-- The floor (waitlist.manage) marks a seated player leaving, or takes it back. Refusals: 42501 not the
-- floor, 22023 the player no longer seated, RVFRZ/RVMBR the venue or the member frozen.
create function private.set_leaving(p_session_id uuid, p_is_leaving boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor marks a player leaving' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or p_is_leaving is null then
    raise exception 'That player is no longer seated' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if p_is_leaving = (v_session.leaving_at is not null) then return; end if;
  update public.seat_session
  set leaving_at = case when p_is_leaving then now() end,
      leaving_by_staff_id = case when p_is_leaving then private.current_staff_id(v_session.venue_id) end
  where id = v_session.id;
end;
$$;

-- The venue of the signed-in TV while it shows this board, as its main mode or in its rotation.
create function private.tv_showing(p_mode public.tv_mode)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.venue_id from public.device d join public.tv_screen s on s.device_id = d.id
  where d.id = (select private.current_device_id()) and d.kind = 'tv' and (s.mode = p_mode or p_mode = any (s.rotation));
$$;

-- As in 20261020091200_name_on_tvs.sql, now also while the waitlist is in the TV's rotation.
create or replace function private.tv_waitlist_board()
returns table (table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, open_tables integer,
               place integer, display_name text, call_table_name text, is_away boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with types as (select t.* from public.table_type t where t.venue_id = private.tv_showing('waitlist'))
  select ty.id, ty.name, ty.small_blind_paise, ty.big_blind_paise,
         (select count(*)::integer from public.game_table g where g.table_type_id = ty.id and g.is_open),
         r.place,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         ct.name, e.stepped_away_at is not null
  from types ty
  left join private.ranked_waitlist(array(select types.id from types)) r on r.table_type_id = ty.id
  left join public.waitlist_entry e on e.id = r.entry_id
  left join public.member m on m.id = r.member_id
  left join public.member_preference p on p.member_id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  order by ty.big_blind_paise, ty.small_blind_paise, ty.name, r.place;
$$;

-- The TV's call-time board, only while the TV shows it: every seated player still on call time or
-- marked leaving, table by table in the room's order, as a first name and initial (or nothing, for a
-- member who hid their name, #326), with the whole seconds of call time left (null where the table's
-- type has none), away, and when the floor marked them leaving. Nobody else's name reaches the TV.
create function private.tv_call_time_board()
returns table (table_id uuid, table_name text, stake_name text, seat integer, display_name text, call_time_left integer,
               is_away boolean, leaving_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ty.name, s.seat,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         private.session_call_time(s, now()), s.away_since is not null, s.leaving_at
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type ty on ty.id = g.table_type_id
  join public.member m on m.id = s.member_id
  left join public.member_preference p on p.member_id = s.member_id
  where s.venue_id = private.tv_showing('call_time') and s.ended_at is null
    and (s.leaving_at is not null or private.session_call_time(s, now()) > 0)
  order by g.position, s.seat;
$$;

-- What the board shows changes as players sit, move, step away, are marked leaving and leave.
create function private.signal_call_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(coalesce(new.venue_id, old.venue_id), 'call_time');
  return null;
end;
$$;

create trigger seat_session_tv_signal after insert on public.seat_session
  for each row execute function private.signal_call_time_change();
create trigger seat_session_tv_signal_change after update on public.seat_session
  for each row
  when ((old.table_id, old.seat, old.ended_at, old.away_since, old.leaving_at)
        is distinct from (new.table_id, new.seat, new.ended_at, new.away_since, new.leaving_at))
  execute function private.signal_call_time_change();
-- Hiding or showing the name changes it too (as the waitlist board's triggers in 20261020091200).
create trigger member_preference_call_time_signal after insert on public.member_preference
  for each row when (not new.name_on_tvs)
  execute function private.signal_call_time_change();
create trigger member_preference_call_time_signal_change after update on public.member_preference
  for each row when (old.name_on_tvs is distinct from new.name_on_tvs)
  execute function private.signal_call_time_change();

-- The floor's seat map (#77, #78) now says who is leaving.
drop function public.floor_seats(uuid);
drop function private.floor_seats(uuid);
create function private.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.table_id, s.seat, m.id, m.full_name, tr.name, s.started_at,
         case when g.must_move_to_table_id is not null
              then (row_number() over (partition by s.table_id order by s.seated_here_at, s.id))::integer end,
         s.away_since, private.session_call_time(s, now()), s.leaving_at
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.member m on m.id = s.member_id
  join public.tier tr on tr.id = m.tier_id
  where s.venue_id = p_venue_id and s.ended_at is null and private.has_permission(p_venue_id, 'members.read')
  order by g.position, s.seat;
$$;
create function public.floor_seats(p_venue_id uuid)
returns table (session_id uuid, table_id uuid, seat integer, member_id uuid, full_name text, tier_name text,
               started_at timestamptz, must_move_order integer, away_since timestamptz, call_time_left integer, leaving_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_seats(p_venue_id); $$;

-- A TV's main mode is never in its rotation: changing the main mode takes it out.
create or replace function private.set_tv_mode(p_device_id uuid, p_mode public.tv_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['tv']::public.device_kind[]);
begin
  perform private.assert_writable(v_venue_id);
  insert into public.tv_screen (device_id, venue_id, mode, set_by_staff_id)
  values (p_device_id, v_venue_id, p_mode, private.current_staff_id(v_venue_id))
  on conflict on constraint tv_screen_pkey
  do update set mode = excluded.mode, rotation = array_remove(public.tv_screen.rotation, excluded.mode),
                set_by_staff_id = excluded.set_by_staff_id;
end;
$$;

-- Staff with devices.manage choose the boards a TV turns to after its main one, in order. Refusals as
-- set_tv_mode's, and 22023 for a board named twice, the main one, more than eight or a TV not yet paired.
create function private.set_tv_rotation(p_device_id uuid, p_rotation public.tv_mode[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['tv']::public.device_kind[]);
begin
  perform private.assert_writable(v_venue_id);
  if p_rotation is null or cardinality(p_rotation) > 8 or array_position(p_rotation, null) is not null
     or cardinality(p_rotation) <> (select count(distinct r) from unnest(p_rotation) r) then
    raise exception 'A rotation names each board once, up to eight' using errcode = '22023';
  end if;
  update public.tv_screen s set rotation = p_rotation, set_by_staff_id = private.current_staff_id(v_venue_id)
  where s.device_id = p_device_id and not s.mode = any (p_rotation);
  if not found then
    raise exception 'A rotation is the boards after the main one, on a paired TV' using errcode = '22023';
  end if;
end;
$$;

-- The signed-in TV (#49) now also says what it turns to.
drop function public.my_tv_screen();
drop function private.my_tv_screen();
create function private.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, mode public.tv_mode, rotation public.tv_mode[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, s.mode, s.rotation
  from public.device d
  join public.tv_screen s on s.device_id = d.id
  where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;
create function public.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, mode public.tv_mode, rotation public.tv_mode[])
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tv_screen(); $$;

create function public.set_leaving(p_session_id uuid, p_is_leaving boolean)
returns void
language sql security invoker set search_path = ''
as $$ select private.set_leaving(p_session_id, p_is_leaving); $$;

create function public.set_tv_rotation(p_device_id uuid, p_rotation public.tv_mode[])
returns void
language sql security invoker set search_path = ''
as $$ select private.set_tv_rotation(p_device_id, p_rotation); $$;

create function public.tv_call_time_board()
returns table (table_id uuid, table_name text, stake_name text, seat integer, display_name text, call_time_left integer,
               is_away boolean, leaving_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_call_time_board(); $$;

revoke execute on function private.set_leaving(uuid, boolean), private.tv_showing(public.tv_mode), private.tv_call_time_board(),
  private.signal_call_time_change(), private.floor_seats(uuid), private.set_tv_rotation(uuid, public.tv_mode[]), private.my_tv_screen()
  from public, anon, authenticated;
grant execute on function private.set_leaving(uuid, boolean), private.tv_call_time_board(), private.floor_seats(uuid),
  private.set_tv_rotation(uuid, public.tv_mode[]), private.my_tv_screen() to authenticated;
revoke execute on function public.set_leaving(uuid, boolean), public.set_tv_rotation(uuid, public.tv_mode[]), public.tv_call_time_board(),
  public.floor_seats(uuid), public.my_tv_screen() from public, anon;
grant execute on function public.set_leaving(uuid, boolean), public.set_tv_rotation(uuid, public.tv_mode[]), public.tv_call_time_board(),
  public.floor_seats(uuid), public.my_tv_screen() to authenticated;
