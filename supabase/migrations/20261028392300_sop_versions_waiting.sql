-- Every SOP version waiting for its day (#388): sop_library gives them all, soonest first, in place of only the next,
-- so the SOP screen lists each and New version starts from the latest. Otherwise as 20261020101508_sops.sql.
drop function public.sop_library(uuid);
drop function private.sop_library(uuid);

create function private.sop_library(p_venue_id uuid)
returns table (sop_id uuid, title text, version_id uuid, version integer, owner text, ack_roles public.staff_role[],
               effective_on date, body text, waiting jsonb, must_acknowledge boolean,
               acknowledged_at timestamptz, acknowledged_count integer, required_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select s.id, s.role from public.staff s where s.id = private.current_staff_id(p_venue_id))
  select s.id, s.title, c.id, c.version, c.owner, c.ack_roles, c.effective_on, c.body,
         n.versions,
         coalesce(me.role = any (c.ack_roles), false), a.acknowledged_at,
         (select count(*)::integer from public.staff r join public.sop_ack k on k.staff_id = r.id and k.sop_version_id = c.id
          where r.venue_id = p_venue_id and r.is_active and r.role = any (c.ack_roles)),
         (select count(*)::integer from public.staff r where r.venue_id = p_venue_id and r.is_active and r.role = any (c.ack_roles))
  from public.sop s
  cross join me
  -- The version in force (none yet for an SOP whose first day is still to come), and every version waiting for its
  -- day, soonest first: of two on one day the later, which is the one in force that day (#388).
  left join lateral private.sop_version_in_force(s.id) c on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object('version_id', w.id, 'version', w.version, 'owner', w.owner, 'ack_roles', w.ack_roles,
                                                 'effective_on', w.effective_on, 'body', w.body) order by w.effective_on), '[]'::jsonb) as versions
    from (select distinct on (v.effective_on) v.* from public.sop_version v
          where v.sop_id = s.id and v.effective_on > private.today_ist() order by v.effective_on, v.version desc) w
  ) n on true
  left join public.sop_ack a on a.sop_version_id = c.id and a.staff_id = me.id
  where s.venue_id = p_venue_id
  order by s.title;
$$;

create function public.sop_library(p_venue_id uuid)
returns table (sop_id uuid, title text, version_id uuid, version integer, owner text, ack_roles public.staff_role[],
               effective_on date, body text, waiting jsonb, must_acknowledge boolean,
               acknowledged_at timestamptz, acknowledged_count integer, required_count integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.sop_library(p_venue_id); $$;

revoke execute on function private.sop_library(uuid), public.sop_library(uuid) from public, anon;
grant execute on function private.sop_library(uuid), public.sop_library(uuid) to authenticated;
