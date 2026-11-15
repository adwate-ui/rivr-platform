-- The TV's High hand bonus board is one of the five a TV shows (20261120210100_tv_five_boards.sql), so its read is
-- allowed as the other boards' are: to a TV that has the board as its own or turns to it, while the venue has not
-- switched it off (private.tv_showing). As 20261120140000_high_hand_for_the_member_and_the_tv.sql made it, which let
-- any TV of the venue read it while the board was not yet one a TV could show.
create or replace function private.tv_high_hand()
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
  -- The venue of the TV that asks, while the High hand bonus board is among those it shows.
  where v.venue_id = private.tv_showing('high_hand') and v.status = 'live' and v.reward ->> 'kind' = 'high_hand'
    and private.promotion_shows_on(v.promotion_id, 'tv');
$$;
