-- Reset to seed on the practice venue (#104; features "Purge"; additions flow 16; decision 0117). The owner
-- split purge (21 Oct): for training, only the practice venue's reset to its seed; purging a live venue, with
-- its automatic export, is #432. A super admin of the practice venue, checked here, sees per table how many
-- rows it holds now and in its seed, then types the venue's name to reset it. In one transaction the reset
-- deletes the venue's play (members, visits, seats, hands, the cage, the ledger, promotions, tournaments,
-- messages, kill-switch controls) in one statement and reloads the seed's copy in another, with the tables'
-- own triggers switched off so nothing replays: no member accounts opened twice, no promotions run, no
-- messages queued. Foreign keys stay on and are checked at the end of each statement, so no row is left
-- without its parent, tables that refer to each other included. It then checks what the switched-off
-- triggers would have: every ledger transaction balances, and every table matches its seed.
-- The venue's setup (staff, devices, configuration, settings, tiers, tables, SOPs, quizzes and every
-- certification attempt, the website) stays, and so does the audit log, which records the reset.

-- The seed's copy of each practice venue's play, captured when the seed loads (supabase/seed/99_practice_seed.sql)
-- and, where no seed runs, as this migration finds the venue.
create table private.practice_seed (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  table_name text not null,
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_seed_venue_idx on private.practice_seed (venue_id, table_name);
alter table private.practice_seed enable row level security;
revoke all on private.practice_seed from public, anon, authenticated;
comment on table private.practice_seed is 'Each practice venue''s seed, row by row, which reset to seed reloads (#104).';

-- What a reset keeps: the venue's setup and its records of staff, never its play.
create function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page'];
$$;

-- The tables a reset reloads: every venue table but those it keeps, so a new table resets unless kept.
create function private.practice_reset_tables()
returns setof text
language sql
stable
set search_path = ''
as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'venue_id' and not a.attisdropped)
    and c.relname <> all (private.practice_reset_keeps())
  order by 1;
$$;

-- Captures a practice venue's play as its seed, replacing what was captured before.
create function private.capture_practice_seed(p_venue_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_total integer := 0;
  v_rows integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'Only a practice venue has a seed to reset to' using errcode = 'RVPRA';
  end if;
  delete from private.practice_seed where venue_id = p_venue_id;
  for v_table in select private.practice_reset_tables() loop
    execute format('insert into private.practice_seed (venue_id, table_name, row_data) select $1, %L, to_jsonb(t) from public.%I t where t.venue_id = $1',
                   v_table, v_table) using p_venue_id;
    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;
  end loop;
  -- A marker row, so a venue whose seed holds no play still has one.
  insert into private.practice_seed (venue_id, table_name, row_data) values (p_venue_id, '', jsonb_build_object('captured_at', now()));
  return v_total;
end;
$$;

-- Who may reset: a super admin at that practice venue, which has a seed. Raises otherwise.
create function private.assert_practice_reset(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_super_admin(p_venue_id), false) then
    raise exception 'Only a super admin of this venue resets it' using errcode = '42501';
  end if;
  if not exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'Only the practice venue resets to its seed' using errcode = 'RVPRA';
  end if;
  if not exists (select 1 from private.practice_seed s where s.venue_id = p_venue_id and s.table_name = '') then
    raise exception 'This venue has no seed captured' using errcode = 'RVSED';
  end if;
end;
$$;

-- The dry run: each table a reset reloads, with its rows now and in the seed.
create function private.practice_reset_preview(p_venue_id uuid)
returns table (table_name text, current_rows bigint, seed_rows bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table text;
begin
  perform private.assert_practice_reset(p_venue_id);
  for v_table in select private.practice_reset_tables() loop
    table_name := v_table;
    execute format('select count(*) from public.%I where venue_id = $1', v_table) into current_rows using p_venue_id;
    select count(*) into seed_rows from private.practice_seed s where s.venue_id = p_venue_id and s.table_name = v_table;
    return next;
  end loop;
end;
$$;

-- Reset to seed: what the dry run showed, once the venue's name is typed.
create function private.reset_practice_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint, restored_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_parts text;
  v_counts text;
  v_deleted jsonb;
  v_restored jsonb;
  v_sequence record;
begin
  perform private.assert_practice_reset(p_venue_id);
  if p_venue_name is distinct from (select v.name from public.venue v where v.id = p_venue_id) then
    raise exception 'Type the venue''s name exactly to reset it' using errcode = 'RVNAM';
  end if;
  perform private.assert_writable(p_venue_id, null, null);

  -- The tables' own triggers are off for this transaction only, so the seed's rows go back as they were,
  -- replaying nothing. Switching them off holds other writers to these tables until it commits, so it waits
  -- briefly for them, never long.
  perform set_config('lock_timeout', '5s', true);
  for v_table in select private.practice_reset_tables() loop
    execute format('alter table public.%I disable trigger user', v_table);
  end loop;
  -- One statement each way, a part per table, its rows counted.
  select string_agg(format('d%s as (delete from public.%I where venue_id = $1 returning 1)', n, t), ', '),
         string_agg(format('(%L, (select count(*) from d%s))', t, n), ', ')
  into v_parts, v_counts
  from (select t, row_number() over (order by t) as n from private.practice_reset_tables() t) tables;
  execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_deleted using p_venue_id;
  select string_agg(format('i%s as (insert into public.%I (%s) overriding system value select %s from private.practice_seed s '
                           'cross join lateral jsonb_populate_record(null::public.%I, s.row_data) r '
                           'where s.venue_id = $1 and s.table_name = %L returning 1)', n, t, columns, rcolumns, t, t), ', '),
         string_agg(format('(%L, (select count(*) from i%s))', t, n), ', ')
  into v_parts, v_counts
  from (
    select t, row_number() over (order by t) as n,
           (select string_agg(format('%I', a.attname), ', ' order by a.attnum) from pg_attribute a
            where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '') as columns,
           (select string_agg(format('r.%I', a.attname), ', ' order by a.attnum) from pg_attribute a
            where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '') as rcolumns
    from private.practice_reset_tables() t
  ) tables;
  execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_restored using p_venue_id;
  for v_table in select private.practice_reset_tables() loop
    execute format('alter table public.%I enable trigger user', v_table);
  end loop;

  -- Sequences carry on past the rows the seed brought back.
  for v_sequence in
    select pg_get_serial_sequence(format('public.%I', t.table_name), a.attname) as name, t.table_name, a.attname
    from (select private.practice_reset_tables() as table_name) t
    join pg_attribute a on a.attrelid = format('public.%I', t.table_name)::regclass and a.attnum > 0 and not a.attisdropped
    where pg_get_serial_sequence(format('public.%I', t.table_name), a.attname) is not null
  loop
    execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', v_sequence.name, v_sequence.attname, v_sequence.table_name);
  end loop;

  -- What the switched-off triggers would have checked, checked here: a balanced ledger, the seed's counts.
  if exists (select 1 from public.ledger_entry e where e.venue_id = p_venue_id group by e.transaction_id having sum(e.amount) <> 0) then
    raise exception 'Reset left an unbalanced ledger transaction' using errcode = 'RVRST';
  end if;
  if exists (select 1 from private.practice_reset_preview(p_venue_id) p where p.current_rows <> p.seed_rows) then
    raise exception 'Reset did not bring every table back to its seed' using errcode = 'RVRST';
  end if;

  insert into public.audit_log (venue_id, actor_user_id, action, entity, entity_id, after, reason)
  values (p_venue_id, (select auth.uid()), 'practice.reset', 'venue', p_venue_id,
          jsonb_build_object('deleted', v_deleted, 'restored', v_restored), 'Reset to seed');

  return query select d.key, (d.value)::text::bigint, (v_restored ->> d.key)::bigint from jsonb_each(v_deleted) d order by d.key;
end;
$$;

revoke execute on function private.practice_reset_keeps(), private.practice_reset_tables(), private.capture_practice_seed(uuid),
  private.assert_practice_reset(uuid), private.practice_reset_preview(uuid),
  private.reset_practice_venue(uuid, text) from public, anon, authenticated;
grant execute on function private.practice_reset_preview(uuid), private.reset_practice_venue(uuid, text) to authenticated;

create function public.practice_reset_preview(p_venue_id uuid)
returns table (table_name text, current_rows bigint, seed_rows bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.practice_reset_preview(p_venue_id); $$;

create function public.reset_practice_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint, restored_rows bigint)
language sql security invoker set search_path = ''
as $$ select * from private.reset_practice_venue(p_venue_id, p_venue_name); $$;

revoke execute on function public.practice_reset_preview(uuid), public.reset_practice_venue(uuid, text) from public, anon;
grant execute on function public.practice_reset_preview(uuid), public.reset_practice_venue(uuid, text) to authenticated;

-- Where no seed runs, the practice venue as it stands now is its seed.
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
