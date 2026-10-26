-- A visit with no play does not count toward the month (#448; decision 0180). With the door kiosk
-- (decision 0164) a member could scan in and out every few minutes and each short visit counted toward
-- private.visits_this_month, which drives the cab template's "fourth visit in a month" and every
-- promotion with min_visits_in_month. A visit now counts only if the member sat at a table during it,
-- or it lasted an hour or more (a tournament player, or one who waited on the list). Every promotion
-- reads the count from here, so they all count visits the same way.

-- As 20261020145904_promotions_engine.sql: visits closed this IST month by that moment, now only those
-- with seated time or an hour in the club.
create or replace function private.visits_this_month(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.visit v
  where v.member_id = p_member_id and v.closed_at <= p_at
    and v.closed_at >= date_trunc('month', p_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    and (v.closed_at - v.opened_at >= interval '1 hour'
         or exists (select 1 from public.seat_session s
                    where s.visit_id = v.id and coalesce(s.ended_at, v.closed_at) > s.started_at));
$$;
