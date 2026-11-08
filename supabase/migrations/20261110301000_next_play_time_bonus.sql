-- A member at a table sees the next play-time step they are counting towards (audit F-173): only one that would pay, so
-- none for a step already settled, a limit reached, a stop in force, or a seat whose time is not counting (away, another
-- stake, outside the promotion's hours). Nor one the club keeps off the app.

create function private.my_next_play_time_bonus()
returns table (chips bigint, after_minutes integer, seconds_left bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with seat as (
    select s.visit_id, s.venue_id, s.member_id, private.promotion_member_facts(s.member_id) as facts
    from public.seat_session s
    where s.member_id = private.current_member_id() and s.ended_at is null and s.visit_id is not null
      and private.has_feature(s.member_id, 'promotions.feed')
      and not exists (select 1 from public.control_state c
                      where c.venue_id = s.venue_id and c.released_at is null
                        and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'promotions')
                             or (c.level = 'member_freeze' and c.member_id = s.member_id)))
    order by s.started_at desc
    limit 1
  )
  select n.o_chips as chips, n.o_after_minutes as after_minutes, n.o_after_minutes * 60 - played.o_seconds as seconds_left
  from seat
  join public.promotion_version pv on pv.venue_id = seat.venue_id and pv.status = 'live' and pv.reward ->> 'kind' = 'hours_bonus'
  cross join lateral private.visit_schedule_time_at(seat.visit_id, pv.schedule, pv.eligibility, now()) played
  -- Still counting a minute from now: not away, at a stake it covers, inside its hours.
  cross join lateral private.visit_schedule_time_at(seat.visit_id, pv.schedule, pv.eligibility, now() + interval '1 minute') soon
  cross join lateral (
    select s.o_after_minutes, s.o_chips from private.promo_hours_steps(pv.reward) s
    where s.o_after_minutes * 60 > played.o_seconds
      and not private.promo_step_settled(pv.promotion_id, seat.member_id, seat.visit_id, private.promo_step_key(pv.reward, s.o_after_minutes))
      -- The first the limits would pay: a later step can pay when an earlier one is refused.
      and private.promo_check_limits(pv.reward, pv.limits, jsonb_build_object('chips', s.o_chips),
            private.promotion_tally(pv.promotion_id, seat.member_id,
              private.promo_period_key(pv.limits, 'hours_step:' || seat.visit_id || ':' || s.o_after_minutes, now(), seat.visit_id,
                                       private.promo_step_key(pv.reward, s.o_after_minutes)),
              null, private.club_day_of(now()), pv.limits)) is null
    order by s.o_after_minutes
    limit 1
  ) n
  where soon.o_seconds > played.o_seconds
    and private.promotion_shows_on(pv.promotion_id, 'playerApp')
    and private.promo_is_eligible(jsonb_build_object('reward', pv.reward, 'eligibility', pv.eligibility, 'schedule', pv.schedule), seat.facts,
                                  jsonb_build_object('kind', 'hours_step', 'at', now(), 'stake', null, 'tableId', null))
    -- The promotion's hours run long enough to reach it from here, so the time said is the time it takes.
    and private.seconds_in_schedule(pv.schedule, now(), now() + make_interval(secs => n.o_after_minutes * 60 - played.o_seconds))
        >= n.o_after_minutes * 60 - played.o_seconds
  order by seconds_left, chips desc
  limit 1;
$$;

create function public.my_next_play_time_bonus()
returns table (chips bigint, after_minutes integer, seconds_left bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_next_play_time_bonus(); $$;

revoke execute on function private.my_next_play_time_bonus(), public.my_next_play_time_bonus() from public, anon;
grant execute on function private.my_next_play_time_bonus(), public.my_next_play_time_bonus() to authenticated;
