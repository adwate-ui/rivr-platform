-- The re-check breaker trips once in a row for a reason (#1033; decision 0674). One refusal reason turning down three checks
-- in a run pauses every re-check, as Zoop refusing the account does. When the same reason trips again after that pause, it
-- pauses nothing: kyc-recheck counts the checks that tripped it and asks the checks behind them (three more turned down
-- alike in that run pause outright, through pause_kyc_rechecks, as @rivr/adapters' breaker tests show). A different
-- reason trips as before.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.alerts() returns integer language sql as $$
  select count(*)::integer from public.alert a where a.kind = 'kyc.recheck_paused' and a.venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.paused() returns boolean language sql as $$
  select exists (select 1 from private.kyc_recheck_pause p where p.paused_until > now());
$$;

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005f1', '00000000-0000-4000-8000-000000000001', 'Sameer Khan', '+919000051901');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, masked_aadhaar, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005f1', 'verified', 'manual', '1990-01-19',
        'ABCPK5191K', 'XXXX XXXX 5191',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000005f1/in-person-' || gen_random_uuid() || '.jpg', now());

select is(public.trip_kyc_recheck_breaker('00000000-0000-4000-8000-0000000005f1', 'Zoop unreadable'), true,
  'a reason turning down three checks pauses the re-checks');
select ok(pg_temp.paused(), 'for six hours');
select is(pg_temp.alerts(), 1, 'and the owner hears of it');
select is((select vendor_failure from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005f1'),
  'recheck: Zoop unreadable', 'with why noted on the check that tripped it');

update private.kyc_recheck_pause set paused_until = now() - interval '1 minute';
select is(public.trip_kyc_recheck_breaker('00000000-0000-4000-8000-0000000005f1', 'Zoop unreadable'), false,
  'the same reason tripping again once the pause ends pauses nothing');
select ok(not pg_temp.paused(), 'the re-checks go on');
select is(pg_temp.alerts(), 1, 'with no second alert');

select is(public.trip_kyc_recheck_breaker('00000000-0000-4000-8000-0000000005f1', 'Zoop 102'), true,
  'another reason trips as before');
select ok(pg_temp.paused(), 'and pauses them');

update private.kyc_recheck_pause set paused_until = now() - interval '2 days';
select is(public.trip_kyc_recheck_breaker('00000000-0000-4000-8000-0000000005f1', 'Zoop 102'), true,
  'the same reason days after its pause ended trips afresh');

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.trip_kyc_recheck_breaker('00000000-0000-4000-8000-0000000005f1', 'Zoop 106') $$, '42501', null,
  'only the scheduler trips it');
reset role;

select * from finish();
rollback;
