-- Removed staff (the owner, 8 Nov): staff who manage staff read when each removed login was turned off and by whom. 101
-- Vikram (super admin) turns off 107 Ishita (marketing); 108 Karan (host) cannot read it; a turned-on login again is no
-- longer removed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ishita as
  select id from public.staff where user_id = '00000000-0000-4000-8000-000000000107' and venue_id = '00000000-0000-4000-8000-000000000001';
grant select on ishita to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ update public.staff set is_active = false where id = (select id from ishita) $$, 'Vikram turns off Ishita''s login');
select results_eq($$ select removed_by, removed_at = now() from public.staff_removals('00000000-0000-4000-8000-000000000001')
                     where staff_id = (select id from ishita) $$,
  $$ values ('Vikram Rao'::text, true) $$, 'the removed list says when, and that Vikram did it');
select ok(not exists (select 1 from public.staff_removals('00000000-0000-4000-8000-000000000001') r
                      join public.staff s on s.id = r.staff_id where s.is_active), 'only logins that are off now');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.staff_removals('00000000-0000-4000-8000-000000000001') $$, 'a host reads no removals');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select 1 from public.staff_removals('00000000-0000-4000-8000-000000000002') r
                   join public.staff s on s.id = r.staff_id where s.venue_id <> '00000000-0000-4000-8000-000000000002' $$,
  'another venue''s list names none of this venue''s staff');

select lives_ok($$ update public.staff set is_active = true where id = (select id from ishita) $$, 'and turns her back on');
select is_empty($$ select 1 from public.staff_removals('00000000-0000-4000-8000-000000000001') where staff_id = (select id from ishita) $$,
  'she is no longer removed');
reset role;

select * from finish();
rollback;
