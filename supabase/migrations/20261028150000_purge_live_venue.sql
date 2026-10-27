-- Purge a live venue (#432; features "Purge"; the owner's approval of the plan, 27 Oct; decision 0239). A super admin
-- with purge.run, at a venue that is not the practice one (that one resets to its seed, #104) and that is frozen, so
-- nothing changes between the archive and the purge. The console first makes the full encrypted archive (#103) and
-- saves it, then says so; the purge needs such an archive of that venue, by the same super admin, within 30 minutes.
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

alter table private.export_archive add column completed_at timestamptz;

-- The console says a full archive is saved, once the browser has written the file.
create function private.complete_export_archive(p_archive_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  update private.export_archive a set completed_at = now()
  where a.id = p_archive_id and a.started_by = (select auth.uid()) and a.member_id is null and a.expires_at > now() and a.completed_at is null
  returning a.venue_id into v_venue_id;
  if v_venue_id is null then
    raise exception 'No full archive of yours, still open, to mark saved' using errcode = '22023';
  end if;
  perform private.audit(v_venue_id, 'export.archive_saved', 'export_archive', p_archive_id::text, null, null);
end;
$$;

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
  v_parts text;
  v_counts text;
  v_deleted jsonb;
begin
  perform private.assert_live_purge(p_venue_id);
  if p_venue_name is distinct from (select v.name from public.venue v where v.id = p_venue_id) then
    raise exception 'Type the venue''s name exactly to purge it' using errcode = 'RVNAM';
  end if;
  if not exists (select 1 from private.export_archive a where a.venue_id = p_venue_id and a.member_id is null
                 and a.started_by = (select auth.uid()) and a.completed_at > now() - interval '30 minutes') then
    raise exception 'Make and save the full archive first' using errcode = 'RVARC';
  end if;

  -- Purge's own way past the append-only and guarded tables: this venue, this transaction.
  perform set_config('rivr.purge', 'on', true);
  perform set_config('rivr.purge_venue', p_venue_id::text, true);
  select string_agg(format('d%s as (delete from public.%I where venue_id = $1%s returning 1)', n, t,
                           case when t = 'ledger_account' then ' and member_id is not null' else '' end), ', '),
         string_agg(format('(%L, (select count(*) from d%s))', t, n), ', ')
  into v_parts, v_counts
  from (select t, row_number() over (order by t) as n from private.live_purge_tables() t) tables;
  execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_deleted using p_venue_id;
  perform set_config('rivr.purge', 'off', true);
  perform set_config('rivr.purge_venue', '', true);

  -- Nothing left behind, and the venue's own accounts hold nothing, as no entry is left to hold.
  if exists (select 1 from private.live_purge_tables() t where private.live_purge_count(p_venue_id, t) > 0)
     or exists (select 1 from public.ledger_entry e where e.venue_id = p_venue_id) then
    raise exception 'Purge left rows behind' using errcode = 'RVPRG';
  end if;
  perform private.audit(p_venue_id, 'venue.purge', 'venue', p_venue_id::text, null, jsonb_build_object('deleted', v_deleted), 'Purged');
  perform private.raise_alert(p_venue_id, 'venue.purged', jsonb_build_object('tables', (select count(*) from jsonb_object_keys(v_deleted))));

  return query select d.key, (d.value)::text::bigint from jsonb_each(v_deleted) d order by d.key;
end;
$$;

create function public.complete_export_archive(p_archive_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.complete_export_archive(p_archive_id); $$;
create function public.live_purge_preview(p_venue_id uuid)
returns table (table_name text, current_rows bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.live_purge_preview(p_venue_id); $$;
create function public.purge_live_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.purge_live_venue(p_venue_id, p_venue_name); $$;

revoke execute on function private.live_purge_keeps(), private.live_purge_tables(), private.assert_live_purge(uuid),
  private.live_purge_count(uuid, text) from public, anon, authenticated;
revoke execute on function private.complete_export_archive(uuid), private.live_purge_preview(uuid), private.purge_live_venue(uuid, text),
  public.complete_export_archive(uuid), public.live_purge_preview(uuid), public.purge_live_venue(uuid, text) from public, anon;
grant execute on function private.complete_export_archive(uuid), private.live_purge_preview(uuid), private.purge_live_venue(uuid, text),
  public.complete_export_archive(uuid), public.live_purge_preview(uuid), public.purge_live_venue(uuid, text) to authenticated;
