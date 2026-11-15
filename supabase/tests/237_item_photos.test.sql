-- Photos on menu items (AS-11). 103 Aditya, an admin, keeps the menu (fnb.manage); 107 Ishita, in marketing, does not; 213 Mihir
-- is a member. The menu's keeper uploads into the venue's folder of the public item-photos bucket under a menu item's name,
-- then makes it the item's photo; nobody points an item at another venue's file. Rewards had photos too, until they went.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table fixture as
select (select f.id from public.fnb_item f where f.venue_id = '00000000-0000-4000-8000-000000000001' order by f.name limit 1) as dish,
       '00000000-0000-4000-8000-000000000103'::text as bar,
       '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5012.jpg'::text as dish_photo;
grant select on fixture to authenticated;
select ok((select dish is not null and bar is not null from fixture), 'a dish, and staff who keep the menu');

select results_eq($$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'item-photos' $$,
  $$ values (true, 1048576::bigint, array['image/jpeg']) $$, 'the bucket is public and takes a JPEG of up to 1 MB');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('item-photos', (select dish_photo from fixture), '00000000-0000-4000-8000-000000000107') $$,
  '42501', null, 'staff without the menu upload no photo');
reset role;

select pg_temp.as_person((select bar from fixture));
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id, metadata)
                   values ('item-photos', (select dish_photo from fixture), (select bar from fixture)::uuid, '{"size": 4096, "mimetype": "image/jpeg"}') $$,
  'the menu''s keeper uploads a dish''s photo');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('item-photos', '00000000-0000-4000-8000-000000000001/reward-00000000-0000-4000-8000-0000000a5011.jpg', (select bar from fixture)::uuid) $$,
  '42501', null, 'but nothing under a reward''s name: only a menu item has a photo');
select throws_ok($$ select public.set_item_photo('menu', (select dish from fixture), '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5019.jpg') $$,
  '22023', null, 'a photo never uploaded is refused');
select lives_ok($$ select public.set_item_photo('menu', (select dish from fixture), (select dish_photo from fixture)) $$,
  'and makes the upload the dish''s photo');
select is((select m.photo_path from public.fnb_menu('00000000-0000-4000-8000-000000000001') m join fixture f on f.dish = m.item_id),
  (select dish_photo from fixture), 'which the menu gives with the dish');
select throws_ok($$ select public.set_item_photo('reward', (select dish from fixture), (select dish_photo from fixture)) $$,
  '22023', null, 'a kind that is not a menu item is refused');
reset role;
select ok(exists (select 1 from public.audit_log a where a.action = 'item.photo_uploaded' and a.entity = 'fnb_item'
                  and a.after ->> 'bytes' = '4096'), 'and the audit log records the upload');

-- An upload whose stored type is not a JPEG, whatever its name, is never made a photo.
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('item-photos', '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5013.jpg', '00000000-0000-4000-8000-000000000103', '{"size": 4096, "mimetype": "image/png"}');
select pg_temp.as_person((select bar from fixture));
select throws_ok($$ select public.set_item_photo('menu', (select dish from fixture), '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5013.jpg') $$,
  '22023', null, 'a file stored as anything but a JPEG is refused');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('item-photos', '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5014.jpg', '00000000-0000-4000-8000-000000000213') $$,
  '42501', null, 'a member uploads nothing');
reset role;

-- Elsewhere, a venue made here with its own admin (fnb.manage there, nothing at the club).
-- Made as the system, as in 221: no one signed in.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Admin', 'admin');

-- Another venue's staff, who keep the menu there, upload nothing into the club's folder.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('item-photos', '00000000-0000-4000-8000-000000000001/menu-00000000-0000-4000-8000-0000000a5015.jpg', '00000000-0000-4000-8000-0000000000e2') $$,
  '42501', null, 'staff of another venue upload nothing into the club''s folder');
select throws_ok($$ select public.set_item_photo('menu', (select dish from fixture), (select dish_photo from fixture)) $$,
  '42501', null, 'and make nothing the photo of the club''s dish');
reset role;

select throws_ok($$ update public.fnb_item set photo_path = '00000000-0000-4000-8000-000000000002/menu-00000000-0000-4000-8000-0000000a5012.jpg'
                    where id = (select dish from fixture) $$,
  '23514', null, 'and no dish points at another venue''s photo');

select * from finish();
rollback;
