-- One member's counted hours reset (redesign of 15 Nov 2026, RD-36; the owner, 15 Nov: "option to reset hours by
-- players": one member, everywhere). A super admin resets them from the member record, with a reason. From that moment
-- the member's hours start from zero on the TV's hours leaderboard, for a play-time Bonus, and in the total on the
-- Members list. Past visits stay on the record and in every report by date: nothing is deleted or rewritten.
--
-- How: the member keeps the moment their hours count from (null: from the beginning). Time played before it counts for
-- nothing; a stint that began before it and ended after counts for the share of its played time that came after, in
-- proportion to the clock, rounded down (private.table_played_seconds, the share rule already used for a session that
-- moved tables; @rivr/domain countedSeconds is its twin, proved by packages/testing/golden/hours.json).
--
-- A play-time Bonus already paid is not taken back: nothing here touches a grant. A step reached before the reset is not
-- paid again after it: a step is settled once a visit (private.promo_step_settled), whatever the hours then read, and
-- the reset first weighs the open visit, so a step just reached is paid before the count starts again.

alter table public.member add column hours_counted_from timestamptz;
comment on column public.member.hours_counted_from is 'Played time before this moment no longer counts towards the member''s hours (RD-36); null counts everything.';
insert into private.member_export_column (table_name, column_name, kind) values ('member', 'hours_counted_from', 'owed');
-- Signed-in callers read every member column but the phone, row by row as the table's policies allow (20261109100000).
grant select (hours_counted_from) on public.member to authenticated;

-- The moment a member's hours count from: their last reset, or the beginning.
create function private.hours_counted_from(p_member_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select m.hours_counted_from from public.member m where m.id = p_member_id), '-infinity'::timestamptz);
$$;
revoke execute on function private.hours_counted_from(uuid) from public, anon, authenticated;

-- The rule: of a stint from p_from to p_to with p_played seconds played, the seconds that still count once hours count
-- from p_counted_from. All of it when the stint began at or after that moment, none when it ended by then, else the
-- share played after it, by the clock.
create function private.counted_seconds(p_from timestamptz, p_to timestamptz, p_played bigint, p_counted_from timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_counted_from is null or p_counted_from <= p_from then p_played
    when p_counted_from >= p_to then 0::bigint
    else private.table_played_seconds(floor(extract(epoch from (p_to - p_counted_from)))::bigint,
                                      floor(extract(epoch from (p_to - p_from)))::bigint, p_played)
  end;
$$;

-- A seat session's minutes that still count at p_at, in whole minutes as private.minutes_played gives them.
create function private.counted_minutes(p_session public.seat_session, p_at timestamptz, p_counted_from timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (private.counted_seconds(p_session.started_at, e.end_at, private.minutes_played(p_session, p_at)::bigint * 60, p_counted_from) / 60)::integer
  from (select case when p_session.ended_at is not null and p_session.ended_at < p_at then p_session.ended_at else p_at end as end_at) e;
$$;
revoke execute on function private.counted_seconds(timestamptz, timestamptz, bigint, timestamptz),
  private.counted_minutes(public.seat_session, timestamptz, timestamptz) from public, anon, authenticated;

-- The reset itself: a super admin of the member's venue, with a reason. The open visit's steps are weighed first.
create function private.reset_member_hours(p_member_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_reason text := trim(coalesce(p_reason, ''));
  v_at timestamptz := now();
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null or not coalesce(private.is_super_admin(v_member.venue_id), false) then
    raise exception 'Only a super admin resets a member''s hours' using errcode = '42501';
  end if;
  if length(v_reason) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, p_member_id);
  perform private.weigh_hours_steps(v.id, v_at) from public.visit v where v.member_id = p_member_id and v.closed_at is null;
  update public.member set hours_counted_from = v_at where id = p_member_id;
  perform private.audit(v_member.venue_id, 'member.hours_reset', 'member', p_member_id::text,
                        jsonb_build_object('hours_counted_from', v_member.hours_counted_from), jsonb_build_object('hours_counted_from', v_at), v_reason);
  return v_at;
end;
$$;

create function public.reset_member_hours(p_member_id uuid, p_reason text)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.reset_member_hours(p_member_id, p_reason); $$;

revoke execute on function private.reset_member_hours(uuid, text), public.reset_member_hours(uuid, text) from public, anon;
grant execute on function private.reset_member_hours(uuid, text), public.reset_member_hours(uuid, text) to authenticated;

-- A visit's hours for a play-time Bonus paid when the visit closes: as private.visit_table_time counts each table (which
-- the member's own session history still reads, whole), less what came before the member's hours count from.
create or replace function private.visit_hours(p_visit_id uuid)
returns table (o_played bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with stints as (
    select s.id as session_id, t.o_table_id as table_id,
           extract(epoch from (least(t.o_to, v.closed_at) - greatest(t.o_from, c.counted_from))) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    cross join lateral (select private.hours_counted_from(v.member_id) as counted_from) c
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at and least(t.o_to, v.closed_at) > c.counted_from
  ),
  played as (
    select private.table_played_seconds(floor(sum(r.seconds))::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from stints r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$$;

-- The functions below are as the newest migration before this one left them, each counting from the member's moment.
-- Written by a script from the database's own definitions (hence the layout of each).

CREATE OR REPLACE FUNCTION private.hours_leaderboard(p_venue_id uuid, p_period text, p_top integer, p_min_hours integer, p_at timestamp with time zone)
 RETURNS TABLE(place integer, member_id uuid, display_name text, member_number bigint, played_minutes integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with played as (
    select s.member_id, sum(private.counted_minutes(s, p_at, private.hours_counted_from(s.member_id)))::integer as minutes
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
$function$;

CREATE OR REPLACE FUNCTION private.members_of_tier(p_venue_id uuid, p_tier_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer, last_visit_at timestamp with time zone, kyc_status text, minutes_played bigint, city text, member_since timestamp with time zone, known_as text, own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text, creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, first_seen_at timestamp with time zone, kyc_method text, kyc_verified_at timestamp with time zone, date_of_birth date, pan text, masked_aadhaar text, aadhaar_name text, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with access as (
    select private.has_permission(p_venue_id, 'members.read') as reads,
           coalesce(private.has_permission(p_venue_id, 'members.change_phone'), false) as sees_phone,
           coalesce(private.is_super_admin(p_venue_id), false) as sees_identity
  ),
  played as (
    select s.member_id, sum(private.counted_minutes(s, now(), private.hours_counted_from(s.member_id)))::bigint as minutes
    from public.seat_session s
    where s.venue_id = p_venue_id and (select reads from access)
    group by s.member_id
  )
  select m.id, m.member_number, m.full_name, case when a.sees_phone then m.phone end, right(m.phone, 4), t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         case when private.is_kyc_complete(m.id) then 'verified'
              when k.status = 'needs_review' then 'in_review'
              when k.status = 'refused' then 'refused'
              when k.status = 'started' and k.at_club_from is not null then 'at_desk'
              else 'not_done' end,
         coalesce(p.minutes, 0), pr.city, m.created_at,
         m.known_as, m.referral_code, pr.occupation, coalesce(pr.play_times, '{}'), coalesce(pr.games_played, '{}'), sa.referral_code,
         sa.creator_code, sa.utm_source, sa.utm_medium, sa.utm_campaign, sa.utm_content, sa.utm_term, sa.first_seen_at,
         case when k.verified_at is not null then k.method end, k.verified_at,
         case when a.sees_identity and m.erased_at is null then k.date_of_birth end,
         case when a.sees_identity and m.erased_at is null then k.pan end,
         case when a.sees_identity and m.erased_at is null then k.masked_aadhaar end,
         case when a.sees_identity and m.erased_at is null then k.aadhaar_name end,
         case when a.sees_identity and m.erased_at is null then k.address end
  from public.member m
  cross join access a
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join played p on p.member_id = m.id
  left join public.member_preference pr on pr.member_id = m.id
  left join public.sign_up_attribution sa on sa.member_id = m.id
  where m.venue_id = p_venue_id and (p_tier_id is null or m.tier_id = p_tier_id) and a.reads
  order by m.full_name
  limit 5000;
$function$;

CREATE OR REPLACE FUNCTION private.visit_schedule_time(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, greatest(t.o_from, private.hours_counted_from(v.member_id)), least(t.o_to, v.closed_at)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at and least(t.o_to, v.closed_at) > private.hours_counted_from(v.member_id)
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;

CREATE OR REPLACE FUNCTION private.visit_window_time(p_visit_id uuid, p_conditions jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_window(greatest(t.o_from, private.hours_counted_from(v.member_id)), least(t.o_to, v.closed_at), p_conditions) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at and least(t.o_to, v.closed_at) > private.hours_counted_from(v.member_id)
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where (not p_conditions ? 'stakes' or p_conditions -> 'stakes' ? tt.code)
      and (not p_conditions ? 'table_ids' or p_conditions -> 'table_ids' ? st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;

CREATE OR REPLACE FUNCTION private.visit_schedule_time_at(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb, p_at timestamp with time zone)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visit_end as (
    select v.id, private.hours_counted_from(v.member_id) as counted_from, least(coalesce(v.closed_at, p_at), p_at) as ended_at
    from public.visit v where v.id = p_visit_id
  ),
  stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, greatest(t.o_from, e.counted_from), least(t.o_to, e.ended_at)) as seconds,
           floor(extract(epoch from (least(coalesce(s.ended_at, e.ended_at), e.ended_at) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (e.ended_at - s.away_since))))::bigint else 0 end as away_seconds
    from visit_end e
    join public.seat_session s on s.visit_id = e.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < e.ended_at and least(t.o_to, e.ended_at) > e.counted_from
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;
