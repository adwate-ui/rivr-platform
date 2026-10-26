-- The owner dashboard (#101; decision 0192). Arjun (198, owner_view) reads the club's dashboard: tonight's
-- rake and hands, the tables running and the room, the cash position, the latest alerts and fourteen nights.
-- A hand logged and an alert raised signal the club's private owner topic, which he hears and the front desk
-- (190) does not. Vikram (101, a super admin at both venues) is refused the practice venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A hand tonight at Table 5, and an alert.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e124', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001241');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d124', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet O', '00000000-0000-4000-8000-00000000e124');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c124', '00000000-0000-4000-8000-000000000001', g.id, s.id, '00000000-0000-4000-8000-00000000d124',
       now() - interval '5 minutes', now() + interval '1 hour'
from public.staff s cross join public.game_table g
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001'
  and g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 5';
-- What Arjun's dashboard showed before them (his claims set; a temporary table is the database owner's to make).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000198", "role": "authenticated"}', true);
create temporary table before as select private.owner_snapshot('00000000-0000-4000-8000-000000000001') as snapshot;
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'holdem', 1000000, 50000, 0, false, now(), 'owner-dashboard-hand'
from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c124';
select private.raise_alert('00000000-0000-4000-8000-000000000001', 'eod.variance', '{}');

-- Who may.
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.owner_snapshot('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'the front desk reads no owner dashboard');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.owner_snapshot('00000000-0000-4000-8000-000000000002') $$, '22023', null, 'the practice venue has none');

-- What it shows.
-- Read with Arjun's claims set (a temporary table is the database owner's to make).
select pg_temp.as_person('00000000-0000-4000-8000-000000000198');
reset role;
create temporary table now_shown as select private.owner_snapshot('00000000-0000-4000-8000-000000000001') as snapshot;
select is((select (snapshot ->> 'rake_tonight_paise')::bigint - (select (snapshot ->> 'rake_tonight_paise')::bigint from before) from now_shown),
  50000::bigint, 'tonight''s rake counts the hand just logged');
select is((select (snapshot ->> 'hands_tonight')::integer - (select (snapshot ->> 'hands_tonight')::integer from before) from now_shown), 1, 'and its hand');
select is((select (snapshot ->> 'tables_open')::integer from now_shown),
  (select count(*)::integer from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and is_open), 'the tables running');
select is((select (snapshot ->> 'seated')::integer from now_shown),
  (select count(*)::integer from public.seat_session where venue_id = '00000000-0000-4000-8000-000000000001' and ended_at is null), 'who is seated');
select is((select snapshot -> 'alerts' -> 0 ->> 'kind' from now_shown), 'eod.variance', 'the latest alert first, by its kind');
select ok((select not (snapshot -> 'alerts' -> 0 ? 'detail') from now_shown), 'never its details');
select is((select jsonb_array_length(snapshot -> 'nights') from now_shown), 14, 'fourteen nights');
select is((select snapshot -> 'nights' -> 13 ->> 'day' from now_shown), (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date::text,
  'tonight last');
select ok((select jsonb_array_length(snapshot -> 'cash') > 0 from now_shown), 'and the cash position by account');
select results_eq($$ select (snapshot ->> 'players_money_paise')::bigint, (snapshot ->> 'chips_out_paise')::bigint from now_shown $$,
  $$ select wallets_paise, chips_in_play_paise from private.treasury('00000000-0000-4000-8000-000000000001') $$,
  'what the club holds for players, as the treasury works it out');

-- Live: the club's private topic, heard by its owner only.
reset role;
select ok((select count(*) > 0 from realtime.messages where topic = 'owner:00000000-0000-4000-8000-000000000001' and event = 'changed'),
  'the hand and the alert signal the club''s owner topic');
create function pg_temp.signals() returns integer language sql as $$
  select count(*)::integer from realtime.messages where topic = 'owner:00000000-0000-4000-8000-000000000001' and event = 'changed';
$$;
create temporary table counted as select pg_temp.signals() as n;
update public.game_table set is_open = not is_open where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 4';
select ok(pg_temp.signals() > (select n from counted), 'a table opened or closed signals it'); update counted set n = pg_temp.signals();
insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', now());
select ok(pg_temp.signals() > (select n from counted), 'a visit opened'); update counted set n = pg_temp.signals();
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', v.id, g.id, 9, now(), now()
from public.visit v, public.game_table g
where v.member_id = '00000000-0000-4000-8000-000000000296' and v.closed_at is null and g.venue_id = v.venue_id and g.name = 'Table 5';
select ok(pg_temp.signals() > (select n from counted), 'a seat taken'); update counted set n = pg_temp.signals();
update public.seat_session set ended_at = now(), end_reason = 'left' where member_id = '00000000-0000-4000-8000-000000000296' and ended_at is null;
select ok(pg_temp.signals() > (select n from counted), 'a seat left'); update counted set n = pg_temp.signals();
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000296' and closed_at is null;
select ok(pg_temp.signals() > (select n from counted), 'a visit closed'); update counted set n = pg_temp.signals();
with posted as (
  insert into public.ledger_transaction (venue_id, kind, idempotency_key) values ('00000000-0000-4000-8000-000000000001', 'test', 'owner-dashboard-posting')
  returning id
)
insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
select '00000000-0000-4000-8000-000000000001', posted.id, a.id, case a.code when 'venue.cash_drawer' then 5000 else -5000 end
from posted, public.ledger_account a
where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.member_id is null and a.code in ('venue.cash_drawer', 'venue.bank');
select ok(pg_temp.signals() > (select n from counted), 'and money posted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000198');
select set_config('realtime.topic', 'owner:00000000-0000-4000-8000-000000000001', true);
select ok((select count(*) > 0 from realtime.messages where extension = 'broadcast'), 'Arjun hears it');
select set_config('realtime.topic', 'owner:not-a-venue', true);
select is_empty($$ select * from realtime.messages $$, 'a topic that names no venue is heard by nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select set_config('realtime.topic', 'owner:00000000-0000-4000-8000-000000000001', true);
select is_empty($$ select * from realtime.messages $$, 'the front desk does not');

select * from finish();
rollback;
