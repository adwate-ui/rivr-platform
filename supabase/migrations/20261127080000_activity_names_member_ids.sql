-- Activity's Who and About name the member they are (owner, 19 Nov: every member's name in the console opens their
-- account): `who_member_id` when the one who acted is a member (not staff, not a device, not erased), and
-- `about_member_id` when the line is about a member who is not erased. The view and both functions are their live
-- definitions with the two columns added at the end; everything else, the count that stops short, the decision's About,
-- security_invoker and the grants, is as it was.

create or replace view private.activity_line with (security_invoker = true) as
SELECT l.venue_id,
    l.id,
    l.occurred_at,
    w.name AS who,
    l.actor_user_id IS NULL AS is_system,
    l.action,
    l.entity,
    private.activity_kind(l.action, l.entity) AS kind,
    COALESCE(
        CASE
            WHEN rm.erased_at IS NULL THEN rm.full_name
            ELSE NULL::text
        END, rs.full_name,
        CASE
            WHEN l.entity = 'table'::text THEN l.entity_id
            WHEN l.entity = 'promotion_bonus_decision'::text AND NOT l.after ? 'member_id'::text THEN l.after ->> 'grants'::text
            ELSE NULL::text
        END) AS about,
        CASE
            WHEN rm.erased_at IS NULL OR l.action = 'member.erase'::text THEN l.reason
            ELSE NULL::text
        END AS reason,
        CASE
            WHEN l.action = ANY (ARRAY['bonus.give'::text, 'high_hand.pay'::text, 'bonus.approve'::text, 'bonus.refuse'::text]) THEN (l.after ->> 'chips'::text)::bigint
            ELSE NULL::bigint
        END AS amount,
        CASE
            WHEN l.action = 'high_hand.pay'::text THEN jsonb_build_object('table', l.after ->> 'table'::text, 'seat', l.after -> 'seat'::text, 'hand', l.after ->> 'hand'::text, 'rank', l.after -> 'rank'::text)
            ELSE NULL::jsonb
        END AS high_hand,
    -- Who is a member only where no staff name stands first, and while they are not erased, as `who` reads.
        CASE
            WHEN s.full_name IS NULL AND a.erased_at IS NULL THEN a.id
            ELSE NULL::uuid
        END AS who_member_id,
    -- About is a member only while they are not erased, as `about` reads.
        CASE
            WHEN rm.erased_at IS NULL THEN rm.id
            ELSE NULL::uuid
        END AS about_member_id
   FROM audit_log l
     LEFT JOIN staff s ON s.user_id = l.actor_user_id AND s.venue_id = l.venue_id
     LEFT JOIN member a ON a.user_id = l.actor_user_id AND a.venue_id = l.venue_id
     LEFT JOIN device d ON d.id = l.device_id AND d.venue_id = l.venue_id
     CROSS JOIN LATERAL ( SELECT COALESCE(s.full_name,
                CASE
                    WHEN a.erased_at IS NULL THEN a.full_name
                    ELSE NULL::text
                END, d.name) AS name) w
     LEFT JOIN LATERAL ( SELECT COALESCE(
                CASE
                    WHEN l.entity = 'member'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'member_id'::text, l.before ->> 'member_id'::text) AS member_id,
            COALESCE(
                CASE
                    WHEN l.entity = 'staff'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'staff_id'::text, l.before ->> 'staff_id'::text) AS staff_id) t ON true
     LEFT JOIN member rm ON rm.id = private.uuid_or_null(t.member_id) AND rm.venue_id = l.venue_id
     LEFT JOIN staff rs ON rs.id = private.uuid_or_null(t.staff_id) AND rs.venue_id = l.venue_id;

drop function public.activity_page(uuid, date, date, text, text, integer, integer);
drop function private.activity_page(uuid, date, date, text, text, integer, integer);

create function private.activity_page(p_venue_id uuid, p_from date, p_to date, p_who text, p_kind text, p_page integer, p_page_size integer)
returns table (total bigint, is_total_at_least boolean, id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text,
               kind text, about text, reason text, amount bigint, high_hand jsonb, who_member_id uuid, about_member_id uuid)
language sql stable security definer set search_path = ''
as $$
  -- Each worked out once (materialized), not again for every line it is joined to.
  with bound as materialized (
    -- This page's end and five thousand lines past it.
    select greatest(coalesce(p_page, 1), 1)::bigint * least(greatest(coalesce(p_page_size, 50), 1), 1000) + 5000 as most
  ), counted as materialized (
    -- One line past the bound says the count stopped short.
    select count(*) as lines from (
      select 1 from private.activity_line c
      where c.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'activity.read'))
        and (p_from is null or c.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
        and (p_to is null or c.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
        and (p_who is null or position(lower(p_who) in lower(coalesce(c.who, ''))) > 0)
        and (p_kind is null or c.kind = p_kind)
      limit (select most from bound) + 1) found
  )
  select least(counted.lines, bound.most), counted.lines > bound.most,
         l.id, l.occurred_at, l.who, l.is_system, l.action, l.entity, l.kind, l.about, l.reason, l.amount, l.high_hand,
         l.who_member_id, l.about_member_id
  from private.activity_line l, counted, bound
  where l.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'activity.read'))
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(l.who, ''))) > 0)
    and (p_kind is null or l.kind = p_kind)
  order by l.occurred_at desc, l.id desc
  limit least(greatest(coalesce(p_page_size, 50), 1), 1000)
  offset (greatest(coalesce(p_page, 1), 1) - 1)::bigint * least(greatest(coalesce(p_page_size, 50), 1), 1000);
$$;

create function public.activity_page(p_venue_id uuid, p_from date default null, p_to date default null, p_who text default null, p_kind text default null,
                                     p_page integer default 1, p_page_size integer default 50)
returns table (total bigint, is_total_at_least boolean, id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text,
               kind text, about text, reason text, amount bigint, high_hand jsonb, who_member_id uuid, about_member_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.activity_page(p_venue_id, p_from, p_to, p_who, p_kind, p_page, p_page_size); $$;

revoke execute on function private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) from public, anon;
grant execute on function private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) to authenticated;
