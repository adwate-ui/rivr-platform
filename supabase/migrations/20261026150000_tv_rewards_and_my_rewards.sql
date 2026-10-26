-- The TVs' rewards ticker and League leaderboard (#148, decision 0183), and the player app's Rewards tab
-- (#152). A TV reads either board only while it is its main mode or in its rotation (decision 0163,
-- private.tv_showing). The ticker shows this League month's five points leaders (points earned at the
-- tables, both schemes, as points_earning holds them) and the week's last six redemptions (the board
-- shows six to a column); the leaderboard shows the League's board (decision 0182). Both name a member
-- by first name and initial, or not at all for one who hid their name on the TVs (#326); nobody who
-- excluded themselves from play shows. A member reads their own points and tier, and their
-- redemptions with rewards.catalogue.

-- The rewards ticker for a paired TV showing it: 'leader' rows (place, name, points), in place order, then
-- 'redemption' rows (name, reward, when), newest first.
create function private.tv_rewards_ticker()
returns table (kind text, place integer, display_name text, points bigint, reward_name text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with venue as (select private.tv_showing('rewards') as id),
  earned as (
    select e.member_id, sum(e.points) as points
    from venue join public.visit v on v.venue_id = venue.id
    join public.points_earning e on e.visit_id = v.id
    where v.closed_at >= (private.league_month(now()) + interval '6 hours') at time zone 'Asia/Kolkata'
      and not exists (select 1 from public.self_exclusion x where x.member_id = e.member_id and x.starts_at <= now() and x.ends_at > now())
    group by e.member_id
    having sum(e.points) > 0
  ),
  leaders as (
    select 'leader'::text as kind, (rank() over (order by l.points desc))::integer as place,
           case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end as display_name, l.points,
           null::text as reward_name, null::timestamptz as at
    from earned l join public.member m on m.id = l.member_id left join public.member_preference p on p.member_id = m.id
    order by l.points desc, m.full_name limit 5
  ),
  redeemed as (
    select 'redemption'::text as kind, null::integer as place,
           case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end as display_name, r.points,
           i.name as reward_name, r.created_at as at
    from venue join public.redemption r on r.venue_id = venue.id
    join public.reward_item i on i.id = r.reward_item_id
    join public.member m on m.id = r.member_id left join public.member_preference p on p.member_id = m.id
    where r.created_at > now() - interval '7 days'
      and not exists (select 1 from public.self_exclusion x where x.member_id = r.member_id and x.starts_at <= now() and x.ends_at > now())
    order by r.created_at desc limit 6
  )
  select * from (select * from leaders union all select * from redeemed) t
  order by t.kind, t.place, t.at desc;
$$;

-- The League's board for a paired TV showing it: this month's top ten and the season's (decision 0182).
create function private.tv_league_board()
returns table (standing text, season_name text, first_month date, last_month date, place integer, display_name text, points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select b.standing, b.season_name, b.first_month, b.last_month, b.place, b.display_name, b.points
  from private.league_board(private.tv_showing('league')) b;
$$;

-- A redemption, or a League finish, tells the venue's TVs at once (their read every half minute is the fallback).
create function private.signal_rewards_boards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(new.venue_id, case tg_table_name when 'redemption' then 'rewards' else 'league' end);
  return null;
end;
$$;

create trigger redemption_signal_tv after insert on public.redemption
  for each row execute function private.signal_rewards_boards();
create trigger league_finish_signal_tv after insert on public.league_finish
  for each row execute function private.signal_rewards_boards();

-- The signed-in member's points and tier, for the top of Rewards.
create function private.my_rewards()
returns table (points bigint, tier_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.points'), 0)::bigint,
         t.name
  from public.member m join public.tier t on t.id = m.tier_id
  where m.id = private.current_member_id();
$$;

-- The signed-in member's last twenty redemptions, with rewards.catalogue: the reward and where to collect
-- it, even once it is retired, the points it took, and when it was handed over.
create function private.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, created_at timestamptz, handed_over_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, i.name, i.kind, i.detail, r.points, r.created_at, r.handed_over_at
  from public.redemption r join public.reward_item i on i.id = r.reward_item_id
  where r.member_id = private.current_member_id() and private.has_feature(r.member_id, 'rewards.catalogue')
  order by r.created_at desc
  limit 20;
$$;

create function public.tv_rewards_ticker()
returns table (kind text, place integer, display_name text, points bigint, reward_name text, at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_rewards_ticker(); $$;
create function public.tv_league_board()
returns table (standing text, season_name text, first_month date, last_month date, place integer, display_name text, points bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_league_board(); $$;
create function public.my_rewards()
returns table (points bigint, tier_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_rewards(); $$;
create function public.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, created_at timestamptz, handed_over_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_redemptions(); $$;

revoke execute on function private.tv_rewards_ticker(), private.tv_league_board(), private.my_rewards(), private.my_redemptions(),
  private.signal_rewards_boards() from public, anon, authenticated;
grant execute on function private.tv_rewards_ticker(), private.tv_league_board(), private.my_rewards(), private.my_redemptions() to authenticated;
revoke execute on function public.tv_rewards_ticker(), public.tv_league_board(), public.my_rewards(), public.my_redemptions() from public, anon;
grant execute on function public.tv_rewards_ticker(), public.tv_league_board(), public.my_rewards(), public.my_redemptions() to authenticated;
