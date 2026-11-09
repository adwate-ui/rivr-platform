-- Who still has access, and who deals (8 Nov audit, I-76, F-082, F-116): when each login last signed in, to staff who manage staff alone;
-- Dealer PINs for dealers and the manager themselves, and no other manager's PIN.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.staff_of(p_user text) returns uuid language sql security definer as $$
  select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = p_user::uuid;
$$;
grant execute on function pg_temp.staff_of(text) to authenticated;

update auth.users set last_sign_in_at = '2026-10-01 10:00:00+05:30' where id = '00000000-0000-4000-8000-000000000106';

-- Staff who manage staff read the last sign-in; a super admin and an admin.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select last_signed_in_at from public.venue_staff('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'),
          '2026-10-01 10:00:00+05:30'::timestamptz, 'a super admin reads when a login last signed in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select last_signed_in_at from public.venue_staff('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'),
          '2026-10-01 10:00:00+05:30'::timestamptz, 'and an admin who manages staff');
-- Other staff still see colleagues, without it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select last_signed_in_at from public.venue_staff('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'), null, 'marketing does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select last_signed_in_at from public.venue_staff('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'), null, 'nor an investor');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select is((select last_signed_in_at from public.venue_staff('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'), null, 'nor service staff');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.venue_staff('00000000-0000-4000-8000-000000000001') $$, 'a member reads no staff');

-- Dealer PINs: the dealers, and the manager themselves.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select role::text from public.venue_dealers('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha' $$,
  $$ values ('dealer'::text) $$, 'a dealer is listed, with the role');
select results_eq($$ select role::text from public.venue_dealers('00000000-0000-4000-8000-000000000001') where full_name = 'Vikram Rao' $$,
  $$ values ('super_admin'::text) $$, 'and the super admin themselves');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') where role <> 'dealer' and full_name <> 'Vikram Rao' $$,
  'and no other super admin');
select lives_ok(format($$ select public.set_dealer_pin(%L, '2741') $$, pg_temp.staff_of('00000000-0000-4000-8000-000000000106')), 'a super admin sets a dealer''s PIN');
select lives_ok(format($$ select public.set_dealer_pin(%L, '2741') $$, pg_temp.staff_of('00000000-0000-4000-8000-000000000101')), 'and their own');
select throws_ok(format($$ select public.set_dealer_pin(%L, '2741') $$, pg_temp.staff_of('00000000-0000-4000-8000-000000000135')), '42501', null,
  'but not another super admin''s, to deal under their name');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'an admin, who does not deal, lists none');
select throws_ok(format($$ select public.set_dealer_pin(%L, '2741') $$, pg_temp.staff_of('00000000-0000-4000-8000-000000000106')), '42501', null, 'and sets none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'an investor lists none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'nor marketing');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'nor service staff');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'nor a member');

-- Staff of another venue alone read none of this one.
reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Owner', 'Owner', 'super_admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.venue_staff('00000000-0000-4000-8000-000000000001') $$, 'another venue''s super admin reads none of this one''s staff');
select is_empty($$ select 1 from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'nor its dealers');
reset role;
select ok(not has_function_privilege('anon', 'public.venue_staff(uuid)', 'execute'), 'nobody signed out reads staff');
select ok(not has_function_privilege('anon', 'public.venue_dealers(uuid)', 'execute'), 'nor dealers');

select * from finish();
rollback;
