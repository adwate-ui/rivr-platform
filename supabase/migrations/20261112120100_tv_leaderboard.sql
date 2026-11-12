-- The hours leaderboard on the TVs (the owner, 12 Nov; decision 0581; #907): members by the hours they played in a period the
-- club sets on the console (tv.leaderboard: tonight, this week, this month or all time), the top N, those past a number of
-- hours, or the top N of those; tonight's top 10 when none is set. Time played is a seat's time less its time away
-- (private.minutes_played), counted in the period its seat began. A member who hid their name on the TVs shows by their member
-- number, "Member #17" (the owner's choice for this board); an erased or self-excluded member is left out.

insert into public.setting_key (key, description, scope, value_schema) values
  ('tv.leaderboard',
   'The TVs'' hours leaderboard: the period it counts, and the top N members, those past a number of hours, or both. None set is tonight''s top 10.',
   'venue',
   '{"type":"object","properties":{"period":{"type":"string","enum":["tonight","week","month","all"]},"top":{"type":"integer","minimum":1,"maximum":12},"min_hours":{"type":"integer","minimum":1,"maximum":500}},"required":["period"],"additionalProperties":false}');

-- Each TV on the board reads a venue's seats by when they began, every half minute.
create index seat_session_venue_started_idx on public.seat_session (venue_id, started_at);

-- When the board's period began at `p_at`, in the club's days (06:00 IST, private.tonight_began): tonight; this week from its
-- Monday, as @rivr/domain weekOf; this month from its first, as private.league_month; or all time.
create function private.leaderboard_from(p_period text, p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'tonight' then private.tonight_began(p_at)
    when 'week' then (date_trunc('week', private.tonight_began(p_at) at time zone 'Asia/Kolkata') + interval '6 hours') at time zone 'Asia/Kolkata'
    when 'month' then (private.league_month(p_at) + interval '6 hours') at time zone 'Asia/Kolkata'
    else '-infinity'::timestamptz
  end;
$$;

-- The board at `p_at`: each member's minutes in the seats they took in the period up to `p_at`, ranked, ties sharing a place
-- (1, 2, 2, 4), and the places up to `p_top`, or every member past `p_min_hours` (at most 100), or the top places of those.
-- It runs as its caller, private.tv_leaderboard, and no API role may call it: it ranks any venue.
create function private.hours_leaderboard(p_venue_id uuid, p_period text, p_top integer, p_min_hours integer, p_at timestamptz)
returns table (place integer, member_id uuid, display_name text, member_number bigint, played_minutes integer)
language sql
stable
set search_path = ''
as $$
  with played as (
    select s.member_id, sum(private.minutes_played(s, p_at))::integer as minutes
    from public.seat_session s
    where s.venue_id = p_venue_id and s.started_at >= private.leaderboard_from(p_period, p_at) and s.started_at <= p_at
    group by s.member_id
  ),
  ranked as (
    select p.member_id, p.minutes, (rank() over (order by p.minutes desc))::integer as place
    from played p join public.member m on m.id = p.member_id
    where p.minutes > 0 and p.minutes >= coalesce(p_min_hours, 0) * 60 and m.erased_at is null
      and not exists (select 1 from public.self_exclusion x where x.member_id = p.member_id and x.starts_at <= now() and x.ends_at > now())
  )
  select r.place, r.member_id,
         case when coalesce(pr.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         case when not coalesce(pr.name_on_tvs, true) then m.member_number end,
         r.minutes
  from ranked r
  join public.member m on m.id = r.member_id
  left join public.member_preference pr on pr.member_id = r.member_id
  where r.place <= coalesce(p_top, case when p_min_hours is null then 10 else 100 end)
  order by r.place, m.member_number;
$$;

-- The signed-in TV's board while the leaderboard is its mode or in its rotation, as its venue sets it, with the period it counts.
create function private.tv_leaderboard()
returns table (period text, place integer, display_name text, member_number bigint, played_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  with board as (
    select v.venue_id, coalesce(c.value ->> 'period', 'tonight') as period, (c.value -> 'top')::integer as top,
           (c.value -> 'min_hours')::integer as min_hours
    from (select private.tv_showing('leaderboard') as venue_id) v
    cross join lateral (select private.setting_at(v.venue_id, 'tv.leaderboard', '', now()) as value) c
    where v.venue_id is not null
  )
  select b.period, l.place, l.display_name, l.member_number, l.played_minutes
  from board b
  cross join lateral private.hours_leaderboard(b.venue_id, b.period, b.top, b.min_hours, now()) with ordinality
    as l(place, member_id, display_name, member_number, played_minutes, n)
  order by l.n;
$$;
create function public.tv_leaderboard()
returns table (period text, place integer, display_name text, member_number bigint, played_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_leaderboard(); $$;

revoke execute on function private.leaderboard_from(text, timestamptz), private.hours_leaderboard(uuid, text, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke execute on function private.tv_leaderboard(), public.tv_leaderboard() from public, anon;
grant execute on function private.tv_leaderboard(), public.tv_leaderboard() to authenticated;

-- What the member's switch now covers (the security review of #907): the hours board shows a hidden name's member number.
comment on column public.member_preference.name_on_tvs is
  'Whether the TVs show the member''s first name and initial; off, the boards show their place, and the hours leaderboard their member number (decision 0581).';
