-- Members held at "Needs a PAN" reach the desk (audit F-010, F-091). Asha's and Bhavna's checks went through DigiLocker and
-- wait for a PAN check Cashfree no longer runs, with the address and Aadhaar name DigiLocker kept. With the club checking
-- identity at the desk, the host (108 Karan) finds Asha and checks her in person; Bhavna's selfie in the app starts her
-- check again; both lose what DigiLocker kept. Tonight's list for the desk shows members in the room or on a list whose
-- check is not done.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a531', 'authenticated', 'authenticated', '919000005031', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a532', 'authenticated', 'authenticated', '919000005032', now(), now(), now());

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_user(uuid) to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a531');
insert into ids select 'asha', public.sign_up('Asha Pillai', '{}');
select pg_temp.as_user('00000000-0000-4000-8000-00000000a532');
insert into ids select 'bhavna', public.sign_up('Bhavna Rao', '{}');
reset role;

-- Both held at needs_pan after DigiLocker.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, address, aadhaar_name)
select '00000000-0000-4000-8000-000000000001', id, 'needs_pan', 'digilocker', '1990-01-01', 'A house in Gurugram', upper(name) from ids;
insert into storage.objects (bucket_id, name) select 'kyc', '00000000-0000-4000-8000-000000000001/' || id || '/photo.jpg' from ids where name = 'bhavna';

select ok(not has_function_privilege('anon', 'public.kyc_due_tonight(uuid)', 'execute'), 'nobody signed out can ask who is due');

-- With the switch off the app's own PAN step stands: the desk neither finds nor takes over the check, and a selfie changes nothing.
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Asha Pillai') $$,
                'with the switch off, the desk does not find a check waiting for its PAN');
select throws_ok($$ select public.authorize_in_person_kyc((select id from ids where name = 'asha')) $$, 'RVKYC', null, 'nor take it over');
select pg_temp.as_user('00000000-0000-4000-8000-00000000a532');
select is(public.take_kyc_at_the_club(), false, 'and a selfie does not start the check again');
reset role;
select is((select status from public.kyc_record where member_id = (select id from ids where name = 'bhavna')), 'needs_pan', 'which stays where it was');

-- Then a super admin (101 Vikram) has the club check identity at the desk.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Cashfree is not live');
reset role;

-- The desk's check, with Asha's own PAN and last Aadhaar digits.
create function pg_temp.desk_check(p_member_id uuid) returns text language plpgsql as $$
declare
  v_path text := public.authorize_in_person_kyc(p_member_id);
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_path);
  set local role authenticated;
  return public.check_kyc_in_person(p_member_id, v_path, '1990-01-01', '4321', 'ASHPA1234K', true);
end;
$$;
grant execute on function pg_temp.desk_check(uuid) to authenticated;

-- Both in the room tonight.
insert into public.visit (venue_id, member_id, opened_at) select '00000000-0000-4000-8000-000000000001', id, now() - interval '30 minutes' from ids;

select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is((select status from public.kyc_in_person_candidates('00000000-0000-4000-8000-000000000001', 'Asha Pillai')), 'needs_pan',
          'the desk finds a member whose check waits for a PAN');
select is(array(select full_name from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where full_name in ('Asha Pillai', 'Bhavna Rao')
                order by full_name), array['Asha Pillai', 'Bhavna Rao'], 'and both are due tonight, in the room with their check not done');
select is(pg_temp.desk_check((select id from ids where name = 'asha')), 'verified', 'the host checks Asha in person, and she is verified');
select is_empty($$ select 1 from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Asha Pillai' $$,
                'once verified she is no longer due');
reset role;
select is((select (address, aadhaar_name)::text from public.kyc_record where member_id = (select id from ids where name = 'asha')), '(,)',
          'and nothing DigiLocker kept is left on her check');

-- Bhavna takes her selfie in the app: her check starts again, waiting for the desk, and lets her in.
select pg_temp.as_user('00000000-0000-4000-8000-00000000a532');
select is(public.take_kyc_at_the_club(), true, 'Bhavna''s selfie lets her in to wait for the desk');
reset role;
select is((select (status, at_club_from is not null, address, aadhaar_name, date_of_birth)::text from public.kyc_record
           where member_id = (select id from ids where name = 'bhavna')), '(started,t,,,)', 'her check started again, with what DigiLocker kept cleared');

-- Someone who is neither in the room nor on a list is not due.
update public.visit set closed_at = now(), close_reason = 'door' where member_id = (select id from ids where name = 'bhavna') and closed_at is null;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Bhavna Rao' $$,
                'gone home, Bhavna is not due tonight');
reset role;

-- On a table's list from home, she is due again: the desk checks her when she arrives.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'bhavna'), g.table_type_id, g.id, gen_random_uuid()
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select isnt_empty($$ select 1 from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Bhavna Rao' $$,
                  'on a list, Bhavna is due');
reset role;

-- A dealer, who checks no one, sees nobody due.
select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.kyc_due_tonight('00000000-0000-4000-8000-000000000001')), 0, 'a dealer sees nobody due');
reset role;

select * from finish();
rollback;
