-- The venue's logo (#397; decision 0196): a super admin uploads it on Settings, a PNG of up to 1 MB, into the
-- `brand` bucket by venue, and venue_config.logo_path points at it. Invoices (#68), the website and the TVs read
-- it, so the bucket is public: a logo is no secret. Only venue.configure writes it, and only into its own
-- venue's folder. Each upload has a name of its own, so nothing is overwritten and a cached copy of the old logo
-- never stands in for the new one. Making an upload the logo is audited, as is the change of path. PNG only: an
-- SVG can carry script, and the bucket is served from the project's own address.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 1048576, array['image/png']);

-- A logo's name: <venue>/logo-<uuid>.png. The folder is checked before it is read as a venue's id, so any other
-- name is simply refused.
create function private.may_upload_logo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
              then private.has_permission(split_part(p_name, '/', 1)::uuid, 'venue.configure')
              else false end;
$$;
create policy "super admins upload their venue's logo" on storage.objects
  for insert to authenticated with check (bucket_id = 'brand' and (select private.may_upload_logo(name)));

-- venue_config is updated directly by Settings, so the path itself is held to a logo of this venue: never
-- another venue's file, another bucket's, or a path that climbs out of the folder.
alter table public.venue_config add constraint venue_config_logo_is_its_own check (
  logo_path is null
  or logo_path ~ ('^' || venue_id::text || '/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$')
);

-- venue.configure makes an upload the venue's logo, while the venue is not frozen, and the audit log records it:
-- its name, size and type. The change of logo_path is audited as every change of venue configuration is.
-- Refusals: 42501, RVFRZ, 22023 a name that is not a PNG of this venue's logo of up to 1 MB.
create function private.set_venue_logo(p_venue_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_object storage.objects;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'venue.configure') then
    raise exception 'Only super admins set the venue''s logo' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  select * into v_object from storage.objects o where o.bucket_id = 'brand' and o.name = p_path;
  if v_object.id is null or not private.may_upload_logo(p_path) or split_part(p_path, '/', 1) <> p_venue_id::text
     or v_object.metadata ->> 'mimetype' is distinct from 'image/png'
     or coalesce((v_object.metadata ->> 'size')::bigint > 1048576, true) then
    raise exception 'Not a PNG of this venue''s logo of up to 1 MB' using errcode = '22023';
  end if;
  perform private.audit(p_venue_id, 'venue.logo_uploaded', 'storage_object', p_path, null,
                        jsonb_build_object('bytes', (v_object.metadata ->> 'size')::bigint, 'type', v_object.metadata ->> 'mimetype'));
  update public.venue_config set logo_path = p_path where venue_id = p_venue_id;
end;
$$;

create function public.set_venue_logo(p_venue_id uuid, p_path text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_venue_logo(p_venue_id, p_path); $$;

revoke execute on function private.may_upload_logo(text), private.set_venue_logo(uuid, text), public.set_venue_logo(uuid, text)
  from public, anon;
grant execute on function private.may_upload_logo(text), private.set_venue_logo(uuid, text), public.set_venue_logo(uuid, text)
  to authenticated;
