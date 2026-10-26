-- The venue's logo (#397; decision 0196). 101 Vikram is a super admin (venue.configure); 103 is an admin. A
-- super admin uploads a logo into the brand bucket, in the venue's folder only, and makes it the venue's logo:
-- both are audited. An admin can do neither, and nobody points the venue's logo anywhere else. The bucket takes a
-- PNG of up to 1 MB, and anyone reads it.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select results_eq($$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'brand' $$,
  $$ values (true, 1048576::bigint, array['image/png']) $$,
  'the brand bucket is public and takes a PNG of up to 1 MB');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id, metadata)
                   values ('brand', '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b0397.png',
                           '00000000-0000-4000-8000-000000000101', '{"size": 20480, "mimetype": "image/png"}') $$,
  'a super admin uploads the venue''s logo');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('brand', '00000000-0000-4000-8000-0000000007a1/logo-00000000-0000-4000-8000-0000000b0398.png',
                            '00000000-0000-4000-8000-000000000101') $$,
  '42501', null, 'into their own venue''s folder only');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('brand', '00000000-0000-4000-8000-000000000001/anything.png', '00000000-0000-4000-8000-000000000101') $$,
  '42501', null, 'and under a logo''s name');
select throws_ok($$ select public.set_venue_logo('00000000-0000-4000-8000-000000000001',
                      '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b0399.png') $$,
  '22023', null, 'a logo never uploaded is refused');
select lives_ok($$ select public.set_venue_logo('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b0397.png') $$,
  'and makes the upload the venue''s logo');
reset role;

select is((select logo_path from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b0397.png', 'venue configuration points at it');
select results_eq(
  $$ select action, after ->> 'bytes', after ->> 'type' from public.audit_log
     where venue_id = '00000000-0000-4000-8000-000000000001' and action = 'venue.logo_uploaded' $$,
  $$ values ('venue.logo_uploaded'::text, '20480'::text, 'image/png'::text) $$, 'the audit log records the upload');
select ok(exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-000000000001' and entity = 'venue_config'
                  and after ->> 'logo_path' like '%logo-00000000-0000-4000-8000-0000000b0397.png'),
  'and the change of path');

-- Settings updates venue configuration directly, so the path itself can only name this venue's logo.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ update public.venue_config
                    set logo_path = '00000000-0000-4000-8000-000000000002/logo-00000000-0000-4000-8000-0000000b0397.png'
                    where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'a super admin points the logo at no other venue''s file');
select throws_ok($$ update public.venue_config set logo_path = '../kyc/anything.jpg'
                    where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'nor out of the folder');
-- An upload whose stored type is not a PNG, whatever its name, is never made the logo.
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id, metadata)
                   values ('brand', '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b039b.png',
                           '00000000-0000-4000-8000-000000000101', '{"size": 2048, "mimetype": "image/svg+xml"}') $$,
  'an object named .png reaches the bucket');
select throws_ok($$ select public.set_venue_logo('00000000-0000-4000-8000-000000000001',
                      '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b039b.png') $$,
  '22023', null, 'but one stored as an SVG is not made the logo');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
                    values ('brand', '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b039a.png',
                            '00000000-0000-4000-8000-000000000103') $$,
  '42501', null, 'an admin uploads no logo');
select throws_ok($$ select public.set_venue_logo('00000000-0000-4000-8000-000000000001',
                      '00000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-0000000b0397.png') $$,
  '42501', null, 'nor sets one');
reset role;

select * from finish();
rollback;
