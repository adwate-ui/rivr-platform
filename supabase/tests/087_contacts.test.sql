-- Contacts (decision 0113): staff read the club's contacts and SOP managers keep them. The incident log and the
-- drills this file also covered went on 15 Nov. 103 Aditya is an admin (SOP manager), 106 Pema a dealer, 154 Leela
-- a super admin at the club only. Contacts from seed 44_contacts.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Contacts.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select kind::text, name, phone from public.contact where kind in ('police', 'fire', 'electricity') order by kind $$,
  $$ values ('electricity'::text, 'DHBVN'::text, '1912'::text), ('fire', 'Fire service', '101'), ('police', 'Police', '112') $$,
  'every staff member reads the police, fire and DHBVN numbers');
select ok((select count(*) from public.contact where kind = 'escalation') >= 2, 'and the escalation matrix');
select throws_ok($$ insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000001', 'vendor', 'Shuffler', '+91 98765 43210') $$,
  '42501', null, 'a dealer keeps no contacts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into public.contact (venue_id, kind, position, name, role, phone) values
                   ('00000000-0000-4000-8000-000000000001', 'vendor', 3, 'Shuffler service', 'Card shufflers', '+91 98765 43210') $$,
  'an SOP manager adds a vendor');
select throws_ok($$ insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000001', 'vendor', 'X', 'call me') $$,
  '23514', null, 'with a number, not words');
select results_eq($$ update public.contact set role = 'Card shufflers, both rooms' where name = 'Shuffler service' returning role $$,
  $$ values ('Card shufflers, both rooms'::text) $$, 'and changes it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ update public.contact set phone = '+91 90000 00000' where name = 'Shuffler service' returning id $$, 'a dealer changes no contact');
select is_empty($$ delete from public.contact where name = 'Shuffler service' returning id $$, 'nor removes one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ delete from public.contact where name = 'Shuffler service' returning name $$, $$ values ('Shuffler service'::text) $$,
  'an SOP manager removes it');
-- Leela, a super admin at the club only, reads nothing of the practice venue's.
insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000002', 'police', 'Practice police', '112');
select pg_temp.as_person('00000000-0000-4000-8000-000000000154');
select is_empty($$ select * from public.contact where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'staff read only their venues'' contacts');

select * from finish();
rollback;
