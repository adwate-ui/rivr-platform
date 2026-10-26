-- The server-side tournament clock (#119; decision 0201). The clock lives on the tournament: when it
-- started, when it was paused, and the time the floor moved it by. Its level is a function of time
-- (private.tournament_clock_at, @rivr/domain clockAt), so a console, TV or phone that drops and reloads
-- reads the right level and time, and nothing has to run when a level changes (no pg_cron). The floor
-- (tournaments.manage) starts, pauses, resumes and moves it a level at a time; each change tells the
-- venue's TVs at once. The TVs show the venue's running tournament on the tournament clock, and members
-- with tournament registration see it on Home.

alter table public.tournament
  add column clock_started_at timestamptz,
  add column clock_paused_at timestamptz,
  -- The time the floor moved the clock by: a pause adds its length, Next level takes the time it skips.
  add column clock_shift interval not null default '0',
  add constraint tournament_clock_needs_levels check (clock_started_at is null or levels is not null),
  add constraint tournament_pause_after_start check (clock_paused_at is null or clock_paused_at >= clock_started_at);

create index tournament_running_idx on public.tournament (venue_id, clock_started_at) where clock_started_at is not null;

-- @rivr/domain clockAt: where the clock stands p_elapsed seconds in. The stage (from 0) whose time holds
-- that second, the level it counts as (a break the level before it), whether it is a break, and the
-- seconds left in it; before the start the first stage in full, after the end the last with none left.
create function private.tournament_clock_at(p_levels jsonb, p_elapsed integer)
returns table (stage integer, level integer, is_break boolean, seconds_left integer)
language sql
immutable
set search_path = ''
as $$
  with run as (
    select (s.ordinality - 1)::integer as stage,
           (count(*) filter (where s.value ->> 'kind' = 'level') over w)::integer as level,
           s.value ->> 'kind' = 'break' as is_break,
           (sum((s.value ->> 'minutes')::integer * 60) over w)::integer as ends_at
    from jsonb_array_elements(p_levels) with ordinality s
    window w as (order by s.ordinality)
  )
  select r.stage, r.level, r.is_break, greatest(0, r.ends_at - greatest(0, p_elapsed))
  from run r
  where r.ends_at > greatest(0, p_elapsed) or r.stage = jsonb_array_length(p_levels) - 1
  order by r.stage
  limit 1;
$$;

-- @rivr/domain stageStartSeconds: the seconds from the clock's start to the start of stage p_stage.
create function private.tournament_stage_start(p_levels jsonb, p_stage integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((s.value ->> 'minutes')::integer * 60), 0)::integer
  from jsonb_array_elements(p_levels) with ordinality s where s.ordinality <= p_stage;
$$;

-- The clock's elapsed seconds at p_at: what has run since it started, to the pause if paused, less the
-- time the floor moved it by; none before it starts.
create function private.tournament_elapsed(p_started_at timestamptz, p_paused_at timestamptz, p_shift interval, p_at timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_started_at is null then 0
              else greatest(0, floor(extract(epoch from (coalesce(p_paused_at, p_at) - p_started_at - p_shift))))::integer end;
$$;

-- The venue's running tournament for the TVs and Home: published, its clock started within the last day
-- and not yet past its last stage (a clock nobody finished is left behind), the latest started when two run.
create function private.running_tournament(p_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.tournament t
  where t.venue_id = p_venue_id and t.is_published and t.clock_started_at > now() - interval '1 day'
    and private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now())
        < private.tournament_stage_start(t.levels, jsonb_array_length(t.levels))
  order by t.clock_started_at desc
  limit 1;
$$;

-- The tournament for a clock change, locked, once the caller is known to run tournaments where it is.
create function private.tournament_for_clock(p_tournament_id uuid)
returns public.tournament
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament;
begin
  perform private.assert_runs_tournaments((select t.venue_id from public.tournament t where t.id = p_tournament_id));
  select * into v_row from public.tournament t where t.id = p_tournament_id for update;
  perform private.assert_writable(v_row.venue_id);
  return v_row;
end;
$$;

-- Starts the clock at level 1, for tournaments.manage. Refusals: 42501 not tournaments.manage where it
-- is, 22023 no levels or already started; RVFRZ the venue frozen.
create function private.start_tournament_clock(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament := private.tournament_for_clock(p_tournament_id);
begin
  if v_row.levels is null or v_row.clock_started_at is not null then
    raise exception 'A clock starts once, on a tournament with levels' using errcode = '22023';
  end if;
  update public.tournament set clock_started_at = now(), clock_paused_at = null, clock_shift = '0' where id = p_tournament_id;
end;
$$;

-- Pauses the clock (p_is_paused) or sets it running again, for tournaments.manage; asking for the state
-- it is in changes nothing. Refusals: 42501 not tournaments.manage where it is, 22023 not started; RVFRZ the venue frozen.
create function private.pause_tournament_clock(p_tournament_id uuid, p_is_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament := private.tournament_for_clock(p_tournament_id);
begin
  if v_row.clock_started_at is null or p_is_paused is null then
    raise exception 'Only a started clock pauses' using errcode = '22023';
  end if;
  if p_is_paused and v_row.clock_paused_at is null then
    update public.tournament set clock_paused_at = now() where id = p_tournament_id;
  elsif not p_is_paused and v_row.clock_paused_at is not null then
    update public.tournament set clock_shift = clock_shift + (now() - clock_paused_at), clock_paused_at = null where id = p_tournament_id;
  end if;
end;
$$;

-- Moves the clock to the start of the next stage (p_step 1) or the previous one (-1; the first stays at
-- its start), for tournaments.manage; a paused clock stays paused there. Refusals: 42501 not
-- tournaments.manage where it is, 22023 not started, a step other than 1 or -1, or no stage after the last;
-- RVFRZ the venue frozen.
create function private.move_tournament_level(p_tournament_id uuid, p_step integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament := private.tournament_for_clock(p_tournament_id);
  v_at timestamptz := coalesce(v_row.clock_paused_at, now());
  v_target integer;
begin
  if v_row.clock_started_at is null or p_step is null or p_step not in (-1, 1) then
    raise exception 'A started clock moves one stage at a time' using errcode = '22023';
  end if;
  v_target := (select c.stage from private.tournament_clock_at(
                 v_row.levels, private.tournament_elapsed(v_row.clock_started_at, v_row.clock_paused_at, v_row.clock_shift, v_at)) c) + p_step;
  if v_target >= jsonb_array_length(v_row.levels) then
    raise exception 'There is no stage after the last' using errcode = '22023';
  end if;
  update public.tournament
  set clock_shift = (v_at - clock_started_at) - make_interval(secs => private.tournament_stage_start(v_row.levels, greatest(v_target, 0)))
  where id = p_tournament_id;
end;
$$;

-- The console's tournaments for staff who run them: those starting from twelve hours ago on, and any
-- running, the running first, each with what its template set and its clock now.
create function private.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at, t.is_published, t.format, t.buy_in_paise, t.fee_paise, t.guarantee_paise, t.starting_stack, t.levels,
         t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid, t.clock_started_at,
         t.clock_paused_at is not null, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now())
  from public.tournament t
  where t.venue_id = p_venue_id and private.has_permission(p_venue_id, 'tournaments.manage')
    and (t.starts_at >= now() - interval '12 hours' or t.clock_started_at > now() - interval '1 day')
  order by t.clock_started_at desc nulls last, t.starts_at
  limit 100;
$$;

-- The signed-in TV's tournament clock, while the tournament clock is its mode or in its rotation: the
-- venue's running tournament, its levels, and its clock now.
create function private.tv_tournament_clock()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, t.levels, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()),
         t.clock_paused_at is not null
  from public.tournament t
  where t.id = private.running_tournament(private.tv_showing('tournament_clock'));
$$;

-- The running tournament at the signed-in member's venue, for Home, with tournament registration.
create function private.live_tournament()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, t.levels, private.tournament_elapsed(t.clock_started_at, t.clock_paused_at, t.clock_shift, now()), t.clock_paused_at is not null
  from public.tournament t
  where t.id = private.running_tournament(private.current_member_venue_id())
    and private.has_feature(private.current_member_id(), 'tournaments.register');
$$;

-- A tournament's clock, listing or name changing tells the venue's TVs at once (their read every half minute is the fallback).
create function private.signal_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(coalesce(new.venue_id, old.venue_id), 'tournament');
  return null;
end;
$$;

create trigger tournament_tv_signal after insert or delete on public.tournament
  for each row execute function private.signal_tournament_change();
create trigger tournament_tv_signal_change after update on public.tournament
  for each row
  when ((old.name, old.is_published, old.clock_started_at, old.clock_paused_at, old.clock_shift)
        is distinct from (new.name, new.is_published, new.clock_started_at, new.clock_paused_at, new.clock_shift))
  execute function private.signal_tournament_change();

create function public.start_tournament_clock(p_tournament_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.start_tournament_clock(p_tournament_id); $$;
create function public.pause_tournament_clock(p_tournament_id uuid, p_is_paused boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.pause_tournament_clock(p_tournament_id, p_is_paused); $$;
create function public.move_tournament_level(p_tournament_id uuid, p_step integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.move_tournament_level(p_tournament_id, p_step); $$;
create function public.venue_tournaments(p_venue_id uuid)
returns table (id uuid, name text, starts_at timestamptz, is_published boolean, format text, buy_in_paise bigint, fee_paise bigint,
               guarantee_paise bigint, starting_stack integer, levels jsonb, last_registration_level integer, max_buys integer,
               add_on_paise bigint, add_on_fee_paise bigint, add_on_chips integer, places_paid integer, clock_started_at timestamptz,
               is_paused boolean, elapsed_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_tournaments(p_venue_id); $$;
create function public.tv_tournament_clock()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_tournament_clock(); $$;
create function public.live_tournament()
returns table (name text, levels jsonb, elapsed_seconds integer, is_paused boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.live_tournament(); $$;

revoke execute on function private.tournament_clock_at(jsonb, integer), private.tournament_stage_start(jsonb, integer),
  private.tournament_elapsed(timestamptz, timestamptz, interval, timestamptz), private.running_tournament(uuid),
  private.tournament_for_clock(uuid), private.start_tournament_clock(uuid), private.pause_tournament_clock(uuid, boolean),
  private.move_tournament_level(uuid, integer), private.venue_tournaments(uuid), private.tv_tournament_clock(), private.live_tournament(),
  private.signal_tournament_change() from public, anon, authenticated;
grant execute on function private.start_tournament_clock(uuid), private.pause_tournament_clock(uuid, boolean),
  private.move_tournament_level(uuid, integer), private.venue_tournaments(uuid), private.tv_tournament_clock(), private.live_tournament()
  to authenticated;
revoke execute on function public.start_tournament_clock(uuid), public.pause_tournament_clock(uuid, boolean),
  public.move_tournament_level(uuid, integer), public.venue_tournaments(uuid), public.tv_tournament_clock(), public.live_tournament()
  from public, anon;
grant execute on function public.start_tournament_clock(uuid), public.pause_tournament_clock(uuid, boolean),
  public.move_tournament_level(uuid, integer), public.venue_tournaments(uuid), public.tv_tournament_clock(), public.live_tournament()
  to authenticated;

-- The tournament gains the clock's columns, and the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
