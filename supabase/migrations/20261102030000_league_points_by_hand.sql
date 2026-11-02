-- League points by hand (UI polish audit L-01; the owner, 2 Nov: "they will be added manually or as CSV"). No points are
-- worked out any more (#629) and tournaments are hidden (decision 0284), so the League's standings come from points staff
-- give by hand: one member at a time on Rewards, or a CSV of member numbers and points. Staff with points.give give them,
-- as they give reward points (#645), and nobody gives themselves League points. They count in the League month they are
-- given in. A League point ranks a member on the boards: it is never a reward point and never money. Each giving is kept
-- as given, never changed, and one request gives once.

create table public.league_adjustment (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- The League month: that of the club's day the points were given on.
  month date not null check (extract(day from month) = 1),
  points bigint not null check (points between 1 and 1000000),
  reason text not null check (length(btrim(reason)) between 3 and 200),
  -- One giving, of one member or a whole CSV: the same request again gives nothing more.
  request_id uuid not null,
  given_by_staff_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, member_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (given_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.league_adjustment is 'RIVR League points given by hand (L-01): one member at a time, or from a CSV; never changed.';

create index league_adjustment_venue_month_idx on public.league_adjustment (venue_id, month);
create index league_adjustment_member_venue_idx on public.league_adjustment (member_id, venue_id);
create index league_adjustment_staff_venue_idx on public.league_adjustment (given_by_staff_id, venue_id);
create trigger league_adjustment_never_changed before update or delete on public.league_adjustment
  for each row execute function private.refuse_change();
create trigger league_adjustment_no_truncate before truncate on public.league_adjustment
  for each statement execute function private.refuse_change();
create trigger league_adjustment_audit after insert on public.league_adjustment
  for each row execute function private.audit_row_change();
alter table public.league_adjustment enable row level security;
grant select on public.league_adjustment to authenticated;

create policy "staff who read members or give points see the venue's League points by hand" on public.league_adjustment
  for select to authenticated
  using (venue_id in (select private.venues_where('members.read')) or venue_id in (select private.venues_where('points.give')));

-- A member's export gives all of it (151_member_export); an erasure keeps it, naming only the member's id, as their
-- tournament finishes (131_member_erasure); a practice reset and a purge take it with the venue's other rows.
insert into private.member_export_column (table_name, column_name, kind)
select 'league_adjustment', c, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'month', 'points', 'reason', 'request_id', 'given_by_staff_id', 'created_at', 'updated_at']) c;

-- The rows of a CSV or a single giving, each with the member its number names at the venue (none for a number not there).
create function private.league_rows(p_venue_id uuid, p_rows jsonb)
returns table (member_number bigint, points bigint, member_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select r.member_number, r.points, m.id, m.user_id
  from jsonb_to_recordset(p_rows) as r (member_number bigint, points bigint)
  left join public.member m on m.venue_id = p_venue_id and m.member_number = r.member_number and m.erased_at is null;
$$;

-- Gives League points by hand, for points.give: `p_rows` is a list of member numbers and points
-- (`[{"member_number": 1042, "points": 30}]`), 1 to 500 of them, each member once, all with one reason; they count in this
-- League month. All or none. A request already given answers what it gave and gives nothing more. Refusals: 42501 not
-- points.give, or a row is the caller's own; RVNOM member numbers not at the venue (DETAIL lists them); 22023 no rows or
-- over 500, a member twice, points not 1 to 1,000,000, a reason not 3 to 200 characters, or no request id; RVFRZ the
-- venue or a member frozen.
create function private.give_league_points(p_venue_id uuid, p_rows jsonb, p_reason text, p_request_id uuid)
returns table (o_members integer, o_points bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid := private.current_staff_id(p_venue_id);
  v_missing text;
  v_member_id uuid;
begin
  if p_venue_id is null or v_staff_id is null or not private.has_permission(p_venue_id, 'points.give') then
    raise exception 'Only staff who give points give League points' using errcode = '42501';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200
     or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'One to 500 rows, a reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  if exists (select 1 from public.league_adjustment a where a.venue_id = p_venue_id and a.request_id = p_request_id) then
    return query select count(*)::integer, sum(a.points)::bigint from public.league_adjustment a
                 where a.venue_id = p_venue_id and a.request_id = p_request_id;
    return;
  end if;
  perform private.assert_writable(p_venue_id);
  if exists (select 1 from private.league_rows(p_venue_id, p_rows) r where r.member_number is null or r.points is null or r.points not between 1 and 1000000)
     or (select count(*) <> count(distinct r.member_number) from private.league_rows(p_venue_id, p_rows) r) then
    raise exception 'Each row a member number and 1 to 1,000,000 points, each member once' using errcode = '22023';
  end if;
  select string_agg(r.member_number::text, ', ' order by r.member_number) into v_missing
  from private.league_rows(p_venue_id, p_rows) r where r.member_id is null;
  if v_missing is not null then
    raise exception 'No such member at this venue' using errcode = 'RVNOM', detail = v_missing;
  end if;
  if exists (select 1 from private.league_rows(p_venue_id, p_rows) r where r.user_id is not null and r.user_id = (select auth.uid())) then
    raise exception 'Nobody gives themselves League points' using errcode = '42501';
  end if;
  for v_member_id in select r.member_id from private.league_rows(p_venue_id, p_rows) r loop
    perform private.assert_writable(p_venue_id, null, v_member_id);
  end loop;
  insert into public.league_adjustment (venue_id, member_id, month, points, reason, request_id, given_by_staff_id)
  select p_venue_id, r.member_id, private.league_month(now()), r.points, btrim(p_reason), p_request_id, v_staff_id
  from private.league_rows(p_venue_id, p_rows) r;
  return query select count(*)::integer, sum(r.points)::bigint from private.league_rows(p_venue_id, p_rows) r;
end;
$$;

-- Each member's League points over the months from p_first to p_last at a venue: cash (points earned for hours, while
-- rates were set), tournament finishes, and points given by hand.
drop function private.league_points(uuid, date, date);
create function private.league_points(p_venue_id uuid, p_first date, p_last date)
returns table (o_member_id uuid, o_cash bigint, o_tournament bigint, o_by_hand bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with cash as (
    select e.member_id, sum(e.points) as points
    from public.visit v join public.points_earning e on e.visit_id = v.id and e.basis = 'hours'
    -- The rule is league_month. The range before it says the same (the months' club days run from 06:00
    -- IST on the first's first to 06:00 IST after the last's end) so the index on closed_at finds the visits.
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
  ),
  by_hand as (
    select a.member_id, sum(a.points) as points from public.league_adjustment a
    where a.venue_id = p_venue_id and a.month between p_first and p_last
    group by a.member_id
  ),
  members as (select member_id from cash union select member_id from finishes union select member_id from by_hand)
  select m.member_id, coalesce(c.points, 0)::bigint, coalesce(f.points, 0)::bigint, coalesce(h.points, 0)::bigint
  from members m
  left join cash c on c.member_id = m.member_id
  left join finishes f on f.member_id = m.member_id
  left join by_hand h on h.member_id = m.member_id;
$$;

-- The standings, as before, now with the points given by hand in each member's total.
drop function private.league_standings(uuid, date, date);
create function private.league_standings(p_venue_id uuid, p_first date, p_last date)
returns table (o_place integer, o_member_id uuid, o_cash bigint, o_tournament bigint, o_by_hand bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by p.o_cash + p.o_tournament + p.o_by_hand desc))::integer, p.o_member_id, p.o_cash, p.o_tournament,
         p.o_by_hand, p.o_cash + p.o_tournament + p.o_by_hand
  from private.league_points(p_venue_id, p_first, p_last) p
  where p.o_cash + p.o_tournament + p.o_by_hand > 0
    and private.has_feature(p.o_member_id, 'league.standings')
    and not exists (select 1 from public.self_exclusion x where x.member_id = p.o_member_id and x.starts_at <= now() and x.ends_at > now())
  order by 1, 2;
$$;

-- The console's standings: by hand apart, beside cash and tournaments.
drop function public.venue_league(uuid, date, date);
drop function private.venue_league(uuid, date, date);
create function private.venue_league(p_venue_id uuid, p_first date, p_last date)
returns table (place integer, member_id uuid, full_name text, member_number bigint, cash_points bigint, tournament_points bigint,
               hand_points bigint, points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.o_place, m.id, m.full_name, m.member_number, l.o_cash, l.o_tournament, l.o_by_hand, l.o_points
  from private.league_standings(p_venue_id, p_first, p_last) l
  join public.member m on m.id = l.o_member_id
  where private.has_permission(p_venue_id, 'members.read')
  order by l.o_place, m.full_name
  limit 200;
$$;

create function public.venue_league(p_venue_id uuid, p_first date, p_last date)
returns table (place integer, member_id uuid, full_name text, member_number bigint, cash_points bigint, tournament_points bigint,
               hand_points bigint, points bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_league(p_venue_id, p_first, p_last); $$;

create function public.give_league_points(p_venue_id uuid, p_rows jsonb, p_reason text, p_request_id uuid)
returns table (members integer, points bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.give_league_points(p_venue_id, p_rows, p_reason, p_request_id); $$;

revoke execute on function private.league_points(uuid, date, date), private.league_standings(uuid, date, date),
  private.league_rows(uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.venue_league(uuid, date, date), public.venue_league(uuid, date, date),
  private.give_league_points(uuid, jsonb, text, uuid), public.give_league_points(uuid, jsonb, text, uuid) from public, anon;
grant execute on function private.venue_league(uuid, date, date), public.venue_league(uuid, date, date),
  private.give_league_points(uuid, jsonb, text, uuid), public.give_league_points(uuid, jsonb, text, uuid) to authenticated;
