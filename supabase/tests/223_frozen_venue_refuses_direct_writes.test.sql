-- A frozen venue refuses direct writes (audit of 28 Oct, A4-03): during a venue freeze, an admin's direct writes to staff,
-- members and the tier matrix are refused, while a member insert stays open and a super admin (venue.configure) still
-- changes a member. Owner 101 is a super admin; Aditya 103 an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.as_system() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_system() to authenticated;

-- Before the venue freeze, an admin's direct write goes through.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ update public.member set full_name = full_name where id = '00000000-0000-4000-8000-000000000201' $$,
  'before a freeze, an admin changes a member');
select pg_temp.as_system();

-- A contact at the club, for the move below.
insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-000000000001', 'escalation', 'Move Test', '+919000000779');

-- The venue frozen.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'C3 test');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.staff (venue_id, full_name, job_title, role, phone)
                    values ('00000000-0000-4000-8000-000000000001', 'New Login', 'Dealer', 'dealer', '+919000000777') $$,
  'RVFRZ', null, 'during a freeze, an admin adds no staff directly (A4-03)');
select throws_ok($$ update public.member set full_name = full_name where id = '00000000-0000-4000-8000-000000000201' $$,
  'RVFRZ', null, 'changes no member');
select throws_ok($$ insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
                    select venue_id, id, 'fnb.table_side', true, 'locked', now() + interval '1 day' from public.tier
                    where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member' $$,
  'RVFRZ', null, 'and changes no tier''s features');
select throws_ok($$ update public.contact set venue_id = '00000000-0000-4000-8000-000000000002' where name = 'Move Test' $$,
  'RVFRZ', null, 'moves no row out of the frozen venue, though the practice venue is open');
select results_eq($$ with turned_off as (update public.staff set is_active = false
                     where id = (select s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'host' and s.is_active
                                 order by s.id limit 1) returning 1)
                   select count(*)::integer from turned_off $$,
  $$ values (1) $$, 'turns a login off, as a manager may during a freeze (decision 0073)');
select throws_ok($$ update public.staff set job_title = 'Head host'
                    where id = (select s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'host' and s.is_active
                                order by s.id desc limit 1) $$,
  'RVFRZ', null, 'but changes nothing else about a login');
select set_eq($$ select c.relname::text from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'refuse_frozen_write' $$,
  $$ values ('staff'), ('member'), ('setting'), ('tier'), ('tier_feature'), ('venue_config'), ('chip_denomination'), ('contact'), ('device') $$,
  'every table that takes direct writes checks the freeze');
select is((select (t.tgtype & 4) <> 0 from pg_trigger t where t.tgrelid = 'public.member'::regclass and t.tgname = 'refuse_frozen_write'), false,
  'a member insert is left open, as sign-up was accepted in #495');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ update public.member set full_name = full_name where id = '00000000-0000-4000-8000-000000000201' $$,
  'a super admin, who holds venue.configure, still changes a member: the way out of a mistaken freeze (A4-05)');

select * from finish();
rollback;
