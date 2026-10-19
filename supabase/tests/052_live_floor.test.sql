-- The live floor's night (#81). Pema (106) deals Table 3 on Tablet A; three hands tonight, two in the
-- last hour, and one last night. 103 is a floor manager (members.read, ledger.read); 108 a host
-- (members.read, no ledger); 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
-- The night is read as of 23:00 IST tonight, whatever the hour the tests run.
create temp table clock as select private.tonight_began(now()) + interval '17 hours' as at;
grant select on clock to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at)
select '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-000000000001', pg_temp.t('Table 3'), s.id,
       '00000000-0000-4000-8000-00000000d001', (select at from clock) - interval '2 days'
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, h.variant::public.hand_variant, h.pot, h.rake, 0, false, h.at, h.key
from public.dealer_down d
cross join (values
  ('holdem', 4800000::bigint, 240000::bigint, (select at from clock) - interval '1 day', 'last-night-1'),
  ('holdem', 1840000::bigint, 90000::bigint, (select at from clock) - interval '3 hours', 'tonight-1'),
  ('plo', 720000::bigint, 35000::bigint, (select at from clock) - interval '20 minutes', 'tonight-2'),
  ('holdem', 2680000::bigint, 130000::bigint, (select at from clock) - interval '5 minutes', 'tonight-3')
) as h (variant, pot, rake, at, key)
where d.id = '00000000-0000-4000-8000-00000000dd01' and h.at >= d.started_at;

-- The floor manager sees the night, rake and all.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select hands, hands_last_hour, dealer_name, rake_paise, rake_basis_points, rake_cap_paise
                     from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock)) where table_id = pg_temp.t('Table 3') $$,
  $$ values (3, 2, 'Pema Lepcha'::text, 255000::bigint, 500, 600000::bigint) $$,
  'Table 3: three hands tonight, two in the last hour, Pema dealing, ₹2,550 of rake; 5% to ₹6,000');
select results_eq($$ select hands, dealer_name, rake_paise from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock))
                     where table_id = pg_temp.t('Table 4') $$,
  $$ values (0, null::text, 0::bigint) $$, 'Table 4: closed, no dealer, nothing tonight');
select is((select distinct venue_rake_paise from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock))), 255000::bigint,
  'the venue''s rake tonight, last night''s hand left out');
select results_eq($$ select number, variant::text, pot_paise, rake_paise from private.table_hands(pg_temp.t('Table 3'), 2, (select at from clock)) $$,
  $$ values (3, 'holdem'::text, 2680000::bigint, 130000::bigint), (2, 'plo', 720000::bigint, 35000::bigint) $$,
  'the last two hands, latest first, numbered in the night');

-- A host sees the floor but no rake; a dealer and the practice venue's staff see nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select results_eq($$ select hands, rake_paise, venue_rake_paise from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock))
                     where table_id = pg_temp.t('Table 3') $$,
  $$ values (3, null::bigint, null::bigint) $$, 'a host sees the hands, not the rake');
select is((select count(*)::integer from private.table_hands(pg_temp.t('Table 3'), 5, (select at from clock))
            where rake_paise is not null or pot_paise is not null), 0, 'nor any hand''s rake, nor its pot, which with the rule would give it');
select is((select count(*)::integer from private.table_hands(pg_temp.t('Table 3'), 5, (select at from clock))), 3, 'but the hands themselves');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock)) $$, 'a dealer sees no floor');
select is_empty($$ select * from private.table_hands(pg_temp.t('Table 3'), 5, (select at from clock)) $$, 'nor its hands');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from private.floor_tonight('00000000-0000-4000-8000-000000000001', (select at from clock)) $$,
  'staff of the practice venue alone see none of the club''s floor');
select is_empty($$ select * from private.table_hands(pg_temp.t('Table 3'), 5, (select at from clock)) $$, 'nor its hands');
reset role;

-- The Private Room stands in its own room; the apps read the night as of now.
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.floor_tonight('00000000-0000-4000-8000-000000000001')), 6, 'the console reads all six tables now');
reset role;
select is((select room from public.game_table where id = pg_temp.t('Private Room')), 'private', 'the Private Room is a room of its own');
select is((select count(*)::integer from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and room = 'main'), 5,
  'the other five tables are in the main room');

select * from finish();
rollback;
