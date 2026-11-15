-- The member record's photo (issue 980). A member who registered by selfie while the club checks identity at the desk has
-- their selfie as the sign-up photo, <venue>/<member>/photo.jpg, and no photo on the check yet: the record shows that
-- photo. A check with a photo of its own still shows its own. Aditya (103, an admin) reads the records; a dealer (106) none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A member waiting for the desk, with no photo on the check and none stored; and one whose check has its own photo.
create temporary table waiting as
select m.id, m.venue_id, m.venue_id || '/' || m.id || '/photo.jpg' as sign_up_photo
from public.member m left join public.kyc_record k on k.member_id = m.id
where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.erased_at is null and (k.id is null or k.photo_path is null)
  and not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
order by m.member_number limit 1;
create temporary table checked as
select m.id, m.venue_id, k.photo_path, m.venue_id || '/' || m.id || '/photo.jpg' as sign_up_photo
from public.member m join public.kyc_record k on k.member_id = m.id
where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.erased_at is null and k.photo_path is not null
order by m.member_number limit 1;
grant select on waiting, checked to authenticated;

select is((select count(*) from waiting), 1::bigint, 'the seed has a member with no photo on their check');
select is((select count(*) from checked), 1::bigint, 'and one whose check has a photo');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select photo_path from public.member_record((select venue_id from waiting), (select id from waiting))), null,
          'no photo stored: the record has none');
reset role;

insert into storage.objects (bucket_id, name) select 'kyc', sign_up_photo from waiting;
insert into storage.objects (bucket_id, name) select 'kyc', sign_up_photo from checked
where not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = (select sign_up_photo from checked));

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select photo_path from public.member_record((select venue_id from waiting), (select id from waiting))),
          (select sign_up_photo from waiting), 'the sign-up photo stored: the record shows it');
select is((select photo_path from public.member_record((select venue_id from checked), (select id from checked))),
          (select photo_path from checked), 'a check with a photo of its own still shows its own');
reset role;

-- A dealer (106) reads no member record, photo or not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_record((select venue_id from waiting), (select id from waiting)) $$,
                'a dealer gets no record');
reset role;

select * from finish();
rollback;
