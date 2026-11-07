-- Ended promotions, shown apart from current ones (the owner, 8 Nov): the list says when each ended. An ended version
-- is never changed again, so its last change is when it ended; a promotion still run by its rule ended with its own
-- last change. Null for any promotion that has not ended. The list's function gains the column, so it is made again.

drop function public.promotions_overview(uuid);
drop function private.promotions_overview(uuid);

create function private.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz, ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.template_key, p.status, coalesce(cur.name, o.name, p.name), coalesce(cur.detail, o.detail, p.detail), coalesce(cur.runs, o.runs, p.runs),
         cur.id, cur.status, o.id, o.status, o.rejected_reason, coalesce(cur.reward, o.reward), coalesce(cur.eligibility, o.eligibility),
         coalesce(cur.schedule, o.schedule), coalesce(cur.limits, o.limits), coalesce(cur.channels, o.channels),
         (select count(*) from public.promotion_grant g where g.promotion_id = p.id
            and g.club_day >= private.club_day_of(now()) - (extract(isodow from private.club_day_of(now()))::integer - 1)),
         not exists (select 1 from public.promotion_version x where x.promotion_id = p.id), p.created_at,
         case when cur.status = 'ended' then cur.updated_at when cur.id is null and o.id is null and p.status = 'ended' then p.updated_at end
  from public.promotion p
  left join public.promotion_version cur on cur.promotion_id = p.id and cur.version = p.current_version
  left join public.promotion_version o on o.promotion_id = p.id and o.status in ('draft', 'awaiting_approval')
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.created_at desc, p.id;
$$;

create function public.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz, ended_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_overview(p_venue_id); $$;

revoke execute on function private.promotions_overview(uuid), public.promotions_overview(uuid) from public, anon;
grant execute on function private.promotions_overview(uuid), public.promotions_overview(uuid) to authenticated;
