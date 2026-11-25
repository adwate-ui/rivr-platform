-- Visits added from a CSV or .xlsx file (the owner, 25 Nov; #1134), for super admins, as Bonus from a file is: each line a
-- member, a table, a check-in and a check-out (the console reads the file's Member, Date, Check-in, Check-out and Table into
-- these, and shows each member and table before anything saves) and a reason. Every line is added as a super admin's own
-- add is (private.insert_added_visit), in the file's order, under the same rules, so two lines of the file that clash are
-- refused too. All lines or none: a refusal names its line in its detail, the file's own line number the console sends
-- (as the preview numbers it), else its place. The same file again (its request id) changes nothing and gives the same
-- count; another file under that id is refused. Refused while promotions are stopped, as one visit added by hand is.
create function private.visits_from_file(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := private.current_staff_id(p_venue_id);
  v_count integer := case when jsonb_typeof(p_lines) = 'array' then jsonb_array_length(p_lines) end;
  v_saved integer;
  v_line record;
  v_visit uuid;
begin
  if not coalesce(private.is_super_admin(p_venue_id), false) or v_staff is null then
    raise exception 'Only super admins add visits from a file' using errcode = '42501';
  end if;
  if p_request_id is null or v_count is null or v_count not between 1 and 500 then
    raise exception 'One to 500 lines, and a request id' using errcode = '22023';
  end if;
  -- One attempt at a time under a request id, as Bonus from a file: two files under one id never both go.
  perform pg_advisory_xact_lock(hashtextextended('visits.file:' || p_request_id::text, 0));
  select count(*) into v_saved from public.visit_request r where r.venue_id = p_venue_id and r.request_id = p_request_id;
  if v_saved > 0 then
    if v_saved <> v_count then
      raise exception 'That request id was used for another file' using errcode = '22023';
    end if;
    return v_saved;
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  -- A file is up to 500 visits, each weighed for play-time Bonus: five a minute for a super admin, ten for the venue.
  perform private.assert_rate(p_venue_id, 'visits.file', 5, 10);
  for v_line in
    select coalesce((e ->> 'line')::integer, n::integer) as n, (e ->> 'memberId')::uuid as member_id, (e ->> 'tableId')::uuid as table_id,
           (e ->> 'openedAt')::timestamptz as opened_at, (e ->> 'closedAt')::timestamptz as closed_at, e ->> 'reason' as reason
    from jsonb_array_elements(p_lines) with ordinality as l (e, n)
    order by n
  loop
    begin
      perform private.assert_writable(p_venue_id, null, v_line.member_id);
      perform private.assert_visit_to_add(p_venue_id, v_line.member_id, v_line.table_id, v_line.opened_at, v_line.closed_at, v_line.reason);
    exception when others then
      raise exception 'Line %: %', v_line.n, sqlerrm using errcode = sqlstate, detail = v_line.n::text;
    end;
    v_visit := private.insert_added_visit(p_venue_id, v_line.member_id, v_line.table_id, v_line.opened_at, v_line.closed_at, v_staff);
    insert into public.visit_request (venue_id, member_id, table_id, opened_at, closed_at, reason, status, requested_by_staff_id,
                                      decided_by_staff_id, decided_at, visit_id, request_id, line)
    values (p_venue_id, v_line.member_id, v_line.table_id, v_line.opened_at, v_line.closed_at, btrim(v_line.reason), 'approved', v_staff,
            v_staff, now(), v_visit, p_request_id, v_line.n);
    perform private.audit(p_venue_id, 'visit.added', 'member', v_line.member_id::text, null,
                          jsonb_build_object('visit_id', v_visit, 'table_id', v_line.table_id, 'opened_at', v_line.opened_at,
                                             'closed_at', v_line.closed_at, 'file', p_request_id, 'line', v_line.n), btrim(v_line.reason));
  end loop;
  return v_count;
end;
$$;
create function public.visits_from_file(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.visits_from_file(p_venue_id, p_lines, p_request_id); $$;
revoke all on function private.visits_from_file(uuid, jsonb, uuid), public.visits_from_file(uuid, jsonb, uuid) from public, anon;
grant execute on function private.visits_from_file(uuid, jsonb, uuid), public.visits_from_file(uuid, jsonb, uuid) to authenticated;
