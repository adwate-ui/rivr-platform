-- Bonus on the door's and Players visits' rows a seat each (the owner, 19 Nov). Ritika (215) is given ₹1,000 by hand
-- today, sits at Table 1 with ₹300 of Bonus chips, then moves to Table 2 and redeems ₹200 there: each seat row has the
-- Bonus used at it, and the ₹1,000 given, which no seat holds, sits on her first row alone. 103 Aditya is an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table sess (id uuid) on commit drop;
create temporary table today_ on commit drop as select private.club_day_of(now()) as day;
grant all on sess, today_ to authenticated;

select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 100000,
  'Welcome', now() + interval '30 days', 'bonus.hand:561') $$, 'Ritika is given ₹1,000 by hand');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215') $$, 'is checked in');
select lives_ok($$ insert into sess select public.seat_member(
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6, '9000000215', null, null, 300) $$,
  'sits at Table 1 with ₹300 of Bonus chips');
select lives_ok($$ select public.move_seat((select id from sess),
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 3) $$, 'moves to Table 2');
reset role;
-- At Table 2, ₹200 more as she sits there: the floor redeems it as the seating's own.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated')::text, true);
select lives_ok($$ select private.redeem_bonus_at_seat((select id from sess), 200) $$, 'and redeems ₹200 there');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table door on commit drop as
select * from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') where member_id = '00000000-0000-4000-8000-000000000215';
select results_eq($$ select tables -> 0 ->> 'table', bonus_used_paise, bonus_paise from door order by tables -> 0 ->> 'table' $$,
  $$ values ('Table 1', 30000::bigint, 100000::bigint), ('Table 2', 20000::bigint, null::bigint) $$,
  'each seat has the Bonus used at it; the Bonus given is on her first row alone');

create temporary table visits on commit drop as
select * from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select day from today_), 'to', (select day from today_)), 'page_size', 1000))
where member_id = '00000000-0000-4000-8000-000000000215';
select results_eq($$ select tables -> 0 ->> 'table', bonus_used_paise, bonus_paise from visits order by tables -> 0 ->> 'table' $$,
  $$ values ('Table 1', 30000::bigint, 100000::bigint), ('Table 2', 20000::bigint, null::bigint) $$, 'and the same on Players visits');
select is((select sum(coalesce(bonus_paise, 0))::bigint from visits), 100000::bigint, 'her rows add up to the day''s Bonus given, counted once');
select is((select sum(bonus_used_paise)::bigint from visits), 50000::bigint, 'and to the Bonus she used');
select results_eq($$ select page.bonus_used_paise from public.door_page('00000000-0000-4000-8000-000000000001',
    '{"filters": {"player": {"kind": "text", "typed": "Ritika"}}, "sort": {"key": "bonus_used", "direction": "descending"}}') page $$,
  $$ values (30000::bigint), (20000::bigint) $$, 'Bonus used sorts on the server');
reset role;

select * from finish();
rollback;
