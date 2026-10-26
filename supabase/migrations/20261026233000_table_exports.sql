-- Exports from the console's tables (#102; features "Exports"; decision 0190). Any console table exports
-- the rows it shows, filtered and sorted, as CSV or XLSX. The file is made in the browser from what the
-- staff member already sees; before it is saved, the export is recorded here: who (the audit log's
-- actor, device and address), what table, every filter in force, the format and the row count. An export
-- of exports.alert_rows rows or more (1,000 unless the venue sets it) alerts the owner. Staff who export
-- tables (exports.table) only.

insert into public.setting_key (key, description, scope, value_schema) values
  ('exports.alert_rows',
   'Console table exports (decision 0190): an export of this many rows or more alerts the owner. 1,000 unless set.',
   'venue',
   '{"type":"object","properties":{"rows":{"type":"integer","minimum":1,"maximum":1000000}},"required":["rows"],"additionalProperties":false}');

-- Records one table export in the audit log, and alerts the owner when it is large. True when it alerted.
create function private.record_table_export(p_venue_id uuid, p_what text, p_filter text, p_format text, p_rows integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_rows integer := coalesce((private.setting_at(p_venue_id, 'exports.alert_rows', '', now()) ->> 'rows')::integer, 1000);
  v_is_large boolean;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'exports.table') then
    raise exception 'Only staff who export tables export them' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_what, ''))) not between 1 and 200 or length(coalesce(p_filter, '')) > 1000
     or p_format is null or p_format not in ('csv', 'xlsx') or p_rows is null or p_rows < 0 then
    raise exception 'A table, its filters, CSV or XLSX, and how many rows' using errcode = '22023';
  end if;
  perform private.audit(p_venue_id, 'export.table', 'table', btrim(p_what), null,
                        jsonb_build_object('format', p_format, 'filter', coalesce(p_filter, ''), 'rows', p_rows));
  v_is_large := p_rows >= v_alert_rows;
  if v_is_large then
    -- No personal data in an alert: the audit log holds who.
    perform private.raise_alert(p_venue_id, 'export.large', jsonb_build_object('what', btrim(p_what), 'format', p_format, 'rows', p_rows));
  end if;
  return v_is_large;
end;
$$;

-- Every member of a tier (additions flow 20: the member table filtered by tier, to export), as member_search
-- gives them, by name, for staff who read members; at most 5,000.
create function private.members_of_tier(p_venue_id uuid, p_tier_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  where m.venue_id = p_venue_id and m.tier_id = p_tier_id and private.has_permission(p_venue_id, 'members.read')
  order by m.full_name
  limit 5000;
$$;

create function public.members_of_tier(p_venue_id uuid, p_tier_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_of_tier(p_venue_id, p_tier_id); $$;

create function public.record_table_export(p_venue_id uuid, p_what text, p_filter text, p_format text, p_rows integer)
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.record_table_export(p_venue_id, p_what, p_filter, p_format, p_rows); $$;

revoke execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) from public, anon;
grant execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) to authenticated;
revoke execute on function private.record_table_export(uuid, text, text, text, integer) from public, anon;
grant execute on function private.record_table_export(uuid, text, text, text, integer) to authenticated;
revoke execute on function public.record_table_export(uuid, text, text, text, integer) from public, anon;
grant execute on function public.record_table_export(uuid, text, text, text, integer) to authenticated;
