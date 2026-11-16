-- A TV knows whether its venue is the practice one (decision 0673), so the TV app reports no error from it: the practice
-- venue never reaches a vendor. my_tv_screen gains `is_practice` as its last column, so a TV still running the build
-- before this one reads what it read before (as 20261120500200 kept `mode` and `rotation` for the same reason).
drop function public.my_tv_screen();
drop function private.my_tv_screen();
create function private.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[], mode public.tv_mode, rotation public.tv_mode[],
               is_practice boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, b.boards,
         array(select private.tv_board_seconds(d.venue_id, t.board) from unnest(b.boards) with ordinality as t (board, n) order by t.n),
         s.mode, s.rotation, v.is_practice
  from public.device d
  join public.tv_screen s on s.device_id = d.id
  join public.venue v on v.id = d.venue_id
  cross join lateral (select private.tv_boards(d.venue_id, s.mode, s.rotation) as boards) b
  where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;
create function public.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[], mode public.tv_mode, rotation public.tv_mode[],
               is_practice boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tv_screen(); $$;
revoke execute on function private.my_tv_screen(), public.my_tv_screen() from public, anon;
grant execute on function private.my_tv_screen(), public.my_tv_screen() to authenticated;
