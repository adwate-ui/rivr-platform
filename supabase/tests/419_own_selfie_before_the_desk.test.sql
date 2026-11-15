-- A member sees the photos of themselves that they took, whatever the state of their identity check (decision 0588): the
-- selfie the check points to, or else the selfie they took at sign-up (photo.jpg), which is all there is until the desk has
-- checked them (decision 0502). A photo the desk took is never theirs, in any state of the check (decision 0662). Never
-- another member's, never a PAN or Aadhaar photo, and staff see what they saw before.
-- 202 has a selfie under review; 203 took a selfie for the desk; 204 has a sign-up photo and no check; 210 was verified, then
-- reopened for the desk; 209 has no photo; 201 is verified. Checked in person: 250 refused, 251 under review, 253 refused and
-- reopened. 218 is a member and, here, a host too. 101 is a super admin, 103 an admin (kyc.review), 104 a cashier, 108 a host
-- (kyc.in_person).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Where the club keeps a member's image: <venue>/<member>/<file>.
create function pg_temp.kept(p_member text, p_file text) returns text language sql immutable as $$
  select '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000' || p_member || '/' || p_file;
$$;
grant execute on function pg_temp.kept(text, text) to authenticated;
create function pg_temp.asks(p_member text, p_file text) returns text language sql immutable as $$
  select format('select public.authorize_kyc_image(%L)', pg_temp.kept(p_member, p_file));
$$;
grant execute on function pg_temp.asks(text, text) to authenticated;

-- A cashier of the practice venue only: no member, and no staff of the club. A login that is neither member nor staff. A
-- TV's login. And member 218 made a host of the club as well.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e419', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000009419'),
  ('00000000-0000-4000-8000-00000000f419', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000009420'),
  ('00000000-0000-4000-8000-00000000d419', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000009422');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000e419', 'Practice cashier', 'Cashier', 'cashier', '+919000009419'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000218', 'Host who is a member', 'Host', 'host', '+919000009421');
insert into public.device (venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000d419');

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'needs_review', 'digilocker', '1991-02-02', pg_temp.kept('202', 'selfie.jpg'));
insert into public.kyc_record (venue_id, member_id, at_club_from)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', now());
insert into public.kyc_record (venue_id, member_id, photo_path, at_club_from)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000210', pg_temp.kept('210', 'selfie.jpg'), now());
insert into storage.objects (bucket_id, name) values
  ('kyc', pg_temp.kept('201', 'selfie.jpg')),
  ('kyc', pg_temp.kept('202', 'selfie.jpg')),
  ('kyc', pg_temp.kept('202', 'aadhaar.jpg')),
  ('kyc', pg_temp.kept('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg')),
  ('kyc', pg_temp.kept('202', 'doc-aadhaar-00000000-0000-4000-9000-000000000202.jpg')),
  ('kyc', pg_temp.kept('203', 'photo.jpg')),
  ('kyc', '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000203/photo.jpg'),
  ('kyc', pg_temp.kept('203', 'doc-pan-00000000-0000-4000-9000-000000000203.jpg')),
  ('kyc', pg_temp.kept('204', 'photo.jpg')),
  ('kyc', pg_temp.kept('210', 'selfie.jpg')),
  ('kyc', pg_temp.kept('218', 'photo.jpg'));

-- Checked in person: the photo is the desk's, and every file below is kept.
insert into public.kyc_record (venue_id, member_id, status, method, refusal, photo_path, at_club_from) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000250', 'refused', 'manual', 'duplicate_pan',
   pg_temp.kept('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg'), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000251', 'needs_review', 'manual', null,
   pg_temp.kept('251', 'in-person-00000000-0000-4000-9000-000000000251.jpg'), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000253', 'started', 'manual', null,
   pg_temp.kept('253', 'in-person-00000000-0000-4000-9000-000000000253.jpg'), now());
insert into storage.objects (bucket_id, name) values
  ('kyc', pg_temp.kept('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg')),
  ('kyc', pg_temp.kept('251', 'in-person-00000000-0000-4000-9000-000000000251.jpg')),
  ('kyc', pg_temp.kept('251', 'photo.jpg')),
  ('kyc', pg_temp.kept('253', 'in-person-00000000-0000-4000-9000-000000000253.jpg')),
  ('kyc', pg_temp.kept('253', 'photo.jpg'));

-- The photo a check points to, before it is verified.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select lives_ok(pg_temp.asks('202', 'selfie.jpg'), 'a member whose check is under review may see the photo it points to');
select is(public.my_photo_path(), pg_temp.kept('202', 'selfie.jpg'), 'and is told where it is');
select throws_ok(pg_temp.asks('202', 'aadhaar.jpg'), '42501', null, 'no other image of their own');
select throws_ok(pg_temp.asks('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg'), '42501', null, 'not their own PAN photo');
select throws_ok(pg_temp.asks('202', 'doc-aadhaar-00000000-0000-4000-9000-000000000202.jpg'), '42501', null, 'nor their own Aadhaar photo');
select throws_ok(pg_temp.asks('203', 'doc-pan-00000000-0000-4000-9000-000000000203.jpg'), '42501', null, 'nor another member''s');
select throws_ok(pg_temp.asks('203', 'photo.jpg'), '42501', null, 'nor another member''s sign-up selfie');
select throws_ok(pg_temp.asks('201', 'selfie.jpg'), '42501', null, 'nor a verified member''s selfie');
reset role;
select is((select count(*)::integer from public.audit_log where action = 'kyc_image.view' and actor_user_id = '00000000-0000-4000-8000-000000000202'), 1,
  'the one view allowed is audited, the refused ones not');

-- The selfie taken at sign-up, while the check waits for the desk and points to no photo.
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok(pg_temp.asks('203', 'photo.jpg'), 'a member waiting for the desk may see the selfie they took at sign-up');
select is(public.my_photo_path(), pg_temp.kept('203', 'photo.jpg'), 'and is told where it is');
select throws_ok(pg_temp.asks('203', 'doc-pan-00000000-0000-4000-9000-000000000203.jpg'), '42501', null, 'not their own PAN photo');
select throws_ok(pg_temp.asks('204', 'photo.jpg'), '42501', null, 'nor another member''s sign-up selfie');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'nor another member''s selfie under review');
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000203/photo.jpg') $$,
  '42501', null, 'nor a file under their own id in another venue''s folder');
select lives_ok(format('select public.authorize_kyc_image(%L) from generate_series(1, 9)', pg_temp.kept('203', 'photo.jpg')),
  'they see it ten times in a minute');
select throws_ok(pg_temp.asks('203', 'photo.jpg'), 'RVRAT', null, 'and are refused an eleventh, as a verified member is');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000204');
select lives_ok(pg_temp.asks('204', 'photo.jpg'), 'a member with a sign-up photo and no check may see it');
select is(public.my_photo_path(), pg_temp.kept('204', 'photo.jpg'), 'and is told where it is');
reset role;

-- Verified, then reopened for the desk: the check still points to their selfie.
select pg_temp.as_person('00000000-0000-4000-8000-000000000210');
select lives_ok(pg_temp.asks('210', 'selfie.jpg'), 'a member whose check was reopened may still see the photo it points to');
reset role;
insert into storage.objects (bucket_id, name) values ('kyc', pg_temp.kept('210', 'photo.jpg'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000210');
select is(public.my_photo_path(), pg_temp.kept('210', 'selfie.jpg'), 'the photo the check points to comes before the sign-up selfie');
select lives_ok(pg_temp.asks('210', 'photo.jpg'), 'though the sign-up selfie stays theirs to see');
reset role;

-- No photo at all.
select pg_temp.as_person('00000000-0000-4000-8000-000000000209');
select is(public.my_photo_path(), null, 'a member who never took a selfie is told of none');
select throws_ok(pg_temp.asks('209', 'photo.jpg'), '42501', null, 'and a photo that is not kept is refused');
reset role;

-- 211 is verified (seed) and the photo the check points to is not kept: none is named, so the app asks for none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.my_photo_path(), null, 'a check pointing to a photo that is not kept names none');
reset role;
insert into storage.objects (bucket_id, name) values ('kyc', pg_temp.kept('211', 'photo.jpg'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.my_photo_path(), pg_temp.kept('211', 'photo.jpg'), 'and their sign-up selfie, if that is kept');
reset role;

-- A photo the desk took is staff's, never the member's own (decisions 0583 and 0662): the member does not see it, refused,
-- under review, reopened or verified, and is shown their own sign-up selfie instead, or nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000250');
select throws_ok(pg_temp.asks('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg'), '42501', null,
  'the photo the desk took for a refused check is not its member''s to see');
select is(public.my_photo_path(), null, 'and with no sign-up selfie they are told of no photo');
reset role;
insert into storage.objects (bucket_id, name) values ('kyc', pg_temp.kept('250', 'photo.jpg'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000250');
select is(public.my_photo_path(), pg_temp.kept('250', 'photo.jpg'), 'with one, they are told of their sign-up selfie');
select lives_ok(pg_temp.asks('250', 'photo.jpg'), 'which they may see');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000251');
select throws_ok(pg_temp.asks('251', 'in-person-00000000-0000-4000-9000-000000000251.jpg'), '42501', null,
  'nor is the desk''s photo for a check under review');
select is(public.my_photo_path(), pg_temp.kept('251', 'photo.jpg'), 'they are told of their sign-up selfie');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000253');
select throws_ok(pg_temp.asks('253', 'in-person-00000000-0000-4000-9000-000000000253.jpg'), '42501', null,
  'nor the desk''s photo for a check reopened for the desk');
select is(public.my_photo_path(), pg_temp.kept('253', 'photo.jpg'), 'they are told of their sign-up selfie');
select lives_ok(pg_temp.asks('253', 'photo.jpg'), 'which they may see');
reset role;
-- Verified, the desk's photo is still not the member's (the owner, 15 Nov night): their own selfie is, or their initial.
update public.kyc_record set status = 'verified', verified_at = now(), date_of_birth = '1992-05-01' where member_id = '00000000-0000-4000-8000-000000000251';
select pg_temp.as_person('00000000-0000-4000-8000-000000000251');
select throws_ok(pg_temp.asks('251', 'in-person-00000000-0000-4000-9000-000000000251.jpg'), '42501', null,
  'nor the desk''s photo once the check is verified');
select is(public.my_photo_path(), pg_temp.kept('251', 'photo.jpg'), 'they are still told of their sign-up selfie');
reset role;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, verified_at, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000209', 'verified', 'manual', '1990-03-01', now(),
        pg_temp.kept('209', 'in-person-00000000-0000-4000-9000-000000000209.jpg'));
insert into storage.objects (bucket_id, name) values ('kyc', pg_temp.kept('209', 'in-person-00000000-0000-4000-9000-000000000209.jpg'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000209');
select throws_ok(pg_temp.asks('209', 'in-person-00000000-0000-4000-9000-000000000209.jpg'), '42501', null,
  'a verified member whose one photo is the desk''s may not see it');
select is(public.my_photo_path(), null, 'and is told of none, so the app shows their initial');
reset role;

-- The photo a check points to is only ever in the member's own folder: their selfie, or the desk's photo for them.
select throws_ok(format($$ update public.kyc_record set photo_path = %L where member_id = '00000000-0000-4000-8000-000000000202' $$,
                        pg_temp.kept('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg')), '23514', null, 'a check cannot point to a PAN photo');
select throws_ok(format($$ update public.kyc_record set photo_path = %L where member_id = '00000000-0000-4000-8000-000000000202' $$,
                        pg_temp.kept('203', 'selfie.jpg')), '23514', null, 'nor to another member''s selfie');

-- Staff, as before (009, 248, 317, 403).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok(pg_temp.asks('202', 'selfie.jpg'), 'a KYC reviewer still sees a selfie under review');
select lives_ok(pg_temp.asks('203', 'photo.jpg'), 'and a sign-up selfie');
select throws_ok(pg_temp.asks('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg'), '42501', null, 'but still no PAN photo');
select is(public.my_photo_path(), null, 'staff who are not members have no photo of their own');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok(pg_temp.asks('202', 'selfie.jpg'), 'the cage still sees a selfie');
select throws_ok(pg_temp.asks('202', 'doc-aadhaar-00000000-0000-4000-9000-000000000202.jpg'), '42501', null, 'and still no Aadhaar photo');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok(pg_temp.asks('203', 'photo.jpg'), 'a host still sees the selfie a member took for the desk');
select lives_ok(pg_temp.asks('210', 'selfie.jpg'), 'and the selfie of a member reopened for the desk');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'but still no other KYC image');
select throws_ok(pg_temp.asks('201', 'selfie.jpg'), '42501', null, 'nor a verified member''s selfie');
select throws_ok(pg_temp.asks('203', 'doc-pan-00000000-0000-4000-9000-000000000203.jpg'), '42501', null, 'nor a PAN photo');
select lives_ok(pg_temp.asks('253', 'in-person-00000000-0000-4000-9000-000000000253.jpg'), 'a host still sees the desk''s photo of a check reopened for the desk');
select throws_ok(pg_temp.asks('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg'), '42501', null, 'and still not a refused check''s');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok(pg_temp.asks('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg'), 'a KYC reviewer still sees the desk''s photo for a refused check');
reset role;
-- A login that is a host and a member: each way in gives what it gave, and no more together.
select pg_temp.as_person('00000000-0000-4000-8000-000000000218');
select lives_ok(pg_temp.asks('218', 'photo.jpg'), 'a host who is a member sees their own sign-up selfie');
select is(public.my_photo_path(), pg_temp.kept('218', 'photo.jpg'), 'and is told where it is');
select lives_ok(pg_temp.asks('203', 'photo.jpg'), 'as a host, still a sign-up selfie taken for the desk');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'but being a member opens no other member''s selfie');
select throws_ok(pg_temp.asks('201', 'selfie.jpg'), '42501', null, 'nor a verified member''s');
select throws_ok(pg_temp.asks('250', 'in-person-00000000-0000-4000-9000-000000000250.jpg'), '42501', null, 'nor the desk''s photo for a refused check');
select throws_ok(pg_temp.asks('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg'), '42501', null, 'nor a PAN photo');
reset role;
-- A TV's login is no member and no staff.
select pg_temp.as_person('00000000-0000-4000-8000-00000000d419');
select throws_ok(pg_temp.asks('203', 'photo.jpg'), '42501', null, 'a device sees no sign-up selfie');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'nor a selfie under review');
select throws_ok(pg_temp.asks('251', 'in-person-00000000-0000-4000-9000-000000000251.jpg'), '42501', null, 'nor a verified member''s photo');
select is(public.my_photo_path(), null, 'and has no photo of its own');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok(pg_temp.asks('202', 'doc-pan-00000000-0000-4000-9000-000000000202.jpg'), 'a super admin still opens a PAN photo');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e419');
select throws_ok(pg_temp.asks('203', 'photo.jpg'), '42501', null, 'staff of another venue, no member here, still see no sign-up selfie');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'nor a selfie under review');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-00000000f419');
select throws_ok(pg_temp.asks('203', 'photo.jpg'), '42501', null, 'a login that is neither member nor staff sees no sign-up selfie');
select throws_ok(pg_temp.asks('202', 'selfie.jpg'), '42501', null, 'nor a selfie under review');
select is(public.my_photo_path(), null, 'and has no photo of their own');
reset role;

-- An erased member's login is no longer theirs: the file, were it still kept, stays closed.
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000204';
select pg_temp.as_person('00000000-0000-4000-8000-000000000204');
select throws_ok(pg_temp.asks('204', 'photo.jpg'), '42501', null, 'an erased member''s old login sees no photo');
select is(public.my_photo_path(), null, 'and is told of none');
reset role;

set local role anon;
select throws_ok($$ select public.authorize_kyc_image('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/photo.jpg') $$,
  '42501', null, 'the public still cannot ask for an image');
select throws_ok($$ select public.my_photo_path() $$, '42501', null, 'nor where a photo is');
reset role;

select * from finish();
rollback;
