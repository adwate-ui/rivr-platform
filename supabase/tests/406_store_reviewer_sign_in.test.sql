-- The app stores' reviewers sign in with one number and a fixed code (decision 0575), which must never open a real account.
-- Asha (0821) is a new member on the reviewer's number. Seeded members with a visit, a tournament entry or a ledger entry, and
-- Vikram (101) who is staff, stand in as someone real.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.event(user_id uuid, methods text[]) returns jsonb language sql as $$
  select jsonb_build_object('user_id', user_id, 'claims', jsonb_build_object('sub', user_id,
    'amr', (select jsonb_agg(jsonb_build_object('method', m, 'timestamp', 1760000000)) from unnest(methods) as m)));
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.as_owner() to authenticated;

-- Makes a number the reviewer's at the club.
create function pg_temp.reviewer_is(p_phone text) returns void language plpgsql as $$
begin
  delete from public.setting where key = 'auth.store_reviewer';
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'auth.store_reviewer', '', jsonb_build_object('phone', p_phone), now(), 'Store review');
end;
$$;

-- What the hook answers a code sign-in on that number, as the reviewer's: null lets it through.
create function pg_temp.answer_for(p_phone text) returns text language plpgsql as $$
declare
  v_user uuid;
begin
  select u.id into v_user from auth.users u where u.phone = ltrim(p_phone, '+');
  if v_user is null then
    v_user := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', ltrim(p_phone, '+'), now(), now(), now());
  end if;
  perform pg_temp.reviewer_is(p_phone);
  return private.require_code_sign_in(pg_temp.event(v_user, array['otp'])) -> 'error' ->> 'http_code';
end;
$$;

-- The phone of a seeded member at the club who has a row in the query given.
create function pg_temp.phone_with(p_member_ids text) returns text language plpgsql as $$
declare
  v_phone text;
begin
  execute format('select m.phone from public.member m where m.venue_id = %L and m.phone is not null and m.id in (%s) limit 1',
                 '00000000-0000-4000-8000-000000000001', p_member_ids) into v_phone;
  return v_phone;
end;
$$;

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000d0821', 'authenticated', 'authenticated', '919000000821', now(), now(), now());

-- ---------------------------------------------------------------------------------------------------
-- With none set, sign-in is as it was.
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-0000000d0821', array['otp'])) -> 'error', null, 'with no reviewer set, a code signs in');

-- ---------------------------------------------------------------------------------------------------
-- The reviewer's number signs in while it is no one real.
select is(pg_temp.answer_for('+919000000821'), null, 'a number no one holds signs in');
insert into public.member (id, venue_id, user_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000d0821', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0821', 'App Review', '+919000000821');
select is(pg_temp.answer_for('+919000000821'), null, 'and still does as a member who has not played');
select is(private.require_code_sign_in(pg_temp.event('00000000-0000-4000-8000-0000000d0821', array['password'])) -> 'error' ->> 'http_code', '403',
          'and only ever with a code');

-- ---------------------------------------------------------------------------------------------------
-- It is refused once it is someone real.
select isnt(pg_temp.phone_with('select x.member_id from public.visit x'), null, 'the seed has a member with a visit');
select is(pg_temp.answer_for(pg_temp.phone_with('select x.member_id from public.visit x')), '403', 'a member with a visit is refused');
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0823', '00000000-0000-4000-8000-000000000001', 'Priya Nair', '+919000000823');
insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise)
values ('00000000-0000-4000-8000-0000000c0823', '00000000-0000-4000-8000-000000000001', 'Test Cup', now() + interval '1 day', 100000);
insert into public.tournament_entry (venue_id, tournament_id, member_id, entry_number, status)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c0823', '00000000-0000-4000-8000-0000000d0823', 1, 'alternate');
select is(pg_temp.answer_for('+919000000823'), '403', 'a member with a tournament entry is refused');
select isnt(pg_temp.phone_with('select a.member_id from public.ledger_entry e join public.ledger_account a on a.id = e.account_id'), null, 'the seed has a member with a ledger entry');
select is(pg_temp.answer_for(pg_temp.phone_with('select a.member_id from public.ledger_entry e join public.ledger_account a on a.id = e.account_id')), '403',
          'a member with a ledger entry is refused');
select is(pg_temp.answer_for('+919000000101'), '403', 'a staff member is refused');
insert into public.staff (venue_id, full_name, phone, job_title, role)
values ('00000000-0000-4000-8000-000000000001', 'Not Linked Yet', '+919000000824', 'Cashier', 'cashier');
select is(pg_temp.answer_for('+919000000824'), '403', 'so is a staff member whose login is not linked yet');

-- ---------------------------------------------------------------------------------------------------
-- Everyone else is as before, and only the reviewer's number is fenced.
select pg_temp.reviewer_is('+919000000821');
select is(private.require_code_sign_in(pg_temp.event((select u.id from auth.users u where u.phone = '919000000101'), array['otp'])) -> 'error', null,
          'another number with history signs in as ever');

-- ---------------------------------------------------------------------------------------------------
-- The setting.
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'auth.store_reviewer', '', '{"phone": "12345"}'::jsonb, now() + interval '1 minute', 'Store review') $$,
                 null, null, 'a setting that is not a mobile number is refused');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'auth.store_reviewer', '', '{"phone": "+919000000822"}'::jsonb, now() + interval '1 minute', 'Store review') $$,
                 null, null, 'and an admin cannot set it');
select pg_temp.as_owner();
select ok(not has_function_privilege('authenticated', 'private.store_reviewer_has_history(text)', 'execute'), 'no one signed in calls the check');

select * from finish();
rollback;
