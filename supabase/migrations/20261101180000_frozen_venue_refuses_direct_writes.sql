-- A frozen venue refuses direct writes (audit of 28 Oct, A4-03). During a venue freeze, a direct write through the API
-- to staff, members (but a member insert, as sign-up was accepted in #495), settings, tiers, the tier matrix, the
-- venue's configuration, chip denominations or contacts is refused, unless the caller holds venue.configure, so a super
-- admin keeps A4-05's way out. A row is not moved out of a frozen venue either. A manager may still turn a login off
-- (decision 0073). Functions the database runs check the freeze themselves. Devices already check it
-- (guard_device); incidents stay open; tables and table types take no direct writes (#642).

-- A venue's freeze, for a direct write there by someone without venue.configure.
create function private.refuse_frozen_write_at(p_venue_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'venue.configure'), false) then
    perform private.assert_writable(p_venue_id);
  end if;
end;
$$;

create function private.refuse_frozen_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only a direct write through the API, as the signed-in role: inside a function the database runs, the role is its owner.
  if current_user <> 'authenticated' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- A manager may still turn a login off during a freeze (decision 0073): a staff row changed only to inactive.
  if tg_table_name = 'staff' and tg_op = 'UPDATE' then
    if old.is_active and not new.is_active
       and (to_jsonb(new) - 'is_active' - 'updated_at') = (to_jsonb(old) - 'is_active' - 'updated_at') then
      return new;
    end if;
  end if;
  -- The venue a row leaves, and the one it comes to: a row is never moved out of, or into, a frozen venue.
  if tg_op <> 'INSERT' then
    perform private.refuse_frozen_write_at(old.venue_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.venue_id is distinct from old.venue_id) then
    perform private.refuse_frozen_write_at(new.venue_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger refuse_frozen_write before insert or update or delete on public.staff for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before update or delete on public.member for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.setting for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.tier for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.tier_feature for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.venue_config for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.chip_denomination for each row execute function private.refuse_frozen_write();
create trigger refuse_frozen_write before insert or update or delete on public.contact for each row execute function private.refuse_frozen_write();

revoke execute on function private.refuse_frozen_write(), private.refuse_frozen_write_at(uuid) from public, anon;
grant execute on function private.refuse_frozen_write_at(uuid) to authenticated;
