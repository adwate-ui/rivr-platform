-- What a paired TV shows (#65; design prompt TV; additions "TV modes"): the waitlist board by stake,
-- and the bad-beat jackpot with tonight's high hand. A TV reads them for its own venue only, through
-- the functions below; the waitlist board only while the TV shows it, and a player there is a first
-- name and initial, never a full name, number or id (question #320). The practice venue's TVs
-- show the practice venue's boards. To keep a TV live, the database broadcasts on the venue's
-- private Realtime topic (tv:<venue id>) when what a board shows changes; only the venue's TVs
-- hear it (decision 0051).

-- First name and the initial of the last: "Arjun Mehta" is "Arjun M."; dots, hyphens and underscores
-- split names as spaces do, so "Arjun.Mehta" is too. A single name stays whole.
create function private.first_name_and_initial(p_full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when cardinality(n.parts) > 1 then n.parts[1] || ' ' || left(n.parts[cardinality(n.parts)], 1) || '.' else n.parts[1] end
  from (select regexp_split_to_array(regexp_replace(p_full_name, '^[\s._-]+|[\s._-]+$', '', 'g'), '[\s._-]+') as parts) n;
$$;

-- The venue of the signed-in TV; null for anyone else.
create function private.current_tv_venue_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.venue_id from public.device d where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;

-- The TV's waitlist board, only while the TV shows it: every table type at its venue, smallest
-- stake first, with the tables open at it and each place in order (the floor's order, priority
-- included). A table type nobody waits for is one row with no place. Called places name the table;
-- away places say so.
create function private.tv_waitlist_board()
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
         r.place, private.first_name_and_initial(m.full_name), ct.name, e.stepped_away_at is not null
  from types ty
  left join private.ranked_waitlist(array(select types.id from types)) r on r.table_type_id = ty.id
  left join public.waitlist_entry e on e.id = r.entry_id
  left join public.member m on m.id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  order by ty.big_blind_paise, ty.small_blind_paise, ty.name, r.place;
$$;

-- Tonight's best high hand at a venue: the highest category approved for a hand played since 06:00
-- IST, the latest of those (decision 0050). Shared by the public view and the TV.
create function private.tonight_high_hand(p_venue_id uuid)
returns table (category public.high_hand_category, rank text, table_name text, played_at timestamptz, payout_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.category, c.rank, t.name, h.played_at, c.payout_paise
  from public.high_hand_claim c
  join public.hand h on h.id = c.hand_id
  join public.game_table t on t.id = c.table_id
  where c.venue_id = p_venue_id and c.status = 'approved' and h.played_at >= private.tonight_began(now())
  order by c.category desc, h.played_at desc
  limit 1;
$$;

create or replace function private.public_high_hand_rows()
returns table (venue_slug text, category public.high_hand_category, rank text, table_name text, played_at timestamptz, payout_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, b.category, b.rank, b.table_name, b.played_at, b.payout_paise
  from public.venue v cross join lateral private.tonight_high_hand(v.id) b
  where not v.is_practice;
$$;

-- The TV's jackpot: the main pool now, and tonight's best high hand (no high hand's fields when none).
create function private.tv_jackpot()
returns table (main_paise bigint, high_hand_category public.high_hand_category, high_hand_rank text, high_hand_table_name text,
               high_hand_played_at timestamptz, high_hand_payout_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select b.natural_balance from public.ledger_balance b where b.venue_id = tv.venue_id and b.code = 'venue.jackpot.main'), 0)::bigint,
         hh.category, hh.rank, hh.table_name, hh.played_at, hh.payout_paise
  from (select private.current_tv_venue_id() as venue_id) tv
  left join lateral private.tonight_high_hand(tv.venue_id) hh on true
  where tv.venue_id is not null;
$$;

-- Tells the venue's TVs that a board changed, on its private topic: a broadcast message, not a row
-- anyone updates, so busy paths never wait on one another for it. The message names the board only.
create function private.signal_tv(p_venue_id uuid, p_board text)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send(jsonb_build_object('board', p_board), p_board, 'tv:' || p_venue_id::text, true);
$$;

create function private.signal_waitlist_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(coalesce(new.venue_id, old.venue_id), 'waitlist');
  return null;
end;
$$;

-- A place joins or goes; and on a change, only what the board shows: on the list, called and where, away.
create trigger waitlist_entry_tv_signal after insert or delete on public.waitlist_entry
  for each row execute function private.signal_waitlist_change();
create trigger waitlist_entry_tv_signal_change after update on public.waitlist_entry
  for each row
  when ((old.status, old.call_table_id, old.stepped_away_at) is distinct from (new.status, new.call_table_id, new.stepped_away_at))
  execute function private.signal_waitlist_change();
-- A table opens or closes: the board counts the tables open at each stake.
create trigger game_table_tv_signal after update on public.game_table
  for each row when (old.is_open is distinct from new.is_open)
  execute function private.signal_waitlist_change();

create function private.signal_high_hand_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(new.venue_id, 'jackpot');
  return null;
end;
$$;

create trigger high_hand_claim_tv_signal after update on public.high_hand_claim
  for each row when (new.status = 'approved' and old.status is distinct from new.status)
  execute function private.signal_high_hand_change();

-- Once per posting, for each venue whose main jackpot pool it moved: a drop, a payout or a reversal.
create function private.signal_jackpot_postings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(moved.venue_id, 'jackpot')
  from (select distinct a.venue_id from new_entries n join public.ledger_account a on a.id = n.account_id
        where a.code = 'venue.jackpot.main') moved;
  return null;
end;
$$;

create trigger ledger_entry_tv_signal after insert on public.ledger_entry
  referencing new table as new_entries
  for each statement execute function private.signal_jackpot_postings();

-- Only the venue's own TVs hear its topic: Realtime checks this as the TV subscribes.
create policy "a venue's TVs hear its boards' signals" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast'
         and (select realtime.topic()) = 'tv:' || (select private.current_tv_venue_id())::text);

revoke execute on function private.first_name_and_initial(text), private.current_tv_venue_id(), private.tonight_high_hand(uuid),
  private.signal_tv(uuid, text), private.signal_waitlist_change(), private.signal_high_hand_change(), private.signal_jackpot_postings(),
  private.tv_waitlist_board(), private.tv_jackpot()
  from public, anon, authenticated;
grant execute on function private.current_tv_venue_id(), private.tv_waitlist_board(), private.tv_jackpot() to authenticated;

create function public.tv_waitlist_board()
returns table (table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, open_tables integer,
               place integer, display_name text, call_table_name text, is_away boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_waitlist_board(); $$;

create function public.tv_jackpot()
returns table (main_paise bigint, high_hand_category public.high_hand_category, high_hand_rank text, high_hand_table_name text,
               high_hand_played_at timestamptz, high_hand_payout_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_jackpot(); $$;

revoke execute on function public.tv_waitlist_board(), public.tv_jackpot() from public, anon;
grant execute on function public.tv_waitlist_board(), public.tv_jackpot() to authenticated;
