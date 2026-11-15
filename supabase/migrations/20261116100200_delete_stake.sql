-- A stake no table uses can be deleted (redesign RD-17; owner, 15 Nov). Deleted for good: a stake is kept by the tables
-- that play it, a deleted table's history among them, and by anything else that points at it, so one still pointed at is
-- refused (RVUSE). Its settings stay under its code, which no later stake takes (20261116100000_stake_call_time.sql).

-- Deletes a stake nothing uses. Again, or a stake that is not there, is nothing. Refusals: 42501 not tables.manage,
-- RVFRZ frozen, RVUSE a table or its history still uses it.
create function private.delete_table_type(p_type_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.table_type;
begin
  select * into v_type from public.table_type t where t.id = p_type_id for update;
  if v_type.id is null then
    -- Nothing to delete; still nobody but a tables manager learns that.
    if not exists (select 1 from private.venues_where('tables.manage')) then
      raise exception 'Only the super admin sets up tables' using errcode = '42501';
    end if;
    return;
  end if;
  perform private.assert_tables_manager(v_type.venue_id);
  if exists (select 1 from public.game_table g where g.table_type_id = v_type.id) then
    raise exception 'A table still uses that stake' using errcode = 'RVUSE';
  end if;
  begin
    delete from public.table_type where id = v_type.id;
  exception when foreign_key_violation then
    raise exception 'A table still uses that stake' using errcode = 'RVUSE';
  end;
end;
$$;

create function public.delete_table_type(p_type_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.delete_table_type(p_type_id); $$;

revoke execute on function private.delete_table_type(uuid), public.delete_table_type(uuid) from public, anon;
grant execute on function private.delete_table_type(uuid), public.delete_table_type(uuid) to authenticated;
