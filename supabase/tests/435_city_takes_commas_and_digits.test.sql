-- The sign-up form's city takes commas and digits (issue 1006; the owner, 15 Nov): "Gurugram, Haryana" and "Sector 65"
-- pass. It still starts with a letter or a digit, stays in English letters and keeps its length; the name's rule is as it
-- was. A new number signs up here and answers as a member does.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c6', 'authenticated', 'authenticated', '919000000962', now(), now(), now());

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.city() returns text language sql as
$$ select city from public.member_preference where member_id = (select id from ids where name = 'member') $$;

select pg_temp.as_user('00000000-0000-4000-8000-0000000000c6');
insert into ids select 'member', public.sign_up('Asha Rao', '{}');

-- What now passes.
select lives_ok($$ select public.set_my_sign_up_answers('Gurugram, Haryana', 'salaried', '{}') $$, 'a city with its state after a comma');
reset role;
select is(pg_temp.city(), 'Gurugram, Haryana', 'is kept as typed');
select pg_temp.as_user('00000000-0000-4000-8000-0000000000c6');
select lives_ok($$ select public.set_my_sign_up_answers('Sector 65', 'salaried', '{}') $$, 'a sector, with its digits');
select lives_ok($$ select public.set_my_sign_up_answers('122018 Gurugram', 'salaried', '{}') $$, 'a city that starts with a digit');
select lives_ok($$ select public.set_my_sign_up_answers('  Sector  65,   Gurugram ', 'salaried', '{}') $$, 'and one typed with loose spaces');
reset role;
select is(pg_temp.city(), 'Sector 65, Gurugram', 'which is kept with single spaces');

-- What is still refused, and leaves the city as it was.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000c6');
select throws_ok($$ select public.set_my_sign_up_answers(', Gurugram', 'salaried', '{}') $$, '22023', null, 'a city never starts with a comma');
select throws_ok($$ select public.set_my_sign_up_answers('.Gurugram', 'salaried', '{}') $$, '22023', null, 'nor with a full stop');
select throws_ok($$ select public.set_my_sign_up_answers('-Gurugram', 'salaried', '{}') $$, '22023', null, 'nor with a hyphen');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram (Haryana)', 'salaried', '{}') $$, '22023', null, 'brackets are refused');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram; Haryana', 'salaried', '{}') $$, '22023', null, 'and other punctuation');
select throws_ok($$ select public.set_my_sign_up_answers('Gurugram<script>', 'salaried', '{}') $$, '22023', null, 'and markup');
select throws_ok($$ select public.set_my_sign_up_answers('गुरुग्राम', 'salaried', '{}') $$, '22023', null, 'and another script');
select throws_ok($$ select public.set_my_sign_up_answers('G', 'salaried', '{}') $$, '22023', null, 'one character is too short');
select throws_ok(format($$ select public.set_my_sign_up_answers('%s', 'salaried', '{}') $$, 'Sector 65, ' || repeat('a', 50)), '22023', null,
  'and sixty-one too long');
select lives_ok(format($$ select public.set_my_sign_up_answers('%s', 'salaried', '{}') $$, 'Sector 65, ' || repeat('a', 49)), 'sixty is the most');
reset role;
select is(length(pg_temp.city()), 60, 'kept whole');

-- The name's rule is as it was: no digit and no comma, as it must match Aadhaar.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c7', 'authenticated', 'authenticated', '919000000963', now(), now(), now());
select pg_temp.as_user('00000000-0000-4000-8000-0000000000c7');
select throws_ok($$ select public.sign_up('Asha Rao 2', '{}') $$, '22023', null, 'a name takes no digit');
select throws_ok($$ select public.sign_up('Rao, Asha', '{}') $$, '22023', null, 'and no comma');
select lives_ok($$ select public.sign_up('Asha O''Rao-Verma Jr.', '{}') $$, 'but an apostrophe, a hyphen and a full stop, as before');
reset role;

select * from finish();
rollback;
