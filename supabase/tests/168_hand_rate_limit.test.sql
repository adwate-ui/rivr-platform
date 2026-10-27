-- Hand logging is rate-limited per table (#298, decision 0259). On a tablet fixed to Table 3 during Pema's down, the
-- table's 30th hand in a minute is logged and the 31st refused (RVFST), which the tablet's queue tries again later; a
-- replay of a hand already logged still returns it. 106 Pema is a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor is set aside, as in 037_log_hand: this test fixes its own tablet to Table 3.
delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';

-- Hands the seed logged at Table 3 within the minute count too, so the test logs up to 30 whatever they were.
create temporary table room on commit drop as
select 30 - count(*)::integer as hands from public.hand
where table_id = (select table_id from public.tablet_assignment where device_id = '00000000-0000-4000-8000-00000000d001')
  and created_at > now() - interval '1 minute';
grant select on room to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is((select count(public.log_hand(100000, 'holdem', now(), 'rate-hand-' || n)) from generate_series(1, (select hands from room)) n)::integer,
  (select hands from room), 'the table logs hands up to 30 in a minute');
select throws_ok($$ select public.log_hand(100000, 'holdem', now(), 'rate-hand-over') $$, 'RVFST', null,
  'the 31st new hand in the minute is refused, for the tablet to try again later');
select isnt(public.log_hand(100000, 'holdem', now(), 'rate-hand-1'), null, 'a replay of a hand already logged still returns it');
reset role;

select is((select count(*)::integer from public.hand where idempotency_key = 'rate-hand-over'), 0, 'and nothing of the refused hand is kept');

select * from finish();
rollback;
