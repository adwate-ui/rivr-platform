-- The nightly backup's own role (#25, decision 0072). It reads everything a backup needs (every table,
-- past row-level security) and can change nothing. So the database URL the backup's environment holds
-- can't write to the database or alter it, whatever a change merged to main does with it. It can't sign
-- in until the owner gives it a password on each project (docs/runbooks/backups-and-restore.md). Roles
-- belong to the whole cluster, so this runs only where the role isn't there yet.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rivr_backup') then
    create role rivr_backup nologin bypassrls;
  end if;
end;
$$;

grant pg_read_all_data to rivr_backup;
