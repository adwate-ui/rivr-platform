-- Feedback's lists, counted and read on the server (8 Nov audit, I-64, F-024). Open tickets are never cut, each tab's count
-- is true however long its list is, and the other two lists are read a page at a time. Resolved holds the tickets resolved in
-- the last 90 days, however old the ticket; Other holds the ratings of those days that never were tickets.

-- As 20261029140000_feedback_forms.sql made it, with every open ticket: the rail's badge counts them here.
create or replace function private.venue_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz,
               topic text, ratings jsonb, nps smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, m.id, m.full_name, m.member_number, v.closed_at, f.score, f.note, f.is_ticket, f.resolved_at, s.full_name, f.resolution,
         f.created_at, f.topic, f.ratings, f.nps
  from public.feedback f
  join public.member m on m.id = f.member_id
  left join public.visit v on v.id = f.visit_id
  left join public.staff s on s.id = f.resolved_by_staff_id
  where f.venue_id = p_venue_id and private.has_permission(p_venue_id, 'feedback.manage')
    and (f.created_at > now() - interval '90 days' or (f.is_ticket and f.resolved_at is null))
  order by (f.is_ticket and f.resolved_at is null) desc, f.created_at desc
  limit 500 + (select count(*) from public.feedback o where o.venue_id = p_venue_id and o.is_ticket and o.resolved_at is null);
$$;

create function private.feedback_counts(p_venue_id uuid)
returns table (open integer, resolved integer, other integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where f.is_ticket and f.resolved_at is null)::integer,
         count(*) filter (where f.is_ticket and f.resolved_at > now() - interval '90 days')::integer,
         count(*) filter (where not f.is_ticket and f.created_at > now() - interval '90 days')::integer
  from public.feedback f
  where f.venue_id = p_venue_id and private.has_permission(p_venue_id, 'feedback.manage');
$$;

-- A page of `resolved` or `other`, newest first, after the row named by p_before and p_before_id.
create function private.feedback_page(p_venue_id uuid, p_list text, p_before timestamptz default null, p_before_id uuid default null)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz,
               topic text, ratings jsonb, nps smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, m.id, m.full_name, m.member_number, v.closed_at, f.score, f.note, f.is_ticket, f.resolved_at, s.full_name, f.resolution,
         f.created_at, f.topic, f.ratings, f.nps
  from public.feedback f
  join public.member m on m.id = f.member_id
  left join public.visit v on v.id = f.visit_id
  left join public.staff s on s.id = f.resolved_by_staff_id
  where f.venue_id = p_venue_id and private.has_permission(p_venue_id, 'feedback.manage')
    and ((p_list = 'resolved' and f.is_ticket and f.resolved_at > now() - interval '90 days')
         or (p_list = 'other' and not f.is_ticket and f.created_at > now() - interval '90 days'))
    and (p_before is null or (f.created_at, f.id) < (p_before, p_before_id))
  order by f.created_at desc, f.id desc
  limit 50;
$$;

create function public.feedback_counts(p_venue_id uuid)
returns table (open integer, resolved integer, other integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.feedback_counts(p_venue_id); $$;
create function public.feedback_page(p_venue_id uuid, p_list text, p_before timestamptz default null, p_before_id uuid default null)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz,
               topic text, ratings jsonb, nps smallint)
language sql stable security invoker set search_path = ''
as $$ select * from private.feedback_page(p_venue_id, p_list, p_before, p_before_id); $$;

revoke execute on function private.feedback_counts(uuid), private.feedback_page(uuid, text, timestamptz, uuid),
  public.feedback_counts(uuid), public.feedback_page(uuid, text, timestamptz, uuid) from public, anon;
grant execute on function private.feedback_counts(uuid), private.feedback_page(uuid, text, timestamptz, uuid),
  public.feedback_counts(uuid), public.feedback_page(uuid, text, timestamptz, uuid) to authenticated;
