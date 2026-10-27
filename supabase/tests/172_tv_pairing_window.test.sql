-- TV pairing (#325): a TV gets a code on first load; the limit for all screens alerts the owner; window-only pairing
-- gives codes only within ten minutes of Pair a TV, and switching back restores them; both switches are audited.
-- 101 Vikram is a super admin (venue.configure); 103 Aditya an admin (devices.manage, not venue.configure).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.refusal() returns text language sql as $$ select refusal from public.start_tv_pairing('203.0.113.25'); $$;
grant execute on function pg_temp.refusal() to service_role;

set local role service_role;
select is(pg_temp.refusal(), null, 'a TV gets a code on first load');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tv_pairing_window_only('00000000-0000-4000-8000-000000000001', true) $$, '42501', null,
  'only the owner switches how TVs pair');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.set_tv_pairing_window_only('00000000-0000-4000-8000-000000000001', true) $$, 'the owner switches to window-only');
select results_eq($$ select is_window_only, open_until is null from public.tv_pairing_policy('00000000-0000-4000-8000-000000000001') $$,
  $$ values (true, true) $$, 'window-only, with no window open');
reset role;
set local role service_role;
select is(pg_temp.refusal(), 'window_closed', 'so a TV gets no code until someone presses Pair a TV');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok(public.open_tv_pairing_window('00000000-0000-4000-8000-000000000001') > now() + interval '9 minutes', 'staff who manage devices open a window');
reset role;
set local role service_role;
select is(pg_temp.refusal(), null, 'and within it a TV gets a code');
reset role;
update public.venue_config set tv_pairing_window_at = now() - interval '11 minutes' where venue_id = '00000000-0000-4000-8000-000000000001';
set local role service_role;
select is(pg_temp.refusal(), 'window_closed', 'ten minutes on, no more');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.set_tv_pairing_window_only('00000000-0000-4000-8000-000000000001', false) $$, 'the owner switches back');
reset role;
set local role service_role;
select is(pg_temp.refusal(), null, 'and codes come on first load again');
reset role;
select ok((select count(*) from public.audit_log where entity = 'venue_config'
           and (after ->> 'tv_pairing_window_only') is distinct from (before ->> 'tv_pairing_window_only')) >= 2, 'both switches are in the audit log');

-- The limit for all screens together alerts the owner.
insert into private.tv_pairing (code_hash, secret_hash, client, expires_at)
select md5(g::text), md5('s' || g::text), 'client-' || g, now() + interval '15 minutes' from generate_series(1, 200) g;
delete from public.alert where kind = 'devices.pairing_guessed';
set local role service_role;
select is(pg_temp.refusal(), 'too_many', 'two hundred codes in ten minutes, and the next is refused');
reset role;
select ok(exists (select 1 from public.alert where kind = 'devices.pairing_guessed'), 'and the owner is alerted');

select * from finish();
rollback;
