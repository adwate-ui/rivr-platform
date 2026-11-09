-- PAN and Aadhaar photos at the desk check (the owner, 9 Nov; decision 0573): the check needs both, and the staff member's word
-- that the Aadhaar's bars are in place; only super admins open them, each opening audited; a super admin can send one back, and the
-- member reappears for the desk for that photo alone; they go with the member on erasure. 108 is a host, 103 an admin, 104 a
-- cashier, 101 a super admin; 203 is the member.
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
grant select, insert on check_paths to authenticated;

-- The three files for one check, as the kyc-in-person function stores them, and their paths kept for the steps below.
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
grant delete on check_paths to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select pg_temp.store_photos('00000000-0000-4000-8000-000000000203');

select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', (select face from check_paths), '1990-02-03', '4321', 'MIHPS4321K', true) $$,
  'RVPHT', null, 'a check with no document photos is refused');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', (select face from check_paths), '1990-02-03', '4321', 'MIHPS4321K', true,
                    replace((select pan from check_paths), '000203/', '000204/'), (select aadhaar from check_paths), true) $$,
  'RVPHT', null, 'nor with another member''s file named');
select throws_ok($$ select public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', (select face from check_paths), '1990-02-03', '4321', 'MIHPS4321K', true,
                    (select pan from check_paths), (select aadhaar from check_paths), false) $$,
  '22023', null, 'nor without the word that the Aadhaar''s bars are in place');
select is(public.check_kyc_in_person('00000000-0000-4000-8000-000000000203', (select face from check_paths), '1990-02-03', '4321', 'MIHPS4321K', true,
            (select pan from check_paths), (select aadhaar from check_paths), true), 'verified', 'with all of them the host verifies the member');
reset role;

select is((select count(*)::integer from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203'), 2, 'two documents are on file');
select is((select count(*)::integer from public.kyc_document d join public.staff s on s.id = d.covers_confirmed_by_staff_id
           where d.member_id = '00000000-0000-4000-8000-000000000203' and d.kind = 'aadhaar_front' and s.user_id = '00000000-0000-4000-8000-000000000108'), 1,
  'the Aadhaar names who confirmed its bars');
select is((select covers_confirmed_by_staff_id from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'pan'), null,
  'and the PAN has none, as it is kept whole');
select is((select masked_aadhaar from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203'), 'XXXX XXXX 4321', 'the typed digits stay as they were');

-- Who opens them.
create temp table doc as select (select pan from check_paths) as path, (select face from check_paths) as face;
grant select on doc to authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'the host who took it cannot reopen it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'nor can an admin');
select lives_ok($$ select public.authorize_kyc_image((select face from doc)) $$, 'though an admin still sees the face photo');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'nor a cashier');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.authorize_kyc_image((select path from doc)) $$, 'a super admin can');
reset role;
select is((select count(*)::integer from public.audit_log a where a.action = 'kyc_image.view' and a.entity_id = (select path from doc)), 1, 'and that opening is audited, the refused ones not counted');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.member_kyc_documents('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') $$, 'an admin lists none');
select throws_ok($$ select 1 from public.kyc_document $$, '42501', null, 'nobody reads the table directly');
-- Staff of another venue, a cashier there.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e9');
select is_empty($$ select 1 from public.member_kyc_documents('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') $$, 'staff of another venue list none');
select throws_ok($$ select public.authorize_kyc_image((select path from doc)) $$, '42501', null, 'nor open one');
select throws_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'pan', 'Blurred') $$, '42501', null, 'nor send one back');
select throws_ok($$ select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'pan') $$, '42501', null, 'nor take one again');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select results_eq($$ select kind, taken_by is not null, retake_asked_at is null from public.member_kyc_documents('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') order by kind $$,
  $$ values ('aadhaar_front'::text, true, true), ('pan', true, true) $$, 'a super admin lists both, with who took them');

-- Sent back.
reset role;
create temp table who as select full_name from public.member where id = '00000000-0000-4000-8000-000000000203';
grant select on who to authenticated;
update public.kyc_document set taken_at = now() - interval '3 days' where member_id = '00000000-0000-4000-8000-000000000203';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', 'Digits showing') $$, '42501', null, 'an admin cannot send one back');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', 'x') $$, '22023', null, 'a super admin says why, in more than a letter');
select throws_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'passport', 'Blurred') $$, '22023', null, 'and only for a document on file');
select lives_ok($$ select public.ask_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', 'Digits showing') $$, 'a super admin sends the Aadhaar back');
select throws_ok($$ select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front') $$, '42501', null, 'and someone else must take it again');
reset role;
select cmp_ok((select taken_at from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), '<', now() - interval '2 days',
  'sending it back does not change when it was taken');
insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', now() - interval '10 minutes');

select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select results_eq($$ select retake_kinds from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values (array['aadhaar_front']::text[]) $$, 'the verified member is due at the desk, for that photo alone');
select results_eq($$ select retake_reasons from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values (array['Digits showing']::text[]) $$, 'and told why it came back');
select isnt_empty($$ select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', (select full_name from who)) where retake_kinds = array['aadhaar_front']::text[] $$,
  'and the desk can find them by search');
select throws_ok($$ select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'pan') $$, 'RVKYC', null, 'a photo not sent back is not retaken');

create temp table retake as select public.authorize_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front') as path;
grant select on retake to authenticated;
reset role;
insert into storage.objects (bucket_id, name) select 'kyc', path from retake;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.record_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', (select path from retake), false) $$, '22023', null, 'a new Aadhaar photo needs the word on its bars too');
select lives_ok($$ select public.record_kyc_document_retake('00000000-0000-4000-8000-000000000203', 'aadhaar_front', (select path from retake), true) $$, 'with it, the new photo goes on file');
reset role;
select is((select path from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), (select path from retake), 'the new photo is on file');
select is((select retake_asked_at from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), null, 'and nothing is waiting');
select is((select taken_at from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203' and kind = 'aadhaar_front'), now(), 'and it is dated when it was taken');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000203' $$, 'so the member is no longer due');
reset role;

-- Erasure takes the rows with the member; its function removes the whole folder of files.
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000203';
select is((select count(*)::integer from public.kyc_document where member_id = '00000000-0000-4000-8000-000000000203'), 0, 'an erased member''s documents go');
select is(private.strip_erased_fields('{"retake_reason": "Blurred"}'::jsonb), '{}'::jsonb, 'and why one was sent back leaves the audit log with them');
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000203') $$, '42501', null, 'the desk cannot start a new check on them');
select is_empty($$ select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Erased member') $$, 'nor find them by search');
reset role;

select * from finish();
rollback;
