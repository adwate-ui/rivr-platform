-- Purge a live venue (#432; features "Purge"; the owner's approval of the plan and answer on what goes, 27 Oct; decision
-- 0239). A super admin with purge.run, at a venue that is not the practice one (that one resets to its seed, #104) and
-- that is frozen. The console first makes the full encrypted archive (#103) with the KYC photos: every table read to its
-- end through pages the server hands out in order, and every file the server listed for the venue (KYC photos, expense
-- receipts), then saves it and says so with the file's SHA-256 and size and the files it could not read. The purge, run
-- from the console itself so its computer is checked, needs such an archive of that venue, by the same super admin,
-- started after the freeze, saved within 30 minutes, and no row added, removed or changed since. With the rows go the
-- purged members' logins (as member erasure removes one) and their personal fields in the audit log. The purge-venue
-- Edge Function then removes, as the super admin asks within seven days, only the files the archive holds and no row
-- still names.
-- The dry run counts each table's rows; the venue's name is typed. In one transaction one statement deletes the
-- venue's play (foreign keys checked at its end), as the practice reset does; the ledger is checked; the audit log,
-- which a purge never deletes, records it; the owner is alerted.
--
-- What goes is what the spec's purge names: members, visits, sessions, hands, tournaments, the ledger's entries,
-- promotions, media and messages. What stays, beyond what a practice reset keeps (setup, staff, controls, cameras,
-- the audit log): the venue's own ledger accounts (its members' accounts go), its payment accounts, shareholders and
-- holdings, Tally map, blind structures, tournament templates, expense categories, reward catalogue and League
-- seasons. Shared id sequences are left alone (decision 0117); per-venue numbering (invoice counters) starts again,
-- since its rows go.

alter table private.export_archive
  add column completed_at timestamptz,
  -- Each table's rows as the archive counted them when it started; and the tables read to their last page.
  add column counts jsonb,
  add column tables_read text[] not null default '{}',
  -- The file the console saved, as it says.
  add column file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  add column file_bytes bigint check (file_bytes is null or file_bytes > 0),
  -- The venue's files the server listed when a full archive started (<bucket>/<path>), and those the saved file holds.
  add column files_listed text[] not null default '{}',
  add column files_held text[],
  -- Where each table's reading has got to: the page last handed out ("prev") and the next one ("next"), so a table is
  -- marked read only when the server's own pages reach its end.
  add column cursors jsonb not null default '{}';

-- A freeze goes with its member: a purge or practice reset that removes a member removes its freezes too. Nothing else
-- deletes a member.
alter table public.control_state drop constraint control_state_member_id_venue_id_fkey,
  add constraint control_state_member_id_venue_id_fkey foreign key (member_id, venue_id) references public.member (id, venue_id) on delete cascade;

-- As before (20261027130000_member_erasure.sql), and a purge may strip personal fields from its venue's audit rows too.
create or replace function private.is_audit_scrub(p_old jsonb, p_new jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (private.erasing()::text in (p_old ->> 'entity_id', p_old -> 'before' ->> 'member_id', p_old -> 'after' ->> 'member_id')
     or coalesce(private.purging((p_old ->> 'venue_id')::uuid), false))
      and p_old - array['before', 'after'] = p_new - array['before', 'after']
      and p_new -> 'before' = private.strip_erased_fields(p_old -> 'before')
      and p_new -> 'after' = private.strip_erased_fields(p_old -> 'after'),
    false);
$$;

-- As before (20261028200000_member_export_owed.sql), keeping each table's count on the archive.
create or replace function private.start_export_archive(p_venue_id uuid, p_member_id uuid, p_kyc_reason text)
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
  v_files text[] := '{}';
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
    execute format('select count(*) from public.%I t where %s', v_table.source_table, v_table.predicate) using p_venue_id, p_member_id into v_rows;
    v_counts := v_counts || jsonb_build_object(v_table.table_name, v_rows);
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('name', v_table.table_name, 'columns', to_jsonb(v_table.column_names)));
  end loop;
  -- A staff-notes entry is rows already counted with its table, and not a table of its own.
  v_rows := (select coalesce(sum(c.value::bigint), 0) from jsonb_each(v_counts) c where c.key not like 'staff-notes/%');
  -- A full archive holds the venue's files as Storage has them, each named <bucket>/<path>: expense receipts always,
  -- KYC photos when a reason is given. Listed here, so the console can neither add nor leave one out unseen.
  if p_member_id is null then
    v_files := array(select o.bucket_id || '/' || o.name from storage.objects o
                     where o.name like p_venue_id::text || '/%'
                       and (o.bucket_id = 'expense-receipts' or (o.bucket_id = 'kyc' and v_reason is not null))
                     order by 1);
  end if;
  insert into private.export_archive (venue_id, member_id, started_by, kyc_reason, counts, files_listed)
  values (p_venue_id, p_member_id, (select auth.uid()), v_reason, v_counts, v_files)
  returning id into v_id;
  perform private.audit(p_venue_id, case when p_member_id is null then 'export.archive' else 'export.member' end,
                        case when p_member_id is null then 'venue' else 'member' end, coalesce(p_member_id, p_venue_id)::text, null,
                        jsonb_build_object('archive', v_id, 'tables', (select count(*) from jsonb_array_elements(v_tables) e where e ->> 'name' not like 'staff-notes/%'), 'rows', v_rows,
                                           'kyc_photos', v_reason is not null, 'counts', v_counts, 'files', cardinality(v_files)),
                        v_reason);
  if v_rows >= v_alert_rows then
    -- No personal data in an alert: the audit log holds who, and which member.
    perform private.raise_alert(p_venue_id, 'export.large', jsonb_build_object(
      'what', case when p_member_id is null then 'Full archive' else 'Member export' end, 'format', 'archive', 'rows', v_rows));
  end if;
  return jsonb_build_object('archive_id', v_id, 'recipient', v_recipient, 'tables', v_tables, 'files', to_jsonb(v_files));
end;
$$;

-- As before (20261028200000_member_export_owed.sql), handing out each table's pages in order: the next page from where
-- the server left off, or the last page again (a lost answer). A table is noted read when the server's own next page
-- comes back short, which saving the archive needs.
create or replace function private.export_archive_rows(p_archive_id uuid, p_table text, p_after jsonb, p_limit integer)
returns jsonb
language plpgsql
volatile
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
  v_given jsonb := coalesce(p_after, 'null'::jsonb);
  v_cursor jsonb;
  v_is_next boolean;
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
  v_cursor := v_archive.cursors -> p_table;
  v_is_next := v_given = coalesce(v_cursor -> 'next', 'null'::jsonb);
  if not v_is_next and v_given is distinct from v_cursor -> 'prev' then
    raise exception 'Read each table''s pages in order' using errcode = '22023';
  end if;
  select array_agg(a.attname::text order by k.position) into v_key
  from pg_index i
  cross join unnest(i.indkey) with ordinality k(attnum, position)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = format('public.%I', v_table.source_table)::regclass and i.indisprimary;
  v_order := (select string_agg(format('t.%I', c), ', ') from unnest(v_key) c);
  -- Descending on every key column, so the page's last row is its last by the whole key.
  v_last_first := (select string_agg(format('t.%I desc', c), ', ') from unnest(v_key) c);
  if v_given <> 'null'::jsonb then
    v_after := format(' and (%s) > (select %s from jsonb_populate_record(null::public.%I, $3) a)',
                      v_order, (select string_agg(format('a.%I', c), ', ') from unnest(v_key) c), v_table.source_table);
  end if;
  -- The page is taken first, by the primary key's index, then turned into cells in the same order.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(array[%s]::text[]) order by %s), ''[]''), (array_agg(jsonb_build_object(%s) order by %s))[1]
     from (select * from public.%I t where (%s)%s order by %s limit $4) t',
    -- Another member's id is given only where it is this member's own (#498).
    (select string_agg(case when c <> all(v_table.blanked) then format('t.%I::text', c)
                            when exists (select 1 from pg_attribute a where a.attrelid = format('public.%I', v_table.source_table)::regclass
                                         and a.attname = c and a.atttypid = 'uuid[]'::regtype)
                              then format('(case when $2 = any(t.%I) then array[$2] end)::text', c)
                            else format('(case when t.%I = $2 then t.%I end)::text', c, c) end, ', ')
     from unnest(v_table.column_names) c), v_order,
    (select string_agg(format('%L, t.%I', c, c), ', ') from unnest(v_key) c), v_last_first,
    v_table.source_table, v_table.predicate, v_after, v_order)
  using v_archive.venue_id, v_archive.member_id, p_after, p_limit
  into v_rows, v_last;
  if v_is_next then
    -- Compare and advance in one statement, so two calls at once cannot both take the next page.
    update private.export_archive a
    set cursors = jsonb_set(a.cursors, array[p_table], jsonb_build_object('prev', v_given,
                    'next', case when jsonb_array_length(v_rows) = p_limit then v_last else 'null'::jsonb end)),
        tables_read = case when jsonb_array_length(v_rows) < p_limit and not p_table = any(a.tables_read)
                           then array_append(a.tables_read, p_table) else a.tables_read end
    where a.id = p_archive_id and a.cursors -> p_table is not distinct from v_cursor;
    if not found then
      raise exception 'Read each table''s pages one at a time' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('rows', v_rows, 'after', case when jsonb_array_length(v_rows) = p_limit then v_last end);
end;
$$;


-- The console says a full archive is saved, once the browser has written the file: its maker, still allowed to export,
-- every table read to its last page, with the file's SHA-256 and size and the listed files it could not read; the
-- archive holds the rest, which the audit log keeps with the rest.
create function private.complete_export_archive(p_archive_id uuid, p_sha256 text, p_bytes bigint, p_unread text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive private.export_archive;
begin
  select * into v_archive from private.export_archive a
  where a.id = p_archive_id and a.started_by = (select auth.uid()) and a.member_id is null and a.expires_at > now() and a.completed_at is null;
  if not found then
    raise exception 'No full archive of yours, still open, to mark saved' using errcode = '22023';
  end if;
  perform private.assert_may_export_archive(v_archive.venue_id, null);
  if exists (select 1 from jsonb_object_keys(v_archive.counts) k where not k = any(v_archive.tables_read)) then
    raise exception 'Read every table of the archive before saving it' using errcode = '22023';
  end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' or coalesce(p_bytes, 0) <= 0 then
    raise exception 'The saved file''s SHA-256 and size' using errcode = '22023';
  end if;
  if p_unread is null or not p_unread <@ v_archive.files_listed then
    raise exception 'The files not read are ones the archive listed' using errcode = '22023';
  end if;
  update private.export_archive a
  set completed_at = now(), file_sha256 = p_sha256, file_bytes = p_bytes,
      files_held = array(select f from unnest(a.files_listed) f where f <> all(p_unread))
  where a.id = p_archive_id;
  perform private.audit(v_archive.venue_id, 'export.archive_saved', 'export_archive', p_archive_id::text, null,
                        jsonb_build_object('sha256', p_sha256, 'bytes', p_bytes, 'files_held', cardinality(v_archive.files_listed) - cardinality(p_unread),
                                           'files_unread', cardinality(p_unread)));
end;
$$;

-- As before (20261027200200_export_archive.sql), but volatile: reading a table's last page notes it on the archive, and
-- the API runs a stable function read-only.
create or replace function public.export_archive_rows(p_archive_id uuid, p_table text, p_after jsonb default null, p_limit integer default 1000)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.export_archive_rows(p_archive_id, p_table, p_after, p_limit); $$;

-- What a live purge keeps beyond what a practice reset keeps: the venue's own setup that a reset reloads from its seed.
create function private.live_purge_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['blind_structure', 'expense_category', 'league_season', 'payment_account', 'reward_item', 'shareholder', 'shareholding',
               'tally_ledger_map', 'tournament_template'];
$$;

-- The tables a live purge deletes from: what a practice reset reloads, but for those above. 150_purge_live_venue lists
-- them, so a new venue table is a decision. In ledger_account only members' accounts go.
create function private.live_purge_tables()
returns setof text
language sql
stable
set search_path = ''
as $$
  select t from private.practice_reset_tables() t where t <> all (private.live_purge_keeps()) order by 1;
$$;

-- Who may purge: a super admin with purge.run, at a frozen venue that is not the practice one.
create function private.assert_live_purge(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'purge.run') then
    raise exception 'Only a super admin of this venue purges it' using errcode = '42501';
  end if;
  if exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'The practice venue resets to its seed instead' using errcode = 'RVPRC';
  end if;
  if not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null) then
    raise exception 'Freeze the venue before purging it' using errcode = 'RVNFZ';
  end if;
end;
$$;

-- How many of a table's rows a purge deletes.
create function private.live_purge_count(p_venue_id uuid, p_table text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from public.%I where venue_id = $1%s', p_table,
                 case when p_table = 'ledger_account' then ' and member_id is not null' else '' end)
  into v_count using p_venue_id;
  return v_count;
end;
$$;

-- A table's rows at a venue, as the full archive counts them.
create function private.venue_row_count(p_venue_id uuid, p_table text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from public.%I where venue_id = $1', p_table) into v_count using p_venue_id;
  return v_count;
end;
$$;

-- Whether any of a table's rows at a venue changed after a time, for tables that keep updated_at.
create function private.venue_changed_since(p_venue_id uuid, p_table text, p_since timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  if not exists (select 1 from pg_attribute a where a.attrelid = format('public.%I', p_table)::regclass and a.attname = 'updated_at'
                 and not a.attisdropped) then
    return false;
  end if;
  execute format('select exists (select 1 from public.%I where venue_id = $1 and updated_at > $2)', p_table) into v_changed using p_venue_id, p_since;
  return v_changed;
end;
$$;

-- A venue's purges, and the files each leaves to remove: those the archive held, as the super admin removes them.
create table private.venue_purge (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  archive_id uuid not null,
  purged_at timestamptz not null default now(),
  purged_by uuid,
  files text[] not null,
  removed text[] not null default '{}',
  done_at timestamptz
);
alter table private.venue_purge enable row level security;
revoke all on private.venue_purge from public, anon, authenticated;

-- The dry run: each table a purge deletes from, with the rows it would delete.
create function private.live_purge_preview(p_venue_id uuid)
returns table (table_name text, current_rows bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_live_purge(p_venue_id);
  return query select t, private.live_purge_count(p_venue_id, t) from private.live_purge_tables() t;
end;
$$;

-- The purge: what the dry run showed, once a saved archive is recent and the venue's name is typed.
create function private.purge_live_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive private.export_archive;
  v_table text;
  v_members text[];
  v_parts text;
  v_counts text;
  v_deleted jsonb;
begin
  perform private.assert_live_purge(p_venue_id);
  if p_venue_name is distinct from (select v.name from public.venue v where v.id = p_venue_id) then
    raise exception 'Type the venue''s name exactly to purge it' using errcode = 'RVNAM';
  end if;
  -- The newest saved archive: made after the freeze, saved within 30 minutes, and every table it counted unchanged.
  select * into v_archive from private.export_archive a
  where a.venue_id = p_venue_id and a.member_id is null and a.started_by = (select auth.uid()) and a.completed_at > now() - interval '30 minutes'
    and a.started_at > (select max(c.engaged_at) from public.control_state c
                        where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null)
  order by a.started_at desc limit 1;
  if not found then
    raise exception 'Make and save the full archive after freezing the venue' using errcode = 'RVARC';
  end if;
  if v_archive.kyc_reason is null then
    raise exception 'The archive must hold the KYC photos: make it again with the reason' using errcode = 'RVARC';
  end if;
  -- Nothing written from here to the delete: every table it deletes from, locked in name order, waiting five seconds
  -- at most. The freeze stops the venue's writes, but not every write passes the freeze's check.
  perform set_config('lock_timeout', '5s', true);
  for v_table in select t from private.live_purge_tables() t order by t loop
    execute format('lock table public.%I in share row exclusive mode', v_table);
  end loop;
  if exists (select 1 from private.live_purge_tables() t
             where coalesce((v_archive.counts ->> t)::bigint, -1) <> private.venue_row_count(p_venue_id, t)
                or private.venue_changed_since(p_venue_id, t, v_archive.started_at)) then
    raise exception 'The venue changed since the archive: make it again' using errcode = 'RVARC';
  end if;
  v_members := array(select m.id::text from public.member m where m.venue_id = p_venue_id);

  -- Purge's own way past the append-only and guarded tables: this venue, this transaction.
  perform set_config('rivr.purge', 'on', true);
  perform set_config('rivr.purge_venue', p_venue_id::text, true);
  -- The members' logins go, unless one also signs in as staff or a device.
  perform private.remove_member_login(m) from public.member m where m.venue_id = p_venue_id and m.user_id is not null;
  select string_agg(format('d%s as (delete from public.%I where venue_id = $1%s returning 1)', n, t,
                           case when t = 'ledger_account' then ' and member_id is not null' else '' end), ', '),
         string_agg(format('(%L, (select count(*) from d%s))', t, n), ', ')
  into v_parts, v_counts
  from (select t, row_number() over (order by t) as n from private.live_purge_tables() t) tables;
  execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_deleted using p_venue_id;
  -- Then the personal fields of the audit rows about what it deleted, those the deletes just wrote included, and of
  -- any row naming a purged member (a kept table's, such as a member's freeze), as an erasure strips them.
  update public.audit_log a set before = private.strip_erased_fields(a.before), after = private.strip_erased_fields(a.after)
  where a.venue_id = p_venue_id
    and (a.entity in (select private.live_purge_tables()) or a.before ->> 'member_id' = any(v_members) or a.after ->> 'member_id' = any(v_members))
    and (a.before is distinct from private.strip_erased_fields(a.before) or a.after is distinct from private.strip_erased_fields(a.after));
  perform set_config('rivr.purge', 'off', true);
  perform set_config('rivr.purge_venue', '', true);

  -- Nothing left behind, and the venue's own accounts hold nothing, as no entry is left to hold.
  if exists (select 1 from private.live_purge_tables() t where private.live_purge_count(p_venue_id, t) > 0)
     or exists (select 1 from public.ledger_entry e where e.venue_id = p_venue_id) then
    raise exception 'Purge left rows behind' using errcode = 'RVPRG';
  end if;
  insert into private.venue_purge (venue_id, archive_id, purged_by, files)
  values (p_venue_id, v_archive.id, (select auth.uid()), coalesce(v_archive.files_held, '{}'));
  perform private.audit(p_venue_id, 'venue.purge', 'venue', p_venue_id::text, null,
                        jsonb_build_object('deleted', v_deleted, 'files_to_remove', cardinality(v_archive.files_held)), 'Purged');
  perform private.raise_alert(p_venue_id, 'venue.purged', jsonb_build_object('tables', (select count(*) from jsonb_object_keys(v_deleted))));

  return query select d.key, (d.value)::text::bigint from jsonb_each(v_deleted) d order by d.key;
end;
$$;

-- The files a venue's latest purge still leaves (<bucket>/<path>): those its archive held, not yet removed, under the
-- venue's own folder, and named by no row (a reopened venue's new KYC photo or receipt stays). Within seven days of the
-- purge; none once it is done.
create function private.purge_files_left(p_venue_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select f
  from (select * from private.venue_purge p where p.venue_id = p_venue_id order by p.purged_at desc limit 1) p
  cross join unnest(p.files) f
  where p.done_at is null and p.purged_at > now() - interval '7 days' and f <> all(p.removed)
    and (f like 'kyc/' || p_venue_id::text || '/%' or f like 'expense-receipts/' || p_venue_id::text || '/%')
    and not exists (select 1 from public.kyc_record k where k.venue_id = p_venue_id and 'kyc/' || k.photo_path = f)
    and not exists (select 1 from public.expense e where e.venue_id = p_venue_id and 'expense-receipts/' || e.receipt_path = f);
$$;

-- For the purge-venue Edge Function, asked as the caller: the files to remove now. A super admin of the venue (by role,
-- since the function's request carries no console's mark), within the rate limit.
create function private.purge_files_due(p_venue_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.is_super_admin(p_venue_id) then
    raise exception 'Only a super admin of this venue removes its purge''s files' using errcode = '42501';
  end if;
  perform private.assert_rate(p_venue_id, 'purge.files', 10, 20);
  return query select * from private.purge_files_left(p_venue_id);
end;
$$;

-- What the function removed, and how many it could not: noted, the purge done once none is left, the audit log told.
create function private.purge_files_done(p_venue_id uuid, p_removed text[], p_failed integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purge private.venue_purge;
  v_left integer;
begin
  if p_venue_id is null or not private.is_super_admin(p_venue_id) then
    raise exception 'Only a super admin of this venue removes its purge''s files' using errcode = '42501';
  end if;
  select * into v_purge from private.venue_purge p where p.venue_id = p_venue_id order by p.purged_at desc limit 1 for update;
  if not found or p_removed is null or p_failed is null or p_failed < 0
     or exists (select 1 from unnest(p_removed) f where f not in (select private.purge_files_left(p_venue_id))) then
    raise exception 'Only files the purge left to remove' using errcode = '22023';
  end if;
  update private.venue_purge p set removed = p.removed || p_removed where p.id = v_purge.id;
  v_left := (select count(*) from private.purge_files_left(p_venue_id));
  if v_left = 0 then
    update private.venue_purge p set done_at = now() where p.id = v_purge.id;
  end if;
  perform private.audit(p_venue_id, 'venue.purge_files', 'venue', p_venue_id::text, null,
                        jsonb_build_object('removed', cardinality(p_removed), 'failed', p_failed, 'left', v_left), 'Purge files');
  return v_left;
end;
$$;

create function public.complete_export_archive(p_archive_id uuid, p_sha256 text, p_bytes bigint, p_unread text[] default '{}')
returns void language sql volatile security invoker set search_path = ''
as $$ select private.complete_export_archive(p_archive_id, p_sha256, p_bytes, p_unread); $$;
create function public.purge_files_due(p_venue_id uuid)
returns setof text language sql volatile security invoker set search_path = ''
as $$ select * from private.purge_files_due(p_venue_id); $$;
create function public.purge_files_done(p_venue_id uuid, p_removed text[], p_failed integer)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.purge_files_done(p_venue_id, p_removed, p_failed); $$;
create function public.live_purge_preview(p_venue_id uuid)
returns table (table_name text, current_rows bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.live_purge_preview(p_venue_id); $$;
create function public.purge_live_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.purge_live_venue(p_venue_id, p_venue_name); $$;

revoke execute on function private.live_purge_keeps(), private.live_purge_tables(), private.assert_live_purge(uuid),
  private.live_purge_count(uuid, text), private.venue_row_count(uuid, text), private.venue_changed_since(uuid, text, timestamptz),
  private.purge_files_left(uuid) from public, anon, authenticated;
revoke execute on function private.complete_export_archive(uuid, text, bigint, text[]), private.live_purge_preview(uuid),
  private.purge_live_venue(uuid, text), private.purge_files_due(uuid), private.purge_files_done(uuid, text[], integer),
  public.complete_export_archive(uuid, text, bigint, text[]), public.live_purge_preview(uuid), public.purge_live_venue(uuid, text),
  public.purge_files_due(uuid), public.purge_files_done(uuid, text[], integer) from public, anon;
grant execute on function private.complete_export_archive(uuid, text, bigint, text[]), private.live_purge_preview(uuid),
  private.purge_live_venue(uuid, text), private.purge_files_due(uuid), private.purge_files_done(uuid, text[], integer),
  public.complete_export_archive(uuid, text, bigint, text[]), public.live_purge_preview(uuid), public.purge_live_venue(uuid, text),
  public.purge_files_due(uuid), public.purge_files_done(uuid, text[], integer) to authenticated;
