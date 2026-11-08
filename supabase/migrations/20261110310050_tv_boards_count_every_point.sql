-- The rewards ticker's points leaders count every point credited this League month, from play, promotions, verification and
-- points given or released by hand, not play alone (audit 8 Nov, F-043: points.per_hour is 0, so the column was always
-- empty). Its redemptions stop at the five rows the board shows (F-044). And no TV is left on a board the club hid (F-136).

create or replace function private.tv_rewards_ticker()
returns table (kind text, place integer, display_name text, points bigint, reward_name text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with venue as (select private.tv_showing('rewards') as id),
  earned as (
    select a.member_id, sum(-e.amount)::bigint as points
    from venue join public.ledger_transaction t on t.venue_id = venue.id
    join public.ledger_entry e on e.transaction_id = t.id
    join public.ledger_account a on a.id = e.account_id and a.code = 'member.points'
    where t.kind in ('points_earned', 'points_unlocked')
      and t.occurred_at >= (private.league_month(now()) + interval '6 hours') at time zone 'Asia/Kolkata'
      and not exists (select 1 from public.self_exclusion x where x.member_id = a.member_id and x.starts_at <= now() and x.ends_at > now())
    group by a.member_id
    having sum(-e.amount) > 0
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
    order by r.created_at desc limit 5
  )
  select * from (select * from leaders union all select * from redeemed) t
  order by t.kind, t.place, t.at desc;
$$;

-- A TV left on a board the club hid moves to the waitlist, which is what it was already drawing, and no rotation names a hidden
-- board (F-136). tv_showing stays as it is, so a device reads only the boards it is set to.
update public.tv_screen s
set mode = 'waitlist',
    rotation = array(select r from unnest(s.rotation) with ordinality as u (r, n) where r not in ('waitlist', 'jackpot', 'tournament_clock') order by n)
where s.mode in ('jackpot', 'tournament_clock');

update public.tv_screen s
set rotation = array(select r from unnest(s.rotation) with ordinality as u (r, n) where r not in ('jackpot', 'tournament_clock') order by n)
where s.rotation && array['jackpot', 'tournament_clock']::public.tv_mode[];

-- The practice venue's seed holds the TVs as they now stand (database.md, decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
