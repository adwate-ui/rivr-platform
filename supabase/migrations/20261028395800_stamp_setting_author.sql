-- Settings' history says who set each value (#604). The console never sent the author, and the column took whatever a
-- caller gave it, so an admin could have named a colleague. Someone signed in is now always the author, whatever the
-- request says, and an id from another venue never reaches the foreign key. The database itself (a migration, the seed,
-- a practice reset) has no one signed in and keeps what it writes.
create function private.stamp_setting_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_by_staff_id := private.current_staff_id(new.venue_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.stamp_setting_author() from public, anon, authenticated;

create trigger setting_author before insert on public.setting
  for each row execute function private.stamp_setting_author();
