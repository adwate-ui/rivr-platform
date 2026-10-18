-- The audit log: every privileged action and every change to configuration, with actor,
-- device, IP and before/after state (scope-v1, "Architecture"). Append-only: nothing updates
-- or deletes it, purge included (features-2026-10-14.md, "Purge").

create table public.audit_log (
  id bigint generated always as identity primary key,
  venue_id uuid not null references public.venue (id),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  device_id uuid,
  ip inet,
  -- 'insert' | 'update' | 'delete' for row changes, or a named action such as 'export.table'.
  action text not null check (length(action) > 0),
  entity text not null check (length(entity) > 0),
  entity_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_log_venue_occurred_idx on public.audit_log (venue_id, occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create function private.refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.refuse_change();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.refuse_change();

-- Records one action. Write functions call it in the same transaction as the change.
-- The reason comes from p_reason, or from `set_config('rivr.audit_reason', ..., true)`.
create function private.audit(
  p_venue_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (venue_id, actor_user_id, device_id, ip, action, entity, entity_id, before, after, reason)
  values (
    p_venue_id, (select auth.uid()), private.request_device_id(), private.request_ip(),
    p_action, p_entity, p_entity_id, p_before, p_after,
    coalesce(p_reason, nullif(current_setting('rivr.audit_reason', true), ''))
  );
$$;

-- Columns never copied into the audit log.
create function private.redact(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select p_row - array['pin_hash', 'encrypted_password'];
$$;

-- Trigger for audited tables: one audit row per inserted, updated or deleted row.
-- The trigger argument names the column holding the venue id (default 'venue_id').
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  venue_column text := coalesce(tg_argv[0], 'venue_id');
  old_row jsonb := case when tg_op <> 'INSERT' then private.redact(to_jsonb(old)) end;
  new_row jsonb := case when tg_op <> 'DELETE' then private.redact(to_jsonb(new)) end;
  changed jsonb := coalesce(new_row, old_row);
begin
  perform private.audit(
    (changed ->> venue_column)::uuid, lower(tg_op), tg_table_name,
    coalesce(changed ->> 'id', changed ->> 'staff_id', changed ->> 'key'), old_row, new_row
  );
  return null;
end;
$$;

grant execute on function private.audit(uuid, text, text, text, jsonb, jsonb, text) to service_role;

create trigger venue_audit after insert or update or delete on public.venue
  for each row execute function private.audit_row_change('id');
create trigger staff_audit after insert or update or delete on public.staff
  for each row execute function private.audit_row_change();
create trigger staff_credential_audit after insert or update or delete on public.staff_credential
  for each row execute function private.audit_row_change();
create trigger device_audit after insert or update or delete on public.device
  for each row execute function private.audit_row_change();

alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;

create policy "auditors read their venue's log" on public.audit_log
  for select to authenticated
  using (venue_id in (select private.venues_where('audit.read')));
