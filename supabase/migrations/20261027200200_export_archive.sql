-- The super admin's export archive (#103; features "Exports"; decision 0232). Every table of a venue as CSV, with
-- a manifest of each table's rows, in one archive the console encrypts to the owner's backup key: the age key the
-- nightly backups use (decision 0072), set here as exports.archive_recipient. KYC photos go in only when chosen,
-- with a written reason. One member's export, for an access request, is the same archive of that member's rows.
-- Starting an archive writes the audit log (who, the venue or member, each table's rows counted here, the reason
-- for photos) and alerts the owner when it is large; only then can its tables be read, a page at a time, by the
-- person who started it, for an hour. Secrets never leave: hashes of PINs, tokens and codes, and the KYC keys.
-- Super admins (exports.full) only.

insert into public.setting_key (key, description, scope, value_schema) values
  ('exports.archive_recipient',
   'The super admin''s export archive (decision 0232) is encrypted to this age public key: the owner''s backup key, the one the nightly backups use. No archive is made until it is set.',
   'venue',
   '{"type":"object","properties":{"recipient":{"type":"string","pattern":"^age1(pq1)?[02-9ac-hj-np-z]{58,4000}$"}},"required":["recipient"],"additionalProperties":false}');

-- Only a super admin sets or removes the archive's key, and the owner hears of every change a person makes:
-- whoever holds the key's private half reads every archive. (The seed and migrations set it with no one signed in,
-- and a purge or practice reset clears a venue's settings on purpose.)
create function private.guard_archive_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := case when tg_op = 'DELETE' then old.venue_id else new.venue_id end;
begin
  if (select auth.uid()) is not null and not coalesce(private.purging(v_venue_id), false) then
    if not private.has_permission(v_venue_id, 'exports.full') then
      raise exception 'Only a super admin sets the export archive''s key' using errcode = '42501';
    end if;
    perform private.raise_alert(v_venue_id, 'exports.key_changed', jsonb_build_object('change', lower(tg_op)));
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.guard_archive_recipient() from public, anon, authenticated;

create trigger setting_archive_recipient_set before insert on public.setting
  for each row when (new.key = 'exports.archive_recipient') execute function private.guard_archive_recipient();
create trigger setting_archive_recipient_removed before delete on public.setting
  for each row when (old.key = 'exports.archive_recipient') execute function private.guard_archive_recipient();

-- Each table an archive holds, with the columns it gives in order, and which of its rows ($1 the venue, $2 the
-- member). Secret columns are left out: hashes (PINs, device tokens, pairing codes) and the KYC keys, which the
-- nightly backup alone holds. A full archive holds every table: the venue's rows, or all of a table no venue owns
-- (the features, what each role may do, the settings there are). One member's holds the member row, the entries
-- on the member's ledger accounts, the moves of the member's seats, and the rows of every table with a member
-- column (member_id, winner_member_id, table_member_ids and the like) naming the member.
create function private.export_archive_tables(p_for_member boolean)
returns table (table_name text, column_names text[], predicate text)
language sql
stable
security definer
set search_path = ''
as $$
  with tables as (
    select c.table_name::text as table_name,
           array_agg(c.column_name::text order by c.ordinal_position)
             filter (where c.column_name not like '%\_hash'
                       and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id'))
             as column_names,
           bool_or(c.column_name = 'venue_id') as has_venue,
           string_agg(case when c.column_name = 'member_id' or c.column_name like '%\_member\_id' then format('$2 = t.%I', c.column_name)
                           when c.column_name like '%\_member\_ids' then format('$2 = any(t.%I)', c.column_name) end, ' or ')
             as member_match
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    group by c.table_name
  )
  select table_name, column_names,
         case
           when not p_for_member then
             case when table_name = 'venue' then 't.id = $1' when has_venue then 't.venue_id = $1' else 'true' end
           when table_name = 'member' then 't.venue_id = $1 and t.id = $2'
           when table_name = 'ledger_entry' then
             't.venue_id = $1 and t.account_id in (select a.id from public.ledger_account a where a.venue_id = $1 and a.member_id = $2)'
           when table_name = 'seat_move' then
             't.venue_id = $1 and t.session_id in (select s.id from public.seat_session s where s.venue_id = $1 and s.member_id = $2)'
           else format('t.venue_id = $1 and (%s)', member_match)
         end
  from tables
  where not p_for_member or table_name in ('member', 'ledger_entry', 'seat_move') or (has_venue and member_match is not null)
  order by table_name;
$$;

revoke execute on function private.export_archive_tables(boolean) from public, anon, authenticated;

-- Archives started: whose, of what, why the photos, and until when their tables may be read.
create table private.export_archive (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- No foreign key: a purge or a practice reset removes members an archive was of.
  member_id uuid,
  started_by uuid not null,
  kyc_reason text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);

alter table private.export_archive enable row level security;
revoke all on private.export_archive from public, anon, authenticated;
create index export_archive_venue_id_idx on private.export_archive (venue_id);

-- Refuses anyone but a super admin at the venue, and a member who is not the venue's.
create function private.assert_may_export_archive(p_venue_id uuid, p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'exports.full') then
    raise exception 'Only a super admin makes an export archive' using errcode = '42501';
  end if;
  if p_member_id is not null and not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function private.assert_may_export_archive(uuid, uuid) from public, anon, authenticated;

-- Starts an archive: counts each table's rows, writes the audit log (who: the log's actor, device and address;
-- the venue or member; each table's rows; the reason for KYC photos, full archive only, 10 to 500 characters),
-- alerts the owner when it is large, as a large table export does, and gives what the console needs to make it:
-- the archive's id, the key it is encrypted to, and each table with its columns.
create function private.start_export_archive(p_venue_id uuid, p_member_id uuid, p_kyc_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_kyc_reason, '')), '');
  v_recipient text;
  v_alert_rows integer := coalesce((private.setting_at(p_venue_id, 'exports.alert_rows', '', now()) ->> 'rows')::integer, 1000);
  v_table record;
  v_rows bigint;
  v_counts jsonb := '{}'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_id uuid;
begin
  perform private.assert_may_export_archive(p_venue_id, p_member_id);
  if v_reason is not null and (p_member_id is not null or length(v_reason) not between 10 and 500) then
    raise exception 'KYC photos go in a full archive only, with a reason of 10 to 500 characters' using errcode = '22023';
  end if;
  v_recipient := private.setting_at(p_venue_id, 'exports.archive_recipient', '', now()) ->> 'recipient';
  if v_recipient is null then
    raise exception 'Set the owner''s backup key (exports.archive_recipient) first' using errcode = 'RVKEY';
  end if;
  for v_table in select * from private.export_archive_tables(p_member_id is not null) loop
    execute format('select count(*) from public.%I t where %s', v_table.table_name, v_table.predicate) using p_venue_id, p_member_id into v_rows;
    v_counts := v_counts || jsonb_build_object(v_table.table_name, v_rows);
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('name', v_table.table_name, 'columns', to_jsonb(v_table.column_names)));
  end loop;
  v_rows := (select coalesce(sum(c.value::bigint), 0) from jsonb_each(v_counts) c);
  insert into private.export_archive (venue_id, member_id, started_by, kyc_reason)
  values (p_venue_id, p_member_id, (select auth.uid()), v_reason)
  returning id into v_id;
  perform private.audit(p_venue_id, case when p_member_id is null then 'export.archive' else 'export.member' end,
                        case when p_member_id is null then 'venue' else 'member' end, coalesce(p_member_id, p_venue_id)::text, null,
                        jsonb_build_object('archive', v_id, 'tables', jsonb_array_length(v_tables), 'rows', v_rows,
                                           'kyc_photos', v_reason is not null, 'counts', v_counts),
                        v_reason);
  if v_rows >= v_alert_rows then
    -- No personal data in an alert: the audit log holds who, and which member.
    perform private.raise_alert(p_venue_id, 'export.large', jsonb_build_object(
      'what', case when p_member_id is null then 'Full archive' else 'Member export' end, 'format', 'archive', 'rows', v_rows));
  end if;
  return jsonb_build_object('archive_id', v_id, 'recipient', v_recipient, 'tables', v_tables);
end;
$$;

-- One page of a table for an archive its reader started within the hour: up to p_limit rows after p_after, in
-- primary key order, each row its cells as the database casts them to text (times in UTC), null as null. `after`
-- is the last row's key, to ask for the next page with, or null on the last page.
create function private.export_archive_rows(p_archive_id uuid, p_table text, p_after jsonb, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set "TimeZone" = 'UTC'
as $$
declare
  v_archive private.export_archive;
  v_table record;
  v_key text[];
  v_order text;
  v_last_first text;
  v_after text := '';
  v_rows jsonb;
  v_last jsonb;
begin
  select * into v_archive from private.export_archive a
  where a.id = p_archive_id and a.started_by = (select auth.uid()) and a.expires_at > now();
  if not found then
    raise exception 'No archive of yours under way: start it again' using errcode = '42501';
  end if;
  perform private.assert_may_export_archive(v_archive.venue_id, v_archive.member_id);
  if p_limit is null or p_limit not between 1 and 5000 then
    raise exception 'Pages of 1 to 5,000 rows' using errcode = '22023';
  end if;
  select * into v_table from private.export_archive_tables(v_archive.member_id is not null) t where t.table_name = p_table;
  if not found then
    raise exception 'Not a table this archive holds' using errcode = '22023';
  end if;
  select array_agg(a.attname::text order by k.position) into v_key
  from pg_index i
  cross join unnest(i.indkey) with ordinality k(attnum, position)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = format('public.%I', p_table)::regclass and i.indisprimary;
  v_order := (select string_agg(format('t.%I', c), ', ') from unnest(v_key) c);
  -- Descending on every key column, so the page's last row is its last by the whole key.
  v_last_first := (select string_agg(format('t.%I desc', c), ', ') from unnest(v_key) c);
  if p_after is not null and p_after <> 'null'::jsonb then
    v_after := format(' and (%s) > (select %s from jsonb_populate_record(null::public.%I, $3) a)',
                      v_order, (select string_agg(format('a.%I', c), ', ') from unnest(v_key) c), p_table);
  end if;
  -- The page is taken first, by the primary key's index, then turned into cells in the same order.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(array[%s]::text[]) order by %s), ''[]''), (array_agg(jsonb_build_object(%s) order by %s))[1]
     from (select * from public.%I t where (%s)%s order by %s limit $4) t',
    (select string_agg(format('t.%I::text', c), ', ') from unnest(v_table.column_names) c), v_order,
    (select string_agg(format('%L, t.%I', c, c), ', ') from unnest(v_key) c), v_last_first,
    p_table, v_table.predicate, v_after, v_order)
  using v_archive.venue_id, v_archive.member_id, p_after, p_limit
  into v_rows, v_last;
  return jsonb_build_object('rows', v_rows, 'after', case when jsonb_array_length(v_rows) = p_limit then v_last end);
end;
$$;

create function public.start_export_archive(p_venue_id uuid, p_member_id uuid default null, p_kyc_reason text default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.start_export_archive(p_venue_id, p_member_id, p_kyc_reason); $$;

create function public.export_archive_rows(p_archive_id uuid, p_table text, p_after jsonb default null, p_limit integer default 1000)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.export_archive_rows(p_archive_id, p_table, p_after, p_limit); $$;

revoke execute on function private.start_export_archive(uuid, uuid, text), private.export_archive_rows(uuid, text, jsonb, integer),
  public.start_export_archive(uuid, uuid, text), public.export_archive_rows(uuid, text, jsonb, integer)
  from public, anon;
grant execute on function private.start_export_archive(uuid, uuid, text), private.export_archive_rows(uuid, text, jsonb, integer),
  public.start_export_archive(uuid, uuid, text), public.export_archive_rows(uuid, text, jsonb, integer)
  to authenticated;
