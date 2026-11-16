-- Reports › Players lists every visit in its span (decision 0682): one row for each member each club day, with that day's
-- check-in and check-out, wait, tables and time played, a page at a time; only for staff who read reports, never the
-- practice venue. Yash (214) came yesterday, 20:00 to 23:00 IST; Ritika (215) is checked in and played at Table 1 today.
-- 103 Aditya is an admin (reports), 108 Karan a host (no reports).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Today and yesterday, as club days (06:00 to 06:00 IST).
create temporary table days on commit drop as
select (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date as today,
       (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date - 1 as yesterday;
grant select on days to authenticated;

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214',
       (yesterday + time '20:00') at time zone 'Asia/Kolkata', (yesterday + time '23:00') at time zone 'Asia/Kolkata', 'door'
from days;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215') $$, 'Ritika is checked in today');
select lives_ok($$ select public.end_seat(public.seat_member(
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6, '9000000215'), 'left') $$,
  'and plays at Table 1');

create temporary table page on commit drop as
select * from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days), 'to', (select today from days)), 'page_size', 1000));
select is((select count(*)::int from page where member_id = '00000000-0000-4000-8000-000000000214'), 1, 'Yash''s visit is one row');
select results_eq($$ select club_day, checked_in_at, checked_out_at from page where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ select yesterday, (yesterday + time '20:00') at time zone 'Asia/Kolkata', (yesterday + time '23:00') at time zone 'Asia/Kolkata' from days $$,
  'on its own club day, with its check-in and check-out');
select results_eq($$ select club_day, tables -> 0 ->> 'table' from page where member_id = '00000000-0000-4000-8000-000000000215' $$,
  $$ select today, 'Table 1'::text from days $$, 'Ritika''s is today''s, with the table she played');
select ok((select bool_and(total = (select count(*) from page)) from page), 'the page says how many rows the view leaves');
select is((select club_day from page limit 1), (select today from days), 'newest day first');
select is_empty($$ select * from page where checked_in_at is null and jsonb_array_length(tables) = 0 $$,
  'one on a list from the app who never came in is no visit');
select results_eq($$ select is_base_tier from page where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ select t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired)
     from public.member m join public.tier t on t.id = m.tier_id where m.id = '00000000-0000-4000-8000-000000000214' $$,
  'with whether the tier is the club''s lowest, which the table leaves unsaid as the door does');

-- The span: whole dates only, 92 club days at most from its first.
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  '{"scope": {"from": "infinity", "to": "infinity"}}')), 0, 'a span that is not a date has no days, and ends at once');
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days)::text || 'T00:00', 'to', (select today from days))))), 0,
  'nor one with a time');
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select today - 119 from days), 'to', (select today from days)), 'page_size', 1000))
  where club_day > (select today - 119 + 91 from days)), 0, 'a longer span stops 92 club days after its first');
select is((select count(*)::int from public.player_visits_page((select id from public.venue where is_practice limit 1),
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days), 'to', (select today from days))))), 0,
  'the practice venue has none');

select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days), 'to', (select yesterday from days)), 'page_size', 1000))
  where member_id = '00000000-0000-4000-8000-000000000215'), 0, 'a span of yesterday alone leaves today''s visit out');
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001', '{}')), 0, 'no span, no visits');
select ok((select count(*) from public.list_choices('player_visits', '00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days), 'to', (select today from days))))) > 0,
  'its tier and identity menus are counted');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::int from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select yesterday from days), 'to', (select today from days))))), 0,
  'a host, who reads no reports, sees none');
reset role;

set local role anon;
select throws_ok($$ select * from public.player_visits_page('00000000-0000-4000-8000-000000000001', '{}') $$, '42501', null, 'a visitor sees nothing');
reset role;

select * from finish();
rollback;
