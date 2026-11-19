-- The Activity screen's count, bounded and saying so (#1015, and the logic review of #1104). Since #1014 activity_page
-- counted every line the narrowing leaves, on every page: the whole log of a venue, read again for each page. The count
-- now stops five thousand lines past the page asked for, so it costs what reading that far costs, and says when it
-- stopped short (`is_total_at_least`): the screen then shows "5,050+", never a capped count as exact. Below the bound the
-- count is exact. An export reads a thousand lines a page until a page is short, and records how many it read.
--
-- The functions are the live definitions (20261120130000_high_hand_on_the_floor.sql) with the count bounded and the flag
-- added. The return type changes, so both are dropped and made again, with their grants.

drop function public.activity_page(uuid, date, date, text, text, integer, integer);
drop function private.activity_page(uuid, date, date, text, text, integer, integer);

create function private.activity_page(p_venue_id uuid, p_from date, p_to date, p_who text, p_kind text, p_page integer, p_page_size integer)
returns table (total bigint, is_total_at_least boolean, id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text,
               kind text, about text, reason text, amount bigint, high_hand jsonb)
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
         l.id, l.occurred_at, l.who, l.is_system, l.action, l.entity, l.kind, l.about, l.reason, l.amount, l.high_hand
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
               kind text, about text, reason text, amount bigint, high_hand jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.activity_page(p_venue_id, p_from, p_to, p_who, p_kind, p_page, p_page_size); $$;

revoke execute on function private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) from public, anon;
grant execute on function private.activity_page(uuid, date, date, text, text, integer, integer), public.activity_page(uuid, date, date, text, text, integer, integer) to authenticated;
