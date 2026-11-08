-- The promotions list says what was given (audit F-104): the chips and points given this club week, the budget used so far
-- in the period the budget is enforced over, and whether a live promotion has given nothing for seven days. Seven days,
-- as a promotion that runs one night a week still has its night in them; one live for less than that is not marked.
-- The list's function gains the columns, so it is made again.

drop function public.promotions_overview(uuid);
drop function private.promotions_overview(uuid);

create function private.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz, ended_at timestamptz,
               chips_given_this_week bigint, points_given_this_week bigint, budget_used_chips bigint, is_quiet boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.template_key, p.status, coalesce(cur.name, o.name, p.name), coalesce(cur.detail, o.detail, p.detail), coalesce(cur.runs, o.runs, p.runs),
         cur.id, cur.status, o.id, o.status, o.rejected_reason, coalesce(cur.reward, o.reward), coalesce(cur.eligibility, o.eligibility),
         coalesce(cur.schedule, o.schedule), coalesce(cur.limits, o.limits), coalesce(cur.channels, o.channels),
         w.times,
         not exists (select 1 from public.promotion_version x where x.promotion_id = p.id), p.created_at,
         case when cur.status = 'ended' then cur.updated_at when cur.id is null and o.id is null and p.status = 'ended' then p.updated_at end,
         w.chips, w.points,
         -- As the limits count it (private.promotion_tally), so the list and the refusal agree.
         case when coalesce(cur.limits, o.limits) ? 'budgetChips'
              then (private.promotion_tally(p.id, null, null, null, private.club_day_of(now()), coalesce(cur.limits, o.limits)) ->> 'chipsGiven')::bigint end,
         coalesce(cur.status = 'live' and cur.updated_at <= now() - interval '7 days'
                  and (cur.schedule ->> 'startsOn')::date <= private.club_day_of(now()) - 7
                  and not exists (select 1 from public.promotion_grant g where g.promotion_id = p.id and g.created_at > now() - interval '7 days'), false)
  from public.promotion p
  left join public.promotion_version cur on cur.promotion_id = p.id and cur.version = p.current_version
  left join public.promotion_version o on o.promotion_id = p.id and o.status in ('draft', 'awaiting_approval')
  cross join lateral (
    select count(*) as times, coalesce(sum(g.chips), 0)::bigint as chips, coalesce(sum(g.points), 0)::bigint as points
    from public.promotion_grant g
    where g.promotion_id = p.id and g.club_day >= private.club_day_of(now()) - (extract(isodow from private.club_day_of(now()))::integer - 1)
  ) w
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.created_at desc, p.id;
$$;

create function public.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz, ended_at timestamptz,
               chips_given_this_week bigint, points_given_this_week bigint, budget_used_chips bigint, is_quiet boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_overview(p_venue_id); $$;

revoke execute on function private.promotions_overview(uuid), public.promotions_overview(uuid) from public, anon;
grant execute on function private.promotions_overview(uuid), public.promotions_overview(uuid) to authenticated;
