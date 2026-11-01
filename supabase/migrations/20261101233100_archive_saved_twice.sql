-- An archive's file recorded twice is recorded once (audit F1-27, 1 Nov). The console records a full archive once the
-- browser has saved its file; when that answer was lost, Record again sent the same SHA-256 and size and was refused, as
-- the archive was already complete, so the screen kept saying no purge could follow it. A second call for the same file
-- now finds it recorded and changes nothing; another file is refused as before.
-- As 20261028330000_purge_live_venue.sql, with that first check.

create or replace function private.complete_export_archive(p_archive_id uuid, p_sha256 text, p_bytes bigint, p_unread text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive private.export_archive;
begin
  if exists (select 1 from private.export_archive a
             where a.id = p_archive_id and a.started_by = (select auth.uid()) and a.member_id is null and a.completed_at is not null
               and a.file_sha256 = p_sha256 and a.file_bytes = p_bytes) then
    return;
  end if;
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
