-- Reset to seed on the practice venue (#104; features "Purge"; additions flow 16; decision 0117). The owner
-- split purge (21 Oct): for training, only the practice venue's reset to its seed; purging a live venue, with
-- its automatic export, is #432. A super admin of the practice venue, checked here, sees per table how many
-- rows it holds now and in its seed, then types the venue's name to reset it. In one transaction the reset
-- deletes the venue's play (members, visits, seats, hands, the cage, the ledger, promotions, tournaments,
-- messages) in one statement and reloads the seed's copy in another. Foreign keys are checked at the end of
-- each statement, so tables that refer to each other (a cage shift and its chip count) need no order. It
-- runs as purge does on the ledger (rivr.purge): the append-only and guarded tables give up the venue's rows,
-- and the reload replays nothing (no member accounts opened twice, no promotions run, no messages queued).
-- It then checks that every ledger transaction balances and every table matches its seed, and writes the
-- audit log. The venue's setup, staff records, kill-switch controls and the audit log stay. Sequences are
-- left alone: the seed's rows keep the ids they were given, and a shared sequence never goes back.

-- The seed's copy of each practice venue's play, captured when the seed loads (supabase/seed/99_practice_seed.sql)
-- and, where no seed runs, as this migration finds the venue. A later migration that adds per-venue rows, or a
-- column without a default, to a table that resets captures it again (.claude/rules/database.md).
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

-- What a reset keeps: the venue's setup, its staff records and kill-switch controls, never its play.
create function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page', 'control_state',
               'contact', 'drill'];
$$;

-- The tables a reset reloads: every venue table but those it keeps. 092_practice_reset lists them, so a new
-- venue table is a decision: reset or kept.
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

-- Inside a purge, for the venue it purges: true only in the purge's own transaction, run as the database
-- owner, and only for that venue's rows. Triggers ask it before refusing a delete or replaying a row.
create function private.purging(p_venue_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user = 'postgres' and current_setting('rivr.purge', true) = 'on'
     and current_setting('rivr.purge_venue', true) = p_venue_id::text;
$$;

-- The append-only tables give up a purged venue's rows (decision 0117), as the ledger does.
create or replace function private.refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Asked only on a delete, which nothing but a purge ever gets past.
  if tg_op = 'DELETE' then
    if coalesce(private.purging((to_jsonb(old) ->> 'venue_id')::uuid), false) then
      return old;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create or replace function private.guard_high_hand_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purging(old.venue_id) then
      return old;
    end if;
    raise exception 'A high hand is never removed' using errcode = '22023';
  end if;
  if old.status = 'claimed' then
    return new;
  end if;
  -- Only the reversal's own columns change: everything else stays as decided.
  if old.status in ('approved', 'rejected') and new.status = 'reversed'
     and to_jsonb(new) - '{status,reversed_by_staff_id,reversed_at,reversed_reason,updated_at}'::text[]
         = to_jsonb(old) - '{status,reversed_by_staff_id,reversed_at,reversed_reason,updated_at}'::text[] then
    return new;
  end if;
  raise exception 'A decided high hand is final, but for its reversal' using errcode = '22023';
end;
$$;

-- A purge's reload brings rows back as they were: nothing they did the first time happens again.
create or replace function private.announce_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform private.signal_tv(new.venue_id, 'promotions');
  if new.status = 'live' and (tg_op = 'INSERT' or old.status = 'draft') then
    perform private.assert_writable(new.venue_id, 'promotions');
    perform private.emit(new.venue_id, 'promotion.offered',
                         jsonb_build_object('promotion_id', new.id, 'member_id', m.id, 'title', new.name, 'detail', new.detail, 'runs', new.runs),
                         'promotion.offered:' || new.id || ':' || m.id)
    from public.member m
    where m.venue_id = new.venue_id and private.has_consent(m.id, 'marketing') and private.has_feature(m.id, 'promotions.feed')
      and not exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.level = 'feature_kill'
                      and c.feature = 'marketing_sends' and c.released_at is null);
  end if;
  return null;
end;
$$;

create or replace function private.buy_in_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  perform private.evaluate_promotions(new.venue_id, 'buy_in', jsonb_build_object(
    'member_id', new.member_id, 'key', 'buy_in:' || new.id, 'amount_paise', new.amount_paise, 'method', new.method,
    'table_id', (select s.table_id from public.seat_session s where s.id = new.session_id)));
  return null;
end;
$$;

create or replace function private.kyc_review_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return new;
  end if;
  new.method := case when (select k.method from public.kyc_record k where k.member_id = new.member_id) = 'manual'
                     then 'manual' else 'vendor' end;
  return new;
end;
$$;

create or replace function private.mark_shift_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ledger:' || new.venue_id, 0));
  new.opened_after_entry_id := coalesce((select max(e.id) from public.ledger_entry e), 0);
  return new;
end;
$$;

create or replace function private.open_member_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  insert into public.ledger_account (venue_id, code, name, kind, unit, member_id, is_players_money) values
    (new.venue_id, 'member.cash', 'Cash balance', 'liability', 'paise', new.id, true),
    (new.venue_id, 'member.bonus', 'Bonus balance', 'liability', 'paise', new.id, false),
    (new.venue_id, 'member.points', 'Points', 'liability', 'points', new.id, false),
    (new.venue_id, 'member.receivable', 'Markers outstanding', 'asset', 'paise', new.id, false);
  return null;
end;
$$;

create or replace function private.require_open_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return new;
  end if;
  if (select auth.uid()) is not null
     and (exists (select 1 from public.ledger_account a where a.id = new.account_id and a.code in ('venue.cash_drawer', 'venue.bank'))
          or (select t.kind from public.ledger_transaction t where t.id = new.transaction_id) in ('buy_in', 'cash_out', 'marker'))
     and not exists (select 1 from public.cage_shift s where s.venue_id = new.venue_id and s.closed_at is null) then
    raise exception 'The cage has no shift open: open one on Treasury first' using errcode = 'RVNSH';
  end if;
  return new;
end;
$$;

create or replace function private.seat_session_call_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return new;
  end if;
  new.call_time_minutes := coalesce((private.setting_at(new.venue_id, 'call_time.minutes',
    (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = new.table_id),
    new.started_at) ->> 'minutes')::integer, 0);
  return new;
end;
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
  v_parts text;
  v_counts text;
  v_deleted jsonb;
  v_restored jsonb := '{}'::jsonb;
begin
  perform private.assert_practice_reset(p_venue_id);
  if p_venue_name is distinct from (select v.name from public.venue v where v.id = p_venue_id) then
    raise exception 'Type the venue''s name exactly to reset it' using errcode = 'RVNAM';
  end if;
  perform private.assert_writable(p_venue_id, null, null);
  if exists (select 1 from public.audit_log a where a.venue_id = p_venue_id and a.action = 'practice.reset'
             and a.occurred_at > now() - interval '5 minutes') then
    raise exception 'The practice venue was reset a moment ago' using errcode = 'RVRAT';
  end if;

  -- Purge's own way past the append-only and guarded tables, and past what a reload would replay: this
  -- venue, this transaction.
  perform set_config('rivr.purge', 'on', true);
  perform set_config('rivr.purge_venue', p_venue_id::text, true);
  -- One statement deletes every table's rows, a part per table, each counted.
  select string_agg(format('d%s as (delete from public.%I where venue_id = $1 returning 1)', n, t), ', '),
         string_agg(format('(%L, (select count(*) from d%s))', t, n), ', ')
  into v_parts, v_counts
  from (select t, row_number() over (order by t) as n from private.practice_reset_tables() t) tables;
  execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_deleted using p_venue_id;
  -- One statement reloads the seed, each table's columns as the seed holds them, so a column added since
  -- takes its default.
  select string_agg(format('i%s as (insert into public.%I (%s) overriding system value select %s from private.practice_seed s '
                           'cross join lateral jsonb_populate_record(null::public.%I, s.row_data) r '
                           'where s.venue_id = $1 and s.table_name = %L returning 1)', n, t, columns, rcolumns, t, t), ', '),
         string_agg(format('(%L, (select count(*) from i%s))', t, n), ', ')
  into v_parts, v_counts
  from (
    select t, row_number() over (order by t) as n,
           string_agg(format('%I', a.attname), ', ' order by a.attnum) as columns,
           string_agg(format('r.%I', a.attname), ', ' order by a.attnum) as rcolumns
    from private.practice_reset_tables() t
    join pg_attribute a on a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    where exists (select 1 from private.practice_seed s where s.venue_id = p_venue_id and s.table_name = t and s.row_data ? a.attname::text)
    group by t
  ) tables;
  if v_parts is not null then
    execute format('with %s select jsonb_object_agg(k, v) from (values %s) c (k, v)', v_parts, v_counts) into v_restored using p_venue_id;
  end if;
  perform set_config('rivr.purge', 'off', true);
  perform set_config('rivr.purge_venue', '', true);

  if exists (select 1 from public.ledger_entry e where e.venue_id = p_venue_id group by e.transaction_id having sum(e.amount) <> 0) then
    raise exception 'Reset left an unbalanced ledger transaction' using errcode = 'RVRST';
  end if;
  if exists (select 1 from private.practice_reset_preview(p_venue_id) p where p.current_rows <> p.seed_rows) then
    raise exception 'Reset did not bring every table back to its seed' using errcode = 'RVRST';
  end if;
  perform private.audit(p_venue_id, 'practice.reset', 'venue', p_venue_id::text, null,
                        jsonb_build_object('deleted', v_deleted, 'restored', v_restored), 'Reset to seed');

  return query select d.key, (d.value)::text::bigint, coalesce((v_restored ->> d.key)::bigint, 0) from jsonb_each(v_deleted) d order by d.key;
end;
$$;

revoke execute on function private.practice_reset_keeps(), private.practice_reset_tables(), private.purging(uuid), private.capture_practice_seed(uuid),
  private.assert_practice_reset(uuid), private.practice_reset_preview(uuid), private.reset_practice_venue(uuid, text) from public, anon, authenticated;
-- Some triggers run as whoever writes (a member through the API, an Edge Function), so they may ask whether
-- a purge is on; the answer is no but inside one.
grant execute on function private.purging(uuid) to authenticated, service_role;
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
