-- A setting's whole numbers are stored whole (#916): 20.0 written straight through the API reads as 20 everywhere, and a
-- fraction stays. 103 Aditya is an admin, who manages settings.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select is(private.whole_numbers('{"a": 20.0, "b": [1.0, 2.50, "3.0"], "c": {"d": 1e2, "e": -0.0}, "f": null, "g": true}')::text,
  '{"a": 20, "b": [1, 2.50, "3.0"], "c": {"d": 100, "e": 0}, "f": null, "g": true}', 'whole numbers written whole, wherever they sit; the rest kept');

-- The admin writes the waitlist's hold and the Set call time lengths straight through the API, as decimals.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
                   values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '', '{"minutes": 20.0}', now()) $$,
  'an admin writes the hold as 20.0 minutes');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
                   values ('00000000-0000-4000-8000-000000000001', 'call_time.add_choices', '', '{"minutes": [45.0, 90.0]}', now()) $$,
  'and the Set call time lengths as 45.0 and 90.0');
reset role;
select is((select value::text from public.setting where key = 'waitlist.hold_minutes' and venue_id = '00000000-0000-4000-8000-000000000001'
           order by created_at desc, effective_from desc limit 1), '{"minutes": 20}', 'the hold is stored whole');
select lives_ok($$ select private.waitlist_hold('00000000-0000-4000-8000-000000000001', now()) $$, 'and the waitlist reads it');
select is(private.add_time_choices('00000000-0000-4000-8000-000000000001'), array[45, 90], 'the lengths read as 45 and 90');

select * from finish();
rollback;
