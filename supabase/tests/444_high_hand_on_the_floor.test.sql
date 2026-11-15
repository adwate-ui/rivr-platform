-- High hand on the Live floor (redesign RD-24): the strip reads the high hand that runs now and tonight's hits, for
-- everyone who sees the Live floor and those who manage promotions; a hit tells the floor's consoles to read again; and
-- Activity shows a hit with who logged it, the player, the table, the seat, the hand and its Bonus. 101 Vikram (super
-- admin), 103 Aditya (admin, the floor), 104 Sana (cashier), 106 Pema (dealer), 107 Ishita (marketing). Ishaan (211) sits
-- at Table 3.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
-- A super admin signed in with a code, as Activity is read.
create function pg_temp.as_super_admin() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000101', 'role', 'authenticated',
                                                             'amr', jsonb_build_array(jsonb_build_object('method', 'otp')))::text, true);
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name; $$;
create function pg_temp.table_3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.as_super_admin(), pg_temp.id(text), pg_temp.table_3() to authenticated;

-- 1. No high hand runs ---------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'with no high hand running, the floor reads none: no strip');
reset role;

-- The club's high hand bonus, live since last week: a royal flush 25,000, four of a kind 5,000.
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'High hand bonus') returning id)
insert into ids select 'promotion', id from p;
with v as (insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
           values ('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion'), 1, 'live', 'High hand bonus',
                   '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4},
                     "hands": [{"hand": "royal_flush", "chips": 25000}, {"hand": "four_of_a_kind", "chips": 5000}]}',
                   '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
                   jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 10)::text,
                                      'timezone', 'Asia/Kolkata'),
                   '{"perMember": "none", "budgetChips": 200000}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}')
           returning id)
insert into ids select 'version', id from v;
select private.sync_promotion(pg_temp.id('promotion'));
-- The practice venue runs one of its own.
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000002', 'Practice high hand') returning id)
insert into ids select 'practice', id from p;
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000002', pg_temp.id('practice'), 1, 'live', 'Practice high hand', v.reward, v.eligibility, v.schedule, v.limits, v.channels
from public.promotion_version v where v.id = pg_temp.id('version');

-- 2. The one that runs now -----------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select promotion_id, name, reward -> 'hands' -> 0 ->> 'hand', (reward -> 'rules' ->> 'minPlayersDealt')::integer
                     from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$,
  $$ select pg_temp.id('promotion'), 'High hand bonus'::text, 'royal_flush'::text, 4 $$,
  'the floor reads the high hand that runs now: its name, its hands and its rules');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'a cashier, who sees the Live floor, reads it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select isnt_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'marketing, who manage promotions, read it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'a dealer, who has no Live floor, reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'nor a member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000002') where name = 'High hand bonus' $$, 'the practice venue has none of the club''s');
select results_eq($$ select name from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, $$ values ('High hand bonus'::text) $$,
  'nor the club the practice venue''s own, which runs too');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'and staff of another venue alone read none of the club''s');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select private.reads_high_hands('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'who reads is asked by the reads alone, never by a person');
reset role;

-- 3. A hit: the floor's consoles are told, and Activity shows it ----------------------------------------------------------
select has_trigger('public', 'high_hand_hit', 'high_hand_hit_floor_signal', 'a hit logged tells the venue''s floor consoles to read again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat', public.seat_member(pg_temp.table_3(), 1, '9000000211');
insert into ids select 'jacks', public.log_high_hand(pg_temp.table_3(), '00000000-0000-4000-8000-000000000211', 'four_of_a_kind', 'jack',
  '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', '44400000-0000-4000-8000-000000000001');
select is((select paid_count::integer from public.high_hand_tonight('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion')) limit 1), 1,
  'the strip''s count has it');
select is_empty($$ select 1 from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 1000) $$, 'an admin reads no Activity, as before');

select pg_temp.as_super_admin();
select results_eq($$ select who, action, entity, kind, about, amount, high_hand
                     from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 1000)
                     where action = 'high_hand.pay' and about = (select m.full_name from public.member m where m.id = '00000000-0000-4000-8000-000000000211') $$,
  $$ select (select s.full_name from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
            'high_hand.pay'::text, 'high_hand_hit'::text, 'bonus_chips'::text,
            (select m.full_name from public.member m where m.id = '00000000-0000-4000-8000-000000000211'), 5000::bigint,
            '{"table": "Table 3", "seat": 1, "hand": "four_of_a_kind", "rank": "jack"}'::jsonb $$,
  'Activity shows the hit: who logged it, the player, the table, the seat, the hand and its Bonus');
select is((select count(*)::integer from public.activity_page('00000000-0000-4000-8000-000000000001', p_kind => 'bonus_chips', p_page_size => 1000)
           where action = 'high_hand.pay' and about = (select m.full_name from public.member m where m.id = '00000000-0000-4000-8000-000000000211')), 1,
  'it is found under Bonus');
select is_empty($$ select 1 from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 1000) where action <> 'high_hand.pay' and high_hand is not null $$,
  'no other line carries a high hand');
reset role;

-- A hand with no rank comes from the console as a blank.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'royal', public.log_high_hand(pg_temp.table_3(), '00000000-0000-4000-8000-000000000211', 'royal_flush', '',
  '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', '44400000-0000-4000-8000-000000000002');
select results_eq($$ select hand, rank, chips from public.high_hand_hit where id = pg_temp.id('royal') $$, $$ values ('royal_flush'::text, null::text, 25000::bigint) $$,
  'a royal flush logged with a blank rank is paid, its rank none');
reset role;

-- 4. Paused, it leaves the strip ------------------------------------------------------------------------------------------
update public.promotion_version set status = 'paused' where id = pg_temp.id('version');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_live('00000000-0000-4000-8000-000000000001') $$, 'paused, none runs now: no strip');
reset role;

select * from finish();
rollback;
