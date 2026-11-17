-- Who gave Bonus and why (#1063): Reports > Bonus lists each grant in its span with where it came from and who gave it,
-- for staff who read reports, never the practice venue. 103 Aditya is an admin (reports, Bonus by hand); 108 Karan a host
-- (no reports). Ritika (215) is given Bonus by hand and a rakeback.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- Today's club day as a report's span, worked out before any role is taken.
create temp table today_view on commit drop as
select jsonb_build_object('scope', jsonb_build_object('from', d, 'to', d), 'page_size', 1000) as v
from (select (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date as d) t;
create function pg_temp.view_today() returns jsonb language sql as $$ select v from today_view $$;
grant select on today_view to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.view_today() to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.give_bonus_chips('00000000-0000-4000-8000-000000000215', 500, 'Good game tonight', gen_random_uuid()) $$,
  'Aditya gives Ritika 500 Bonus by hand');
reset role;
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 20000, 'Rakeback', null, 'rakeback:t529');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table given on commit drop as
select * from public.bonus_given_page('00000000-0000-4000-8000-000000000001', pg_temp.view_today())
where member_id = '00000000-0000-4000-8000-000000000215';
reset role;
select results_eq($$ select source, staff_name, amount_paise, reason from given order by given_at, amount_paise desc $$,
  $$ values ('by_hand'::text, 'Aditya Malhotra'::text, 50000::bigint, 'Good game tonight'::text), ('other', null, 20000, 'Rakeback') $$,
  'Bonus by hand names who gave it and why; anything else says only why');
select ok((select bool_and(total >= 2) from given), 'the page says how many the view leaves');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::int from public.bonus_given_page('00000000-0000-4000-8000-000000000001',
  pg_temp.view_today() || '{"filters": {"source": {"kind": "choice", "chosen": ["by_hand"]}}}') where member_id = '00000000-0000-4000-8000-000000000215'), 1,
  'it narrows to one source on the server');
select is((select count(*)::int from public.bonus_given_page('00000000-0000-4000-8000-000000000001',
  '{"scope": {"from": "infinity", "to": "infinity"}}')), 0, 'a span that is not a date lists nothing');
select is((select count(*)::int from public.bonus_given_page((select id from public.venue where is_practice limit 1), pg_temp.view_today())), 0,
  'never the practice venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::int from public.bonus_given_page('00000000-0000-4000-8000-000000000001', pg_temp.view_today())), 0,
  'a host, who reads no reports, sees none');
reset role;

-- A promotion's Bonus names the super admin who approved it; a high hand's, who logged it. Only this test's promotions run.
update public.promotion_version set status = 'ended' where status = 'live';
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Hours 529') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Hours 529',
       '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'High hand 529') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'High hand 529',
       '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4}, "hands": [{"hand": "royal_flush", "chips": 25000}]}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "none", "budgetChips": 50000}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.name in ('Hours 529', 'High hand 529');
-- Ritika sat at Table 1 for 70 minutes: her hour's 500 waits, and the super admin approves it.
insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000529a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', now() - interval '75 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-0000000529a1', t.id, 9,
       now() - interval '75 minutes', now() - interval '75 minutes', now() - interval '5 minutes', 'left', 0
from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 1';
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000529a1', now());
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                     array(select g.id from public.promotion_grant g where g.member_id = '00000000-0000-4000-8000-000000000215' and g.status = 'waiting'), gen_random_uuid()) $$,
  'Vikram approves Ritika''s play-time Bonus');
-- Ishaan, seated at Table 3, hits a royal flush, which Aditya logs.
reset role;
insert into public.visit (id, venue_id, member_id, opened_at)
select '00000000-0000-4000-8000-0000000529a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '40 minutes'
where not exists (select 1 from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000211' and v.closed_at is null);
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       (select v.id from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000211' and v.closed_at is null), t.id,
       (select min(n) from generate_series(1, t.seats) n where not exists (select 1 from public.seat_session s where s.table_id = t.id and s.seat = n and s.ended_at is null)),
       now() - interval '30 minutes', now() - interval '30 minutes', 0
from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 3';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.log_high_hand((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'),
                     '00000000-0000-4000-8000-000000000211', 'royal_flush', null, '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', gen_random_uuid()) $$,
  'Aditya logs Ishaan''s royal flush');
create temp table paid on commit drop as
select source, promotion_name, staff_name from public.bonus_given_page('00000000-0000-4000-8000-000000000001', pg_temp.view_today())
where source in ('promotion', 'high_hand');
reset role;
select results_eq($$ select * from paid order by source $$,
  $$ values ('high_hand'::text, 'High hand 529'::text, 'Aditya Malhotra'::text),
            ('promotion', 'Hours 529', (select s.full_name from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101'
                                         and s.venue_id = '00000000-0000-4000-8000-000000000001')) $$,
  'a promotion''s Bonus names the super admin who approved it, a high hand''s who logged it');

select * from finish();
rollback;
