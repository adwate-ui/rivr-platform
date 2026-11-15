-- The high hand for the member and on the TV (redesign RD-25). The member's offers show the high hand that runs at their
-- club, with its hands; a payout's line in their Bonus history names the hand; and a TV reads the hands, the rules and
-- tonight's payouts, and is told when one is paid.

-- A hit has a grant of its own (log_high_hand gives one a request): held here, so a history line names one hand. It
-- takes the place of the plain index on the same column.
drop index public.high_hand_hit_bonus_idx;
create unique index high_hand_hit_bonus_grant_key on public.high_hand_hit (bonus_grant_id);

-- The member's Bonus history, as before, with the hand of a line a high hand paid: the app says "High hand: Four Jacks"
-- in place of the promotion's name. One more pair of columns, so the two functions are made again.
drop function public.my_bonus_history(integer);
drop function private.my_bonus_history(integer);

create function private.my_bonus_history(p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text, hand text, rank text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.line_id, h.at, h.kind, h.amount_paise, h.reason, h.table_name, hit.hand, hit.rank
  from private.bonus_history(private.current_member_id(), p_limit) h
  -- A grant's id is its line's, given or expired; only the line that gave it names the hand.
  left join public.high_hand_hit hit on hit.bonus_grant_id = h.line_id and h.kind = 'credited'
  where private.current_member_id() is not null
  order by h.at desc, h.line_id;
$$;

create function public.my_bonus_history(p_limit integer default 20)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text, hand text, rank text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_bonus_history(p_limit); $$;

revoke execute on function private.my_bonus_history(integer), public.my_bonus_history(integer) from public, anon;
grant execute on function private.my_bonus_history(integer), public.my_bonus_history(integer) to authenticated;

-- The high hand among the member's offers: the one that runs at their club, where their tier has the offers
-- (promotions.feed) and the promotion shows in the app, exactly as its card would (my_promotion_cards).
create function private.my_high_hand()
returns table (promotion_id uuid, name text, reward jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.promotion_id, v.name, v.reward
  from public.promotion_version v
  where v.venue_id = private.current_member_venue_id() and v.status = 'live' and v.reward ->> 'kind' = 'high_hand'
    and exists (select 1 from private.my_promotion_cards() c where c.promotion_id = v.promotion_id);
$$;

create function public.my_high_hand()
returns table (promotion_id uuid, name text, reward jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_high_hand(); $$;

revoke execute on function private.my_high_hand(), public.my_high_hand() from public, anon;
grant execute on function private.my_high_hand(), public.my_high_hand() to authenticated;

-- The TV's High hand bonus board: the high hand that runs at the TV's venue and shows on the TVs, its hands and rules,
-- and what it paid tonight, the newest first, twelve at most. A member is a first name and initial, or for one who hid
-- their name on the TVs their member number, as the hours leaderboard has them; like it, the board leaves out a member
-- since erased or on a break from play. A TV reads its own venue's alone, so a practice venue's payouts are on no other
-- venue's TV.
create function private.tv_high_hand()
returns table (promotion_id uuid, name text, reward jsonb, payouts jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.promotion_id, v.name, v.reward,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', h.id, 'at', h.created_at, 'hand', h.hand, 'rank', h.rank, 'chips', h.chips, 'table', g.name,
                    'name', case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
                    'member_number', case when not coalesce(p.name_on_tvs, true) then m.member_number end)
                  order by h.created_at desc, h.id)
           from (select t.* from public.high_hand_hit t
                 join public.member shown on shown.id = t.member_id and shown.erased_at is null
                 where t.promotion_id = v.promotion_id and t.created_at >= private.tonight_began(now())
                   and not exists (select 1 from public.self_exclusion x where x.member_id = t.member_id and x.starts_at <= now() and x.ends_at > now())
                 order by t.created_at desc, t.id limit 12) h
           join public.member m on m.id = h.member_id
           join public.game_table g on g.id = h.table_id
           left join public.member_preference p on p.member_id = h.member_id), '[]'::jsonb)
  from public.promotion_version v
  -- The venue of the TV that asks. Once the board is one of a TV's modes this is private.tv_showing('high_hand').
  where v.venue_id = private.current_tv_venue_id() and v.status = 'live' and v.reward ->> 'kind' = 'high_hand'
    and private.promotion_shows_on(v.promotion_id, 'tv');
$$;

create function public.tv_high_hand()
returns table (promotion_id uuid, name text, reward jsonb, payouts jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_high_hand(); $$;

revoke execute on function private.tv_high_hand(), public.tv_high_hand() from public, anon;
grant execute on function private.tv_high_hand(), public.tv_high_hand() to authenticated;

-- A payout tells the venue's TVs to read the board again (20261019091400_tv_boards.sql), naming nothing.
create function private.high_hand_hit_signal_tv()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(new.venue_id, 'high_hand');
  return null;
end;
$$;
revoke execute on function private.high_hand_hit_signal_tv() from public, anon, authenticated;

create trigger high_hand_hit_signal_tv after insert on public.high_hand_hit
  for each row execute function private.high_hand_hit_signal_tv();
