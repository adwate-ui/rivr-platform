-- A device's token hash and the escalation matrix are kept from staff who have no use for them (#1015). 101 Vikram is a
-- super admin, 103 Aditya an admin (an SOP manager), 106 Pema a dealer, 108 a host. Contacts from seed 44_contacts.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.device (id, venue_id, kind, name, token_hash) values
  ('00000000-0000-4000-8000-0000000547d1', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage 547', repeat('5a', 32));

-- No signed-in caller reads a token hash, whatever their role; the rest of a device row is read as before.
select is(has_column_privilege('authenticated', 'public.device', 'token_hash', 'select'), false, 'no signed-in caller reads a device''s token hash');
select is(has_column_privilege('anon', 'public.device', 'token_hash', 'select'), false, 'nor anyone signed out');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select token_hash from public.device where id = '00000000-0000-4000-8000-0000000547d1' $$, '42501', null,
  'a super admin does not read it');
select results_eq($$ select name, kind::text from public.device where id = '00000000-0000-4000-8000-0000000547d1' $$,
  $$ values ('Cage 547'::text, 'cage'::text) $$, 'but reads the device''s name and kind');
reset role;

-- The escalation matrix: SOP managers read it; the floor reads the public numbers only.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.contact where kind = 'escalation'), 0, 'a dealer reads no escalation number');
select ok((select count(*) from public.contact where kind = 'police') = 1, 'and still the police');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::integer from public.contact where kind = 'escalation'), 0, 'nor a host');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select count(*) from public.contact where kind = 'escalation') >= 2, 'an admin reads it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select ok((select count(*) from public.contact where kind = 'escalation') >= 2, 'and a super admin');
reset role;

select * from finish();
rollback;
