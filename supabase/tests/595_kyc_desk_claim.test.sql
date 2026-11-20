-- A check in person claims its member as it starts (the owner, 20 Nov). 101 Vikram (super admin) and 103 (floor manager)
-- check members in person; 104 Sana (cashier) does not. At the club, 203 Naina and 204 Rohan have no check.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- As the Edge Function does: the reviewer asks where this check's photo goes, and the photo is stored there.
create function pg_temp.photo_for(p_member_id uuid) returns text language plpgsql as $$
declare
  v_path text := public.authorize_in_person_kyc(p_member_id);
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_path), ('kyc', replace(v_path, '/in-person-', '/doc-pan-')), ('kyc', replace(v_path, '/in-person-', '/doc-aadhaar-'));
  set local role authenticated;
  return v_path;
end;
$$;

create function pg_temp.check(p_member_id uuid, p_date_of_birth date, p_last4 text, p_pan text) returns text language sql as $$
  select public.check_kyc_in_person(p_member_id, p.path, p_date_of_birth, p_last4, p_pan, true, replace(p.path, '/in-person-', '/doc-pan-'), replace(p.path, '/in-person-', '/doc-aadhaar-'), true)
  from (select pg_temp.photo_for(p_member_id) as path) p;
$$;

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.photo_for(uuid), pg_temp.check(uuid, date, text, text), pg_temp.as_user(uuid) to authenticated;

-- The staff names as the claims say them.
create temp table names as
select (select s.full_name from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101'
          and s.venue_id = '00000000-0000-4000-8000-000000000001') as vikram,
       (select s.full_name from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103'
          and s.venue_id = '00000000-0000-4000-8000-000000000001') as floor;
grant select on names to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select results_eq($$ select status, staff_name from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('claimed'::text, null::text) $$, 'Start claims a member no one is checking');
select results_eq($$ select status from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('claimed'::text) $$, 'and claims them again for the one already checking them');
select is_empty($$ select * from public.kyc_desk_claims('00000000-0000-4000-8000-000000000001') $$,
  'the desk''s list leaves out the caller''s own claims');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq($$ select status, staff_name, since is not null from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ select 'taken'::text, vikram, true from names $$, 'another member of staff is told who is checking them, and cannot start them');
select results_eq($$ select member_id, staff_name from public.kyc_desk_claims('00000000-0000-4000-8000-000000000001') $$,
  $$ select '00000000-0000-4000-8000-000000000203'::uuid, vikram from names $$, 'and sees who is checking whom in the list');
select public.release_kyc_desk_check('00000000-0000-4000-8000-000000000203');
select results_eq($$ select status from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('taken'::text) $$, 'letting go of a claim that is someone else''s changes nothing');

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select public.release_kyc_desk_check('00000000-0000-4000-8000-000000000203');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq($$ select status from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('claimed'::text) $$, 'once the one checking lets go, another may start');

-- A claim left for longer than 15 minutes counts for nothing.
reset role;
update private.kyc_desk_claim set claimed_at = now() - interval '16 minutes' where member_id = '00000000-0000-4000-8000-000000000203';
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select results_eq($$ select status from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('claimed'::text) $$, 'a claim older than 15 minutes is no longer anyone''s');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.kyc_desk_claims('00000000-0000-4000-8000-000000000001') where staff_name is distinct from (select vikram from names) $$,
  'and only a live claim is listed');

-- A member whose check is done: who checked them, and when.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is(pg_temp.check('00000000-0000-4000-8000-000000000204', '1990-04-12', '1234', 'ABCPR1234K'), 'verified', 'Vikram checks Rohan');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq($$ select status, staff_name, since is not null from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000204') $$,
  $$ select 'decided'::text, vikram, true from names $$, 'starting a member already checked says who checked them, and when');

-- A claim that lapsed is cleared as the next is written.
reset role;
update private.kyc_desk_claim set claimed_at = now() - interval '20 minutes' where member_id = '00000000-0000-4000-8000-000000000203';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq($$ select status from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000202') $$,
  $$ values ('claimed'::text) $$, 'the floor manager claims Kabir');
reset role;
select is((select count(*)::integer from private.kyc_desk_claim where member_id = '00000000-0000-4000-8000-000000000203'), 0,
  'and Naina''s lapsed claim is gone');

-- Erasure takes the member's claim with their other records.
select is((select count(*)::integer from private.kyc_desk_claim where member_id = '00000000-0000-4000-8000-000000000202'), 1, 'Kabir is claimed');
select private.delete_member_records(m) from public.member m where m.id = '00000000-0000-4000-8000-000000000202';
select is((select count(*)::integer from private.kyc_desk_claim where member_id = '00000000-0000-4000-8000-000000000202'), 0,
  'erasing Kabir''s records takes his claim');

-- Only staff who check members in person: a member, or a cashier, is refused before anything is held.
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select * from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'a member cannot claim a check');
select is_empty($$ select * from public.kyc_desk_claims('00000000-0000-4000-8000-000000000001') $$, 'nor see who is checking whom');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.claim_kyc_desk_check('00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'a cashier cannot claim a check');
select is_empty($$ select * from public.kyc_desk_claims('00000000-0000-4000-8000-000000000001') $$, 'nor see who is checking whom');
reset role;

select ok(not has_function_privilege('anon', 'public.claim_kyc_desk_check(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.kyc_desk_claims(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.release_kyc_desk_check(uuid)', 'execute'),
  'nobody signed out reaches the claims');
select ok(not has_table_privilege('authenticated', 'private.kyc_desk_claim', 'select'), 'the claims are read only through the functions');

select * from finish();
rollback;
