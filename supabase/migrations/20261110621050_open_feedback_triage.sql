-- The open tickets as a table to triage (8 Nov audit, I-65, F-013): every open ticket, oldest first, with the visit's tables
-- and how long the member waited from check-in to their first seat, and several resolved at once with one line.
create function private.open_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               created_at timestamptz, topic text, ratings jsonb, nps smallint, tables text, wait_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, m.id, m.full_name, m.member_number, v.closed_at, f.score, f.note, f.created_at, f.topic, f.ratings, f.nps,
         (select string_agg(distinct g.name, ', ' order by g.name)
          from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = f.visit_id),
         (select extract(epoch from min(s.started_at) - v.opened_at)::integer from public.seat_session s where s.visit_id = f.visit_id)
  from public.feedback f
  join public.member m on m.id = f.member_id
  left join public.visit v on v.id = f.visit_id
  where f.venue_id = p_venue_id and f.is_ticket and f.resolved_at is null and private.has_permission(p_venue_id, 'feedback.manage')
  order by f.created_at, f.id;
$$;

-- Each through resolve_feedback, so each is checked as one is; all or none, as it is one transaction, and in one order, so
-- two at once cannot deadlock. Refusals: as resolve_feedback's; 22023 no ticket; RVMAX more than 500.
create function private.resolve_feedback_many(p_feedback_ids uuid[], p_resolution text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(cardinality(p_feedback_ids), 0) = 0 then
    raise exception 'At least one ticket' using errcode = '22023';
  end if;
  if cardinality(p_feedback_ids) > 500 then
    raise exception 'At most 500 tickets at once' using errcode = 'RVMAX';
  end if;
  for v_id in select distinct u from unnest(p_feedback_ids) u order by 1 loop
    perform private.resolve_feedback(v_id, p_resolution);
  end loop;
end;
$$;

create function public.open_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               created_at timestamptz, topic text, ratings jsonb, nps smallint, tables text, wait_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.open_feedback(p_venue_id); $$;
create function public.resolve_feedback_many(p_feedback_ids uuid[], p_resolution text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.resolve_feedback_many(p_feedback_ids, p_resolution); $$;

revoke execute on function private.open_feedback(uuid), private.resolve_feedback_many(uuid[], text),
  public.open_feedback(uuid), public.resolve_feedback_many(uuid[], text) from public, anon;
grant execute on function private.open_feedback(uuid), private.resolve_feedback_many(uuid[], text),
  public.open_feedback(uuid), public.resolve_feedback_many(uuid[], text) to authenticated;
