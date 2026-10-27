-- Hand logging is limited per table and minute of play (#298, decision 0259). On a tablet fixed to Table 3 during
-- Pema's down, 20 hands played at one moment are logged and a 21st within 30 seconds of them is refused (RVFST), one
-- 31 seconds away is not; a hand played two minutes
-- before them, as an offline replay brings it, is logged; and a replay of a hand already logged still returns it.
-- 106 Pema is a dealer.
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
-- The down began an hour ago, so a hand played earlier in it can be logged.
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select a.venue_id, a.table_id, s.id, a.device_id, now() - interval '1 hour'
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';

-- Hands the seed logged at Table 3 in this minute count too, so the test logs up to 20 whatever they were.
create temporary table room on commit drop as
select 20 - count(*)::integer as hands from public.hand
where table_id = (select table_id from public.tablet_assignment where device_id = '00000000-0000-4000-8000-00000000d001')
  and played_at between now() - interval '30 seconds' and now() + interval '30 seconds';
grant select on room to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is((select count(public.log_hand(100000, 'holdem', now(), 'rate-hand-' || n)) from generate_series(1, (select hands from room)) n)::integer,
  (select hands from room), 'the table logs 20 hands played in the same minute');
select throws_ok($$ select public.log_hand(100000, 'holdem', now(), 'rate-hand-over') $$, 'RVFST', null,
  'a 21st played in that minute is refused: no table plays that fast');
select throws_ok($$ select public.log_hand(100000, 'holdem', now() + interval '29 seconds', 'rate-hand-29s') $$, 'RVFST', null,
  'so is one played 29 seconds after them');
select isnt(public.log_hand(100000, 'holdem', now() + interval '31 seconds', 'rate-hand-31s'), null,
  'one played 31 seconds after them is logged: they are more than 30 seconds away');
select isnt(public.log_hand(100000, 'holdem', now() - interval '2 minutes', 'rate-hand-replayed'), null,
  'a hand played two minutes before, as an offline replay brings it, is logged');
select isnt(public.log_hand(100000, 'holdem', now(), 'rate-hand-1'), null, 'a replay of a hand already logged still returns it');
reset role;

select is((select count(*)::integer from public.hand where idempotency_key = 'rate-hand-over'), 0, 'and nothing of the refused hand is kept');

select * from finish();
rollback;
