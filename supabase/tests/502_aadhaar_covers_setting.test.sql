-- The Aadhaar bars as a venue setting (the owner, 15 Nov night; decision 0663): kyc.aadhaar_covers is off until set, so the
-- desk checks a member and retakes an Aadhaar photo without the word on its bars, and no one's word is kept; only a super
-- admin turns it on, with a reason, and the owner is told; on, the word is asked for again. Either way the photos open for
-- super admins alone. 108 is a host, 103 an admin, 101 a super admin; 203 is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create temp table check_paths (face text, pan text, aadhaar text) on commit drop;
grant select, insert, delete on check_paths to authenticated;

-- The three files for one check, as the kyc-in-person function stores them (as 403).
create function pg_temp.store_photos(p_member uuid) returns void language plpgsql as $$
declare
  v_face text := public.authorize_in_person_kyc(p_member);
  v_pan text := replace(v_face, '/in-person-', '/doc-pan-');
  v_aadhaar text := replace(v_face, '/in-person-', '/doc-aadhaar-');
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_face), ('kyc', v_pan), ('kyc', v_aadhaar);
  set local role authenticated;
  delete from check_paths;
  insert into check_paths values (v_face, v_pan, v_aadhaar);
end;
$$;
grant execute on function pg_temp.store_photos(uuid) to authenticated;

create function pg_temp.covers(p_enabled boolean, p_reason text) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'kyc.aadhaar_covers', '', jsonb_build_object('enabled', p_enabled), now() - interval '1 second', p_reason);
$$;
grant execute on function pg_temp.covers(boolean, text) to authenticated;

-- Off until set: the desk is told so, and checks without the word.
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is(public.kyc_aadhaar_covers('00000000-0000-4000-8000-000000000001'), false, 'the bars are off until a super admin turns them on');
select pg_temp.store_photos('00000000-0000-4000-8000-000000000203');
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', (select face from check_paths), '1990-02-03', '4321', 'MIHPS4321K', true,
            (select pan from check_paths), (select aadhaar from check_paths), false), 'verified', 'the host verifies the member with no word on bars');
reset role;
select is((select covers_confirmed_by_staff_id from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), null,
  'and no one''s word on bars is kept for the Aadhaar photo');
select is((select masked_aadhaar from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203'), 'XXXX XXXX 4321',
  'the typed digits are kept as the last four only, as before');

-- The photo stays a super admin's alone.
create temp table doc as select (select aadhaar from check_paths) as path;
grant select on doc to authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'the host who took the Aadhaar photo cannot open it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'nor can an admin');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.authorize_kyc_image((select path from doc)) $$, 'a super admin can');

-- A retake while off needs no word either.
select lives_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', 'Glare on the card') $$,
  'a super admin sends the Aadhaar back');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
create temp table retake as select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front') as path;
grant select on retake to authenticated;
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', path from retake;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.record_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', (select path from retake), false) $$,
  'the host keeps the new Aadhaar photo with no word on bars');
reset role;
select is((select covers_confirmed_by_staff_id from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), null,
  'and again no word is kept');

-- Only a super admin turns them on, with a reason, and the owner is told.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.covers(true, 'Back to the bars') $$, '42501', null, 'an admin may not turn the bars on');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select pg_temp.covers(true, '') $$, '22023', null, 'a super admin needs a reason');
select lives_ok($$ select pg_temp.covers(true, 'Back to the bars') $$, 'and turns them on with one');
reset role;
select ok(exists (select 1 from public.alert a where a.kind = 'settings.control_changed' and a.detail ->> 'key' = 'kyc.aadhaar_covers'),
  'and the owner is told');

-- On, the word is asked for again: a retake without it is refused, one with it names who gave it.
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is(public.kyc_aadhaar_covers('00000000-0000-4000-8000-000000000001'), true, 'the desk is told the bars are on');
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', 'Glare on the card') $$, 'sent back again');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
delete from retake;
insert into retake select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front');
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', path from retake;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.record_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', (select path from retake), false) $$,
  '22023', null, 'with the bars on, a new Aadhaar photo needs the word on them');
select lives_ok($$ select public.record_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', (select path from retake), true) $$,
  'and goes on file with it');
reset role;
select is((select count(*)::integer from public.kyc_document d join public.staff s on s.id = d.covers_confirmed_by_staff_id
           where d.member_id = '00000000-0000-4000-8000-000000000203' and d.kind = 'aadhaar_front' and s.user_id = '00000000-0000-4000-8000-000000000108'), 1,
  'naming who confirmed its bars');

-- Only the desk asks whether the bars are on; a member is told nothing.
select pg_temp.as_user('00000000-0000-4000-8000-000000000203');
select is(public.kyc_aadhaar_covers('00000000-0000-4000-8000-000000000001'), false, 'a member is told nothing');
reset role;
select throws_ok($$ update public.kyc_document set covers_confirmed_by_staff_id = taken_by_staff_id
                    where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'pan' $$, '23514', null,
  'a PAN still never carries a word on bars');

select * from finish();
rollback;
