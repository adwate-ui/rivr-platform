-- A purge takes two super admins (audit of 28 Oct, A4-13). Purging the live venue was one super admin's alone: freeze,
-- archive, type the name, purge. Now one super admin asks, with a reason, and another carries it out within a day, as
-- releasing a freeze takes two. The ask holds for a day within the freeze it was made in; one person with a second
-- login they made is not two. The ask is kept through the purge it allowed.

-- A purge asked for by one super admin, to be carried out by another.
create table public.purge_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  asked_by_staff_id uuid not null,
  reason text not null check (length(btrim(reason)) between 10 and 500),
  asked_at timestamptz not null default now(),
  carried_out_by_staff_id uuid,
  carried_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((carried_out_at is null) = (carried_out_by_staff_id is null)),
  check (carried_out_by_staff_id is distinct from asked_by_staff_id),
  foreign key (asked_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (carried_out_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.purge_request is 'A live purge one super admin asked for, which another carries out (A4-13).';

create index purge_request_venue_idx on public.purge_request (venue_id, asked_at desc);
alter table public.purge_request enable row level security;
create policy "super admins who purge see the asks" on public.purge_request for select to authenticated
  using (venue_id in (select private.venues_where('purge.run')));
grant select on public.purge_request to authenticated;
create trigger purge_request_touch_updated_at before update on public.purge_request
  for each row execute function private.touch_updated_at();
create trigger purge_request_audit after insert or update on public.purge_request
  for each row execute function private.audit_row_change();

-- Asks for the purge of a frozen live venue, with the reason: one open ask at a time, for a day. An ask still open is
-- given back. Tells the owner (purge.asked). Refusals as assert_live_purge; 22023 a reason under 10 characters.
create function private.ask_live_purge(p_venue_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_live_purge(p_venue_id);
  if length(btrim(coalesce(p_reason, ''))) not between 10 and 500 then
    raise exception 'Say why, in 10 to 500 characters' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('purge_request:' || p_venue_id::text, 0));
  select r.id into v_id from public.purge_request r
  where r.venue_id = p_venue_id and r.carried_out_at is null and r.asked_at > now() - interval '24 hours'
    and r.asked_at >= (select max(c.engaged_at) from public.control_state c
                       where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null)
  order by r.asked_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.purge_request (venue_id, asked_by_staff_id, reason)
  values (p_venue_id, private.current_staff_id(p_venue_id), btrim(p_reason))
  returning id into v_id;
  perform private.raise_alert(p_venue_id, 'purge.asked', jsonb_build_object('request_id', v_id, 'staff_id', private.current_staff_id(p_venue_id)));
  return v_id;
end;
$$;

-- The ask still open at a venue, for super admins who purge: who asked, why and when, and whether it was the caller.
create function private.open_purge_request(p_venue_id uuid)
returns table (request_id uuid, asked_by text, reason text, asked_at timestamptz, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, s.full_name, r.reason, r.asked_at, r.asked_by_staff_id = private.current_staff_id(p_venue_id)
  from public.purge_request r join public.staff s on s.id = r.asked_by_staff_id
  where r.venue_id = p_venue_id and r.carried_out_at is null and r.asked_at > now() - interval '24 hours'
    and coalesce(private.has_permission(p_venue_id, 'purge.run'), false)
    and r.asked_at >= (select max(c.engaged_at) from public.control_state c
                       where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null)
  order by r.asked_at desc limit 1;
$$;

revoke execute on function private.ask_live_purge(uuid, text), private.open_purge_request(uuid) from public, anon;
grant execute on function private.ask_live_purge(uuid, text), private.open_purge_request(uuid) to authenticated;

create function public.ask_live_purge(p_venue_id uuid, p_reason text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ask_live_purge(p_venue_id, p_reason); $$;
create function public.open_purge_request(p_venue_id uuid)
returns table (request_id uuid, asked_by text, reason text, asked_at timestamptz, is_mine boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.open_purge_request(p_venue_id); $$;
revoke execute on function public.ask_live_purge(uuid, text), public.open_purge_request(uuid) from public, anon;
grant execute on function public.ask_live_purge(uuid, text), public.open_purge_request(uuid) to authenticated;

-- As 20261028391600_fnb_items.sql made it, with the ask kept through the purge; and as 20261028330000_purge_live_venue.sql
-- made it, the purge carried out only by a second super admin.
create or replace function private.live_purge_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['blind_structure', 'expense_category', 'fnb_item', 'league_season', 'payment_account', 'reward_item', 'shareholder',
               'shareholding', 'tally_ledger_map', 'tournament_template', 'purge_request'];
$$;

create or replace function private.purge_live_venue(p_venue_id uuid, p_venue_name text)
returns table (table_name text, deleted_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive private.export_archive;
  v_request public.purge_request;
  v_table text;
  v_changed text[];
  v_members text[];
  v_parts text;
  v_counts text;
  v_deleted jsonb;
begin
  perform private.assert_live_purge(p_venue_id);
  if p_venue_name is distinct from (select v.name from public.venue v where v.id = p_venue_id) then
    raise exception 'Type the venue''s name exactly to purge it' using errcode = 'RVNAM';
  end if;
  -- Two super admins (A4-13): another asked for the purge since the freeze, within the last day, and is still an active
  -- super admin; and neither made or changed the other's staff row, so one person with a second login is not two.
  select * into v_request from public.purge_request r
  where r.venue_id = p_venue_id and r.carried_out_at is null and r.asked_at > now() - interval '24 hours'
    and r.asked_at >= (select max(c.engaged_at) from public.control_state c
                       where c.venue_id = p_venue_id and c.level = 'venue_freeze' and c.released_at is null)
  order by r.asked_at desc limit 1 for update;
  if v_request.id is null or v_request.asked_by_staff_id = private.current_staff_id(p_venue_id)
     or not exists (select 1 from public.staff s where s.id = v_request.asked_by_staff_id and s.is_active and s.role = 'super_admin')
     or exists (select 1 from public.audit_log l
                where l.venue_id = p_venue_id and l.entity = 'staff'
                  and ((l.entity_id = private.current_staff_id(p_venue_id)::text
                        and l.actor_user_id = (select s.user_id from public.staff s where s.id = v_request.asked_by_staff_id))
                    or (l.entity_id = v_request.asked_by_staff_id::text and l.actor_user_id = (select auth.uid())))) then
    raise exception 'Another super admin carries out a purge one asked for since the freeze' using errcode = 'RVTWO';
  end if;
  update public.purge_request set carried_out_at = now(), carried_out_by_staff_id = private.current_staff_id(p_venue_id)
  where id = v_request.id;
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
  v_changed := array(select t from private.live_purge_tables() t
                     where t <> all(private.live_purge_logs())
                       and (coalesce((v_archive.counts ->> t)::bigint, -1) <> private.venue_row_count(p_venue_id, t)
                            or private.venue_changed_since(p_venue_id, t, v_archive.started_at))
                     order by t);
  if cardinality(v_changed) > 0 then
    raise exception 'The venue changed since the archive: make it again'
      using errcode = 'RVCHG', detail = 'Changed: ' || array_to_string(v_changed, ', ');
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

