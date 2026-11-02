-- Photos on rewards and menu items (UI polish audit AS-11; the owner, 2 Nov, approved the plan). A reward or a dish shows
-- the club's own photograph in the app in a 4:3 tile, and a tile with its initial until one is added; never stock
-- (ui.md). Staff who keep the catalogue (rewards.manage) or the menu (fnb.manage) upload one on the console: a JPEG the
-- console makes from their photo, up to 1 MB, into the public `item-photos` bucket by venue, each under a name of its own
-- as the venue's logo is (20261027000300_venue_logo.sql), so a cached copy of the old photo never stands in for the new
-- one; then the database makes it the item's photo. JPEG only: the console makes every photo one, and an SVG can carry
-- script. Like the logo, a purge leaves these public product photos: they name no member.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 1048576, array['image/jpeg']);

-- A photo's name: <venue>/<reward|menu>-<uuid>.jpg, by staff who keep that venue's catalogue or menu. The name is checked
-- before it is read as a venue's id, so any other name is simply refused.
create function private.may_upload_item_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(reward|menu)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
              then private.has_permission(split_part(p_name, '/', 1)::uuid,
                     case when split_part(p_name, '/', 2) like 'reward-%' then 'rewards.manage' else 'fnb.manage' end)
              else false end;
$$;
create policy "catalogue and menu staff upload their venue's item photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'item-photos' and (select private.may_upload_item_photo(name)));

-- The photo an item shows, held to a photo of this venue's of its own kind: never another venue's file, another bucket's,
-- or a path that climbs out of the folder.
alter table public.reward_item add column photo_path text,
  add constraint reward_item_photo_is_its_own check (
    photo_path is null
    or photo_path ~ ('^' || venue_id::text || '/reward-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'));
alter table public.fnb_item add column photo_path text,
  add constraint fnb_item_photo_is_its_own check (
    photo_path is null
    or photo_path ~ ('^' || venue_id::text || '/menu-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'));
grant select (photo_path) on public.fnb_item to authenticated;

-- Makes an upload the photo of a reward (`reward`, rewards.manage) or a menu item (`menu`, fnb.manage), while the venue is
-- not frozen. The audit log records the file's name, size and type; the item's change is audited as every change of it is.
-- Refusals: 42501 not allowed or no such item, 22023 a kind not reward or menu, or a name that is not a JPEG of up to 1 MB
-- among this venue's photos of that kind; RVFRZ the venue frozen.
create function private.set_item_photo(p_kind text, p_item_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_object storage.objects;
begin
  if p_kind is distinct from 'reward' and p_kind is distinct from 'menu' then
    raise exception 'A photo is of a reward or a menu item' using errcode = '22023';
  end if;
  v_venue_id := case p_kind when 'reward' then (select r.venue_id from public.reward_item r where r.id = p_item_id)
                            else (select f.venue_id from public.fnb_item f where f.id = p_item_id) end;
  if v_venue_id is null or not private.has_permission(v_venue_id, case p_kind when 'reward' then 'rewards.manage' else 'fnb.manage' end) then
    raise exception 'Only staff who keep the catalogue or the menu set its photos' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  select * into v_object from storage.objects o where o.bucket_id = 'item-photos' and o.name = p_path;
  if v_object.id is null or not private.may_upload_item_photo(p_path) or split_part(p_path, '/', 1) <> v_venue_id::text
     or split_part(p_path, '/', 2) not like p_kind || '-%'
     or v_object.metadata ->> 'mimetype' is distinct from 'image/jpeg'
     or coalesce((v_object.metadata ->> 'size')::bigint > 1048576, true) then
    raise exception 'Not a JPEG of this venue''s item photos of up to 1 MB' using errcode = '22023';
  end if;
  perform private.audit(v_venue_id, 'item.photo_uploaded', case p_kind when 'reward' then 'reward_item' else 'fnb_item' end, p_item_id::text, null,
                        jsonb_build_object('path', p_path, 'bytes', (v_object.metadata ->> 'size')::bigint, 'type', v_object.metadata ->> 'mimetype'));
  if p_kind = 'reward' then
    update public.reward_item set photo_path = p_path where id = p_item_id;
  else
    update public.fnb_item set photo_path = p_path where id = p_item_id;
  end if;
end;
$$;

create function public.set_item_photo(p_kind text, p_item_id uuid, p_path text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_item_photo(p_kind, p_item_id, p_path); $$;

-- The menu, as before (20261028391600_fnb_items.sql), with each item's photo.
drop function public.my_fnb_menu();
drop function private.my_fnb_menu();
drop function public.fnb_menu(uuid);
drop function private.fnb_menu(uuid);

create function private.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  with asker as (
    select private.current_member_id() as member_id,
           exists (select 1 from public.staff s where s.id = private.current_staff_id(p_venue_id)) as is_staff,
           exists (select 1 from public.device d where d.id = private.current_device_id() and d.venue_id = p_venue_id
                   and d.kind = 'dealer_tablet' and d.revoked_at is null) as is_tablet
  )
  select i.id, i.name, i.kind, i.photo_path
  from public.fnb_item i cross join asker a
  where i.venue_id = p_venue_id and i.is_available
    and (a.is_staff or a.is_tablet
         or (exists (select 1 from public.member m where m.id = a.member_id and m.venue_id = p_venue_id)
             and private.has_feature(a.member_id, 'fnb.table_side')
             and (i.kind <> 'alcohol' or private.may_order_alcohol(a.member_id))))
  order by i.position, i.name;
$$;

-- The signed-in member's menu, at their own venue, for the player app.
create function private.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$ select * from private.fnb_menu((select m.venue_id from public.member m where m.id = private.current_member_id())); $$;

create function public.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_menu(p_venue_id); $$;
create function public.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind, photo_path text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_menu(); $$;

revoke execute on function private.may_upload_item_photo(text), private.set_item_photo(text, uuid, text), public.set_item_photo(text, uuid, text),
  private.fnb_menu(uuid), public.fnb_menu(uuid), private.my_fnb_menu(), public.my_fnb_menu() from public, anon;
grant execute on function private.may_upload_item_photo(text), private.set_item_photo(text, uuid, text), public.set_item_photo(text, uuid, text),
  private.fnb_menu(uuid), public.fnb_menu(uuid), private.my_fnb_menu(), public.my_fnb_menu() to authenticated;
