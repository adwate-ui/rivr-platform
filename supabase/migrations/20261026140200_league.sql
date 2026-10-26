-- The RIVR League (#147; scope-v1 module 9; decision 0182; question #452 asks the owner, this is the
-- safest reading). Members compete each month on League points across cash games and tournaments:
-- cash play earns what a visit's hours at the tables earned in points (points.per_hour by stake, as
-- points_earning holds them; RIVR Rewards' rake share is rakeback, not League play), and each
-- tournament finish earns league.points by place (lane B writes them as a tournament finishes, #149,
-- through private.award_league_points). Points belong to the month of the club's day (06:00 to 06:00
-- IST). A season is a run of whole months; its championship adds them up, and ties share a place.
-- League points are a leaderboard: they are not the points members redeem, and never money. The
-- tables, the TVs, the website and other members see a first name and initial, and nothing for a
-- member who hid their name on the TVs (#326). The website never sees the practice venue.

insert into public.setting_key (key, description, scope, value_schema) values
  ('league.points',
   'RIVR League points for a tournament finish (decision 0182): every finisher''s for taking part, and more for first, second, third and the rest of the final table (fourth to ninth); none set earns none.',
   'venue',
   '{"type":"object","properties":{"first":{"type":"integer","minimum":0,"maximum":100000},"second":{"type":"integer","minimum":0,"maximum":100000},"third":{"type":"integer","minimum":0,"maximum":100000},"final_table":{"type":"integer","minimum":0,"maximum":100000},"entry":{"type":"integer","minimum":0,"maximum":100000}},"required":["first","second","third","final_table","entry"],"additionalProperties":false}');

-- @rivr/domain leagueFinishPoints: the points for taking part, plus first's, second's, third's, or the
-- final table's for fourth to ninth; a schedule not set is nothing.
create function private.league_finish_points(p_place integer, p_schedule jsonb)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first bigint := coalesce((p_schedule ->> 'first')::bigint, 0);
  v_second bigint := coalesce((p_schedule ->> 'second')::bigint, 0);
  v_third bigint := coalesce((p_schedule ->> 'third')::bigint, 0);
  v_final_table bigint := coalesce((p_schedule ->> 'final_table')::bigint, 0);
  v_entry bigint := coalesce((p_schedule ->> 'entry')::bigint, 0);
begin
  if p_place is null or p_place < 1 then
    raise exception 'A place is 1 or more' using errcode = '22023';
  end if;
  if least(v_first, v_second, v_third, v_final_table, v_entry) < 0 then
    raise exception 'League points are never negative' using errcode = '22023';
  end if;
  return v_entry + case when p_place = 1 then v_first when p_place = 2 then v_second when p_place = 3 then v_third
                        when p_place <= 9 then v_final_table else 0 end;
end;
$$;

-- @rivr/domain leagueMonth: the first day of the month of the club's day a moment falls in.
create function private.league_month(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', private.tonight_began(p_at) at time zone 'Asia/Kolkata')::date;
$$;

create table public.league_season (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- The season's first and last League months, each as its first day.
  first_month date not null check (extract(day from first_month) = 1),
  last_month date not null check (extract(day from last_month) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_month >= first_month)
);

comment on table public.league_season is 'A RIVR League season (#147): whole months whose League points add up to its championship.';

create index league_season_venue_idx on public.league_season (venue_id, first_month);
create trigger league_season_touch_updated_at before update on public.league_season
  for each row execute function private.touch_updated_at();
create trigger league_season_audit after insert or update or delete on public.league_season
  for each row execute function private.audit_row_change();
alter table public.league_season enable row level security;
grant select on public.league_season to authenticated;

create policy "members with the League see their venue's seasons" on public.league_season
  for select to authenticated
  using (venue_id = (select private.current_member_venue_id()) and private.has_feature((select private.current_member_id()), 'league.standings'));
create policy "staff who read members see the venue's seasons" on public.league_season
  for select to authenticated
  using (venue_id in (select private.venues_where('members.read')) or venue_id in (select private.venues_where('rewards.manage')));

-- A member's place in a finished tournament and the League points it earned, once a tournament.
create table public.league_finish (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  tournament_id uuid not null,
  member_id uuid not null,
  place integer not null check (place >= 1),
  -- The League month: that of the club's day the tournament finished on.
  month date not null check (extract(day from month) = 1),
  points bigint not null check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, member_id),
  foreign key (tournament_id, venue_id) references public.tournament (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.league_finish is 'What a tournament finish earned in the RIVR League (#147); never changed.';

create index league_finish_venue_month_idx on public.league_finish (venue_id, month);
create index league_finish_member_venue_idx on public.league_finish (member_id, venue_id);
create index league_finish_tournament_venue_idx on public.league_finish (tournament_id, venue_id);
create trigger league_finish_never_changed before update or delete on public.league_finish
  for each row execute function private.refuse_change();
create trigger league_finish_no_truncate before truncate on public.league_finish
  for each statement execute function private.refuse_change();
create trigger league_finish_audit after insert on public.league_finish
  for each row execute function private.audit_row_change();
alter table public.league_finish enable row level security;
grant select on public.league_finish to authenticated;

create policy "members with the League see their own finishes" on public.league_finish
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'league.standings'));
create policy "staff who read members see the venue's finishes" on public.league_finish
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- The League reads closed visits by venue and time.
create index visit_venue_closed_idx on public.visit (venue_id, closed_at) where closed_at is not null;

-- Lane B's call as a tournament finishes (#149): a member's place earns its League points once, in the
-- month of the club's day it finished, at the venue's league.points then. Gives the points. Refusals:
-- 22023 no such tournament or member there, or a place below 1; RVFRZ the venue frozen.
create function private.award_league_points(p_tournament_id uuid, p_member_id uuid, p_place integer, p_at timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
  v_points bigint;
begin
  if v_venue_id is null or p_at is null
     or not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = v_venue_id) then
    raise exception 'A finish is a member''s, in a tournament at their venue' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  v_points := private.league_finish_points(p_place, private.setting_at(v_venue_id, 'league.points', '', p_at));
  insert into public.league_finish (venue_id, tournament_id, member_id, place, month, points)
  values (v_venue_id, p_tournament_id, p_member_id, p_place, private.league_month(p_at), v_points)
  on conflict (tournament_id, member_id) do nothing;
  return (select f.points from public.league_finish f where f.tournament_id = p_tournament_id and f.member_id = p_member_id);
end;
$$;

-- Each member's League points over the months from p_first to p_last at a venue: cash, the points
-- their visits closed in those months earned for hours at the tables, and tournament finishes.
create function private.league_points(p_venue_id uuid, p_first date, p_last date)
returns table (o_member_id uuid, o_cash bigint, o_tournament bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with cash as (
    select e.member_id, sum(e.points) as points
    from public.visit v join public.points_earning e on e.visit_id = v.id and e.basis = 'hours'
    -- The months' club days run from 06:00 IST on the first's first to 06:00 IST after the last's end.
    where v.venue_id = p_venue_id
      and v.closed_at >= (p_first + interval '6 hours') at time zone 'Asia/Kolkata'
      and v.closed_at < (p_last + interval '1 month 6 hours') at time zone 'Asia/Kolkata'
      and private.league_month(v.closed_at) between p_first and p_last
    group by e.member_id
  ),
  finishes as (
    select f.member_id, sum(f.points) as points from public.league_finish f
    where f.venue_id = p_venue_id and f.month between p_first and p_last
    group by f.member_id
  )
  select coalesce(c.member_id, t.member_id), coalesce(c.points, 0)::bigint, coalesce(t.points, 0)::bigint
  from cash c full join finishes t on t.member_id = c.member_id;
$$;

-- The standings over those months: everyone with points, in order, ties sharing a place (1, 2, 2, 4).
create function private.league_standings(p_venue_id uuid, p_first date, p_last date)
returns table (o_place integer, o_member_id uuid, o_cash bigint, o_tournament bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by p.o_cash + p.o_tournament desc))::integer, p.o_member_id, p.o_cash, p.o_tournament, p.o_cash + p.o_tournament
  from private.league_points(p_venue_id, p_first, p_last) p
  where p.o_cash + p.o_tournament > 0
  order by 1, 2;
$$;

-- What the TVs, the website and the app show: this League month's top ten, and the season it falls
-- in, if any, each with places, a first name and initial (none for a member who hid their name on the
-- TVs) and points.
create function private.league_board(p_venue_id uuid)
returns table (standing text, season_name text, first_month date, last_month date, place integer, member_id uuid, display_name text,
               points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with periods as (
    select 'month' as standing, null::text as season_name, private.league_month(now()) as first_month, private.league_month(now()) as last_month
    union all
    select 'season', s.name, s.first_month, s.last_month from public.league_season s
    where s.venue_id = p_venue_id and private.league_month(now()) between s.first_month and s.last_month
  )
  select p.standing, p.season_name, p.first_month, p.last_month, l.o_place, l.o_member_id,
         case when coalesce(pr.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end, l.o_points
  from periods p
  cross join lateral private.league_standings(p_venue_id, p.first_month, p.last_month) l
  join public.member m on m.id = l.o_member_id
  left join public.member_preference pr on pr.member_id = m.id
  where l.o_place <= 10
  order by p.standing = 'season', l.o_place, m.full_name;
$$;

-- The console's standings over the months from p_first to p_last (members.read or rewards.manage):
-- full names and member numbers, cash and tournament points apart.
create function private.venue_league(p_venue_id uuid, p_first date, p_last date)
returns table (place integer, member_id uuid, full_name text, member_number bigint, cash_points bigint, tournament_points bigint, points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.o_place, m.id, m.full_name, m.member_number, l.o_cash, l.o_tournament, l.o_points
  from private.league_standings(p_venue_id, p_first, p_last) l
  join public.member m on m.id = l.o_member_id
  where private.has_permission(p_venue_id, 'members.read') or private.has_permission(p_venue_id, 'rewards.manage')
  order by l.o_place, m.full_name
  limit 200;
$$;

-- The signed-in member's League, with league.standings: the board, and their own place this month and
-- this season when it is not on the board. Their own row says it is theirs.
create function private.my_league()
returns table (standing text, season_name text, first_month date, last_month date, place integer, display_name text, points bigint,
               is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_member_id() as id, private.current_member_venue_id() as venue_id),
  board as (select b.* from me cross join lateral private.league_board(me.venue_id) b)
  select b.standing, b.season_name, b.first_month, b.last_month, b.place, b.display_name, b.points, b.member_id = me.id
  from board b cross join me
  where private.has_feature(me.id, 'league.standings')
  union all
  select p.standing, p.season_name, p.first_month, p.last_month, l.o_place, private.first_name_and_initial(m.full_name), l.o_points, true
  from me
  join public.member m on m.id = me.id
  cross join lateral (select distinct b.standing, b.season_name, b.first_month, b.last_month from board b) p
  cross join lateral private.league_standings(me.venue_id, p.first_month, p.last_month) l
  where private.has_feature(me.id, 'league.standings') and l.o_member_id = me.id
    and not exists (select 1 from board b where b.standing = p.standing and b.member_id = me.id)
  order by 1, 5;
$$;

-- Adds a season (none given) or changes one, for rewards.manage: a name, and its first and last months,
-- which overlap no other season at the venue. Refusals: 42501 not rewards.manage or not this venue's
-- season, 22023 a name out of bounds, a month that is not a month's first day, a last month before the
-- first, or an overlap; RVFRZ the venue frozen.
create function private.save_league_season(p_venue_id uuid, p_name text, p_first_month date, p_last_month date, p_season_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'rewards.manage') then
    raise exception 'Only rewards.manage sets the League''s seasons' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_first_month is null or p_last_month is null
     or extract(day from p_first_month) <> 1 or extract(day from p_last_month) <> 1 or p_last_month < p_first_month then
    raise exception 'A name of 1 to 80 characters, and a first and last month in order' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  -- One change to a venue's seasons at a time, so two cannot overlap.
  perform pg_advisory_xact_lock(hashtext('league_season:' || p_venue_id::text));
  if exists (select 1 from public.league_season s where s.venue_id = p_venue_id and s.id is distinct from p_season_id
             and s.first_month <= p_last_month and s.last_month >= p_first_month) then
    raise exception 'Seasons do not overlap' using errcode = '22023';
  end if;
  if p_season_id is null then
    insert into public.league_season (venue_id, name, first_month, last_month)
    values (p_venue_id, btrim(p_name), p_first_month, p_last_month) returning id into v_id;
    return v_id;
  end if;
  update public.league_season set name = btrim(p_name), first_month = p_first_month, last_month = p_last_month
  where id = p_season_id and venue_id = p_venue_id returning id into v_id;
  if v_id is null then
    raise exception 'No such season at this venue' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- Every club's board for the website, by the venue's slug: first names and initials only, never the
-- practice venue.
create function private.public_league_rows()
returns table (venue_slug text, standing text, season_name text, first_month date, last_month date, place integer, display_name text,
               points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, b.standing, b.season_name, b.first_month, b.last_month, b.place, b.display_name, b.points
  from public.venue v cross join lateral private.league_board(v.id) b where not v.is_practice;
$$;

create view public.public_league_table
with (security_invoker = true)
as
select venue_slug, standing, season_name, first_month, last_month, place, display_name, points from private.public_league_rows();

comment on view public.public_league_table is 'Each club''s RIVR League board, this month and this season, for the website (#147).';

create function public.venue_league(p_venue_id uuid, p_first date, p_last date)
returns table (place integer, member_id uuid, full_name text, member_number bigint, cash_points bigint, tournament_points bigint, points bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_league(p_venue_id, p_first, p_last); $$;
create function public.my_league()
returns table (standing text, season_name text, first_month date, last_month date, place integer, display_name text, points bigint,
               is_me boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_league(); $$;
create function public.save_league_season(p_venue_id uuid, p_name text, p_first_month date, p_last_month date, p_season_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_league_season(p_venue_id, p_name, p_first_month, p_last_month, p_season_id); $$;

grant select on public.public_league_table to anon, authenticated;
revoke execute on function private.league_finish_points(integer, jsonb), private.league_month(timestamptz),
  private.award_league_points(uuid, uuid, integer, timestamptz), private.league_points(uuid, date, date),
  private.league_standings(uuid, date, date), private.league_board(uuid), private.venue_league(uuid, date, date), private.my_league(),
  private.save_league_season(uuid, text, date, date, uuid), private.public_league_rows() from public, anon, authenticated;
grant execute on function private.public_league_rows() to anon, authenticated;
grant execute on function private.venue_league(uuid, date, date), private.my_league(), private.save_league_season(uuid, text, date, date, uuid)
  to authenticated;
revoke execute on function public.venue_league(uuid, date, date), public.my_league(), public.save_league_season(uuid, text, date, date, uuid)
  from public, anon;
grant execute on function public.venue_league(uuid, date, date), public.my_league(), public.save_league_season(uuid, text, date, date, uuid)
  to authenticated;
