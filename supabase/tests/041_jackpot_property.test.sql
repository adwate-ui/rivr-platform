-- The pool on the TV equals the drops less the payouts, to the rupee (#48 acceptance; scope-v1
-- module 8). A property run: from a fixed seed, 60 hands of random pots (₹50 to ₹2,00,000 in whole
-- chips) are logged over two settings of the shares; every 15th hand a bad beat is paid on the pool
-- as it stands, and every 30th the last payout is reversed. Then each pool public_jackpot gives is
-- worked out again, independently of the ledger: its seed, plus its share of every hand's drop
-- (private.split_drop on the shares in force when the hand was played), less every payout, plus
-- every reversal.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table seed_pools on commit drop as
select main_paise, season_paise, freeroll_paise from public.public_jackpot;
create temporary table run (step integer, hand_id uuid, payout_id uuid, reversal_id uuid) on commit drop;
grant select, insert, update on run to authenticated;

-- Tablet A at Table 3, during Pema's down from three hours ago; shares of 10% and 5% from three
-- hours ago, then 20% and 10% from ninety minutes ago.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select a.venue_id, a.table_id, s.id, a.device_id, now() - interval '3 hours'
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'jackpot.shares', '', '{"season_basis_points": 1000, "freeroll_basis_points": 500}',
   now() - interval '3 hours', 'Test'),
  ('00000000-0000-4000-8000-000000000001', 'jackpot.shares', '', '{"season_basis_points": 2000, "freeroll_basis_points": 1000}',
   now() - interval '90 minutes', 'Test');

do $$
declare
  v_step integer;
  v_pot bigint;
  v_preview record;
  v_payout uuid;
begin
  perform setseed(0.48);
  for v_step in 1..60 loop
    -- A pot of 1 to 4,000 chips, played a few minutes apart across the three hours.
    v_pot := (1 + floor(random() * 4000))::bigint * 5000;
    perform pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
    insert into run (step, hand_id)
    values (v_step, public.log_hand(v_pot, 'holdem', now() - interval '3 hours' + v_step * interval '2 minutes 50 seconds', 'property-hand-' || v_step));
    perform set_config('role', 'postgres', true);
    if v_step % 15 = 0 then
      -- What the console would show on the pool now, under the seeded rule, with two others dealt in.
      select * into v_preview from private.bad_beat_payout(private.main_pool('00000000-0000-4000-8000-000000000001'), 10000, 5000, 2500, 2500, 2);
      perform pg_temp.as_person('00000000-0000-4000-8000-000000000103');
      v_payout := public.pay_bad_beat('00000000-0000-4000-8000-000000000001',
        (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'),
        '+919000000201', '+919000000202', array['+919000000203', '+919000000204'], v_preview.total, 'property-payout-' || v_step);
      update run set payout_id = v_payout where step = v_step;
      if v_step % 30 = 0 then
        update run set reversal_id = public.reverse_jackpot_event(v_payout, 'Property run', 'property-reversal-' || v_step) where step = v_step;
      end if;
      perform set_config('role', 'postgres', true);
    end if;
  end loop;
end;
$$;
reset role;

-- Each hand's drop, split by the shares in force when it was played.
create temporary table expected_drops on commit drop as
select x.shares, s.main, s.season, s.freeroll
from run r
join public.hand h on h.id = r.hand_id
cross join lateral (select private.setting_at(h.venue_id, 'jackpot.shares', '', h.played_at) as shares) x
cross join lateral private.split_drop(h.drop_paise, coalesce((x.shares ->> 'season_basis_points')::integer, 0),
                                      coalesce((x.shares ->> 'freeroll_basis_points')::integer, 0)) s;

select is((select count(*)::integer from run), 60, 'sixty hands were logged');
select is((select count(*)::integer from run where payout_id is not null), 4, 'four bad beats were paid');
select is((select count(*)::integer from run where reversal_id is not null), 2, 'and two of them reversed');
select is((select count(distinct shares)::integer from expected_drops), 2, 'the drops were split by both settings of the shares');
select results_eq(
  $$ select main_paise, season_paise, freeroll_paise from public.public_jackpot $$,
  $$ select (p.main_paise + (select sum(main) from expected_drops)
               - (select coalesce(sum(e.total_paise), 0) from public.jackpot_event e where e.kind = 'payout')
               + (select coalesce(sum(e.total_paise), 0) from public.jackpot_event e where e.kind = 'reversal'))::bigint,
            (p.season_paise + (select sum(season) from expected_drops))::bigint,
            (p.freeroll_paise + (select sum(freeroll) from expected_drops))::bigint
     from seed_pools p $$,
  'each pool on the TV is its seed, plus its share of every drop, less every payout, plus every reversal');
select is((select sum(main + season + freeroll) from expected_drops), (select sum(drop_paise) from public.hand),
  'and the three shares of every drop add up to the drop');
select ok((select bool_and(e.total_paise <= e.pool_paise) from public.jackpot_event e where e.kind = 'payout'),
  'no payout was more than the pool held');

select * from finish();
rollback;
