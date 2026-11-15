-- The TVs show five boards and nothing else (redesign of 15 Nov 2026, issue 971; docs/spec/redesign-2026-11-15.md slice 11;
-- decision 0631): the waitlist, call time, promotions, the hours leaderboard and the high hand bonus. Settings, TVs,
-- Rotation says which boards are on and how many seconds each shows.
--
-- The type public.tv_mode keeps the labels of the boards that went (decision 0587): Postgres drops a label only by making the
-- type again under every column, constraint and function that uses it. The constraint below is the list: a TV holds none
-- but the five.

-- A board that went leaves a rotation, and a TV whose main board it was shows the waitlist.
update public.tv_screen
set rotation = (select coalesce(array_agg(r.m order by r.n), '{}') from unnest(rotation) with ordinality as r (m, n)
                where r.m::text = any (array['waitlist', 'call_time', 'promotions', 'leaderboard', 'high_hand']))
where not rotation::text[] <@ array['waitlist', 'call_time', 'promotions', 'leaderboard', 'high_hand'];
update public.tv_screen
set mode = 'waitlist', rotation = array_remove(rotation, 'waitlist')
where mode::text <> all (array['waitlist', 'call_time', 'promotions', 'leaderboard', 'high_hand']);

alter table public.tv_screen drop constraint tv_screen_boards_in_use;
alter table public.tv_screen add constraint tv_screen_boards_in_use
  check (mode::text = any (array['waitlist', 'call_time', 'promotions', 'leaderboard', 'high_hand'])
         and rotation::text[] <@ array['waitlist', 'call_time', 'promotions', 'leaderboard', 'high_hand']);

-- Which boards are on, and the seconds each shows. None set: every board, 30 seconds each, a promotion 12 seconds a slide.
insert into public.setting_key (key, description, scope, value_schema) values
  ('tv.boards',
   'The boards the TVs show: a board switched off is left out on every TV. None set is every board.',
   'venue',
   '{"type":"object","properties":{"waitlist":{"type":"boolean"},"call_time":{"type":"boolean"},"promotions":{"type":"boolean"},"leaderboard":{"type":"boolean"},"high_hand":{"type":"boolean"}},"required":["waitlist","call_time","promotions","leaderboard","high_hand"],"additionalProperties":false}'),
  ('tv.board_seconds',
   'How long each board shows on a TV before the next, in seconds; a promotion, each slide. None set is 30 seconds, and 12 a promotion.',
   'venue',
   '{"type":"object","properties":{"waitlist_seconds":{"type":"integer","minimum":5,"maximum":600},"call_time_seconds":{"type":"integer","minimum":5,"maximum":600},"promotions_seconds":{"type":"integer","minimum":5,"maximum":600},"leaderboard_seconds":{"type":"integer","minimum":5,"maximum":600},"high_hand_seconds":{"type":"integer","minimum":5,"maximum":600}},"required":["waitlist_seconds","call_time_seconds","promotions_seconds","leaderboard_seconds","high_hand_seconds"],"additionalProperties":false}');

-- The boards a TV shows, in order: its own, then those it turns to, less any the venue switched off; the waitlist when
-- none is left, so a TV always shows something. One rule for what a TV is told to show and for what it may read.
create function private.tv_boards(p_venue_id uuid, p_mode public.tv_mode, p_rotation public.tv_mode[])
returns public.tv_mode[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(array(
    select b.board
    from unnest(array[p_mode] || p_rotation) with ordinality as b (board, n)
    where coalesce((private.setting_at(p_venue_id, 'tv.boards', '', now()) ->> b.board::text)::boolean, true)
    order by b.n), '{}'), array['waitlist']::public.tv_mode[]);
$$;

-- The seconds a board shows at a venue: as set, or 30, and 12 for a promotion's slide.
create function private.tv_board_seconds(p_venue_id uuid, p_board public.tv_mode)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'tv.board_seconds', '', now()) ->> (p_board::text || '_seconds'))::numeric::integer,
                  case when p_board = 'promotions' then 12 else 30 end);
$$;
revoke execute on function private.tv_boards(uuid, public.tv_mode, public.tv_mode[]), private.tv_board_seconds(uuid, public.tv_mode)
  from public, anon, authenticated;

-- As 20261026090000_call_time_board.sql made it, by the boards the TV shows now: one switched off is not read, and the
-- waitlist is when it stands in for a TV left with none.
create or replace function private.tv_showing(p_mode public.tv_mode)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.venue_id from public.device d join public.tv_screen s on s.device_id = d.id
  where d.id = (select private.current_device_id()) and d.kind = 'tv' and p_mode = any (private.tv_boards(d.venue_id, s.mode, s.rotation));
$$;

-- The signed-in TV: its name, the boards it shows in order, and the seconds each shows.
drop function public.my_tv_screen();
drop function private.my_tv_screen();
create function private.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, b.boards,
         array(select private.tv_board_seconds(d.venue_id, t.board) from unnest(b.boards) with ordinality as t (board, n) order by t.n)
  from public.device d
  join public.tv_screen s on s.device_id = d.id
  cross join lateral (select private.tv_boards(d.venue_id, s.mode, s.rotation) as boards) b
  where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;
create function public.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, boards public.tv_mode[], seconds integer[])
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tv_screen(); $$;
revoke execute on function private.my_tv_screen(), public.my_tv_screen() from public, anon;
grant execute on function private.my_tv_screen(), public.my_tv_screen() to authenticated;
