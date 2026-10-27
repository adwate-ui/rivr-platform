-- Cab eligibility and requests (#140): four visits this month offers a cab and three does not (cab.minimum_visits,
-- four when none is set); an eligible member asks for a pickup or a drop at a time of day; members see only their own.
-- 620 Kabir has four visits this month and 621 Tara three (seed 59_cab.sql).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000620');
select results_eq($$ select is_eligible, visits, minimum_visits from public.my_cab() $$, $$ values (true, 4, 4) $$,
  'four visits this month: the cab is offered');
select isnt(public.request_cab('pickup', 'Sector 54, Golf Course Road', '21:30'), null, 'Kabir asks for a pickup at 21:30');
select results_eq($$ select kind, address, (wanted_at at time zone 'Asia/Kolkata')::time, wanted_at > now() from public.cab_request $$,
  $$ values ('pickup'::text, 'Sector 54, Golf Course Road'::text, '21:30'::time, true) $$, 'at the next 21:30, and he sees his request');
select throws_ok($$ select public.request_cab('pickup', 'Sector 54', '25:00') $$, '22023', null, 'a time of day as 21:30');
select throws_ok($$ select public.request_cab('pickup', 'x', '21:30') $$, '22023', null, 'and somewhere to go');

select pg_temp.as_person('00000000-0000-4000-8000-000000000621');
select results_eq($$ select is_eligible, visits from public.my_cab() $$, $$ values (false, 3) $$, 'three visits: no cab');
select throws_ok($$ select public.request_cab('drop', 'DLF Phase 3', '23:00') $$, 'RVCAB', null, 'so Tara cannot ask for one');
select is((select count(*)::integer from public.cab_request), 0, 'and she sees no one else''s request');
reset role;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cab.minimum_visits', '', '{"visits": 3}', now() - interval '1 second', 'Cab test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000621');
select is((select is_eligible from public.my_cab()), true, 'with the club asking three, Tara is offered one');
reset role;

select is(has_function_privilege('anon', 'public.request_cab(text, text, text)', 'execute'), false, 'nobody signed out asks for a cab');

select * from finish();
rollback;
