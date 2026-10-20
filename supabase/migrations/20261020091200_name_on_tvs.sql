-- Members may hide their name on the room's TVs (#326; the owner's answer to #320; decision 0070).
-- Profile has "Show my name on the club's TVs", on by default. With it off, the TV's waitlist board
-- shows the member by their place on the list ("Player 2"): the board returns no name for them, so
-- their name never reaches a TV. Profile is core, so every tier has the choice.

alter table public.member_preference
  add column name_on_tvs boolean not null default true;

comment on column public.member_preference.name_on_tvs is
  'Whether the TVs'' waitlist board shows the member''s first name and initial; off, only their place.';

-- The signed-in member shows or hides their name on the club's TVs.
create function private.set_my_name_on_tvs(p_is_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null then
    raise exception 'Only a member has preferences' using errcode = '42501';
  end if;
  insert into public.member_preference (member_id, venue_id, name_on_tvs)
  values (v_member_id, v_venue_id, p_is_on)
  on conflict (member_id) do update set name_on_tvs = excluded.name_on_tvs;
end;
$$;

-- The board as #65 built it, with no name for a member who hid theirs.
create or replace function private.tv_waitlist_board()
returns table (table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, open_tables integer,
               place integer, display_name text, call_table_name text, is_away boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with tv as (
    select d.venue_id from public.device d join public.tv_screen s on s.device_id = d.id
    where d.id = (select private.current_device_id()) and d.kind = 'tv' and s.mode = 'waitlist'
  ),
  types as (select t.* from public.table_type t join tv on tv.venue_id = t.venue_id)
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

-- Hiding or showing the name changes what the board shows, so the venue's TVs read it again.
create trigger member_preference_tv_signal after insert on public.member_preference
  for each row when (not new.name_on_tvs)
  execute function private.signal_waitlist_change();
create trigger member_preference_tv_signal_change after update on public.member_preference
  for each row when (old.name_on_tvs is distinct from new.name_on_tvs)
  execute function private.signal_waitlist_change();

create function public.set_my_name_on_tvs(p_is_on boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.set_my_name_on_tvs(p_is_on);
$$;

revoke execute on function private.set_my_name_on_tvs(boolean), public.set_my_name_on_tvs(boolean) from public, anon;
grant execute on function private.set_my_name_on_tvs(boolean), public.set_my_name_on_tvs(boolean) to authenticated;
