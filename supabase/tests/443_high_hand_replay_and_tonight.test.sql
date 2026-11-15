-- The high hand in the builder (redesign RD-23): last week's hits are replayed for a version's simulation, and tonight's
-- hits are read for a promotion's record by staff who seat players or manage promotions, and by nobody else. 103 Aditya
-- (admin, the floor), 106 Pema (dealer), 107 Ishita (marketing). Ishaan (211) and Kunal (216) sit at Table 3.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name; $$;
create function pg_temp.table_3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
create function pg_temp.log(p_member text, p_hand text, p_rank text, p_request text) returns uuid language sql as $$
  select public.log_high_hand(pg_temp.table_3(), ('00000000-0000-4000-8000-000000000' || p_member)::uuid, p_hand, p_rank,
                              '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', ('44300000-0000-4000-8000-0000000000' || p_request)::uuid);
$$;
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.id(text), pg_temp.table_3(), pg_temp.log(text, text, text, text) to authenticated;

-- The club's high hand bonus, live since last week: a royal flush 25,000, four of a kind 5,000, any full house 1,000.
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'High hand bonus') returning id)
insert into ids select 'promotion', id from p;
with v as (insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
           values ('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion'), 1, 'live', 'High hand bonus',
                   '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4},
                     "hands": [{"hand": "royal_flush", "chips": 25000}, {"hand": "four_of_a_kind", "chips": 5000}, {"hand": "full_house", "chips": 1000}]}',
                   '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
                   jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 10)::text,
                                      'timezone', 'Asia/Kolkata'),
                   '{"perMember": "none", "budgetChips": 200000}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}')
           returning id)
insert into ids select 'version', id from v;
select private.sync_promotion(pg_temp.id('promotion'));

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat ' || s.phone, public.seat_member(pg_temp.table_3(), s.seat, s.phone) from (values (1, '9000000211'), (4, '9000000216')) as s (seat, phone);
insert into ids select 'jacks', pg_temp.log('211', 'four_of_a_kind', 'jack', '01');
insert into ids select 'kings', pg_temp.log('216', 'full_house', 'king', '02');
insert into ids select 'royal', pg_temp.log('216', 'royal_flush', null, '03');
reset role;
-- Kunal's royal flush was three nights ago, Ishaan's four jacks a minute ago, Kunal's kings full just now.
update public.high_hand_hit set created_at = now() - interval '3 days' where id = pg_temp.id('royal');
update public.high_hand_hit set created_at = now() - interval '1 minute' where id = pg_temp.id('jacks');

-- 1. Tonight -------------------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select member_name, table_name, seat, hand, rank, chips, logged_by, paid_count, paid_chips
                     from public.high_hand_tonight('00000000-0000-4000-8000-000000000001') $$,
  $$ select m.full_name, 'Table 3'::text, x.seat, x.hand, x.rank, x.chips, (select s.full_name from public.staff s
              where s.user_id = '00000000-0000-4000-8000-000000000103' and s.venue_id = '00000000-0000-4000-8000-000000000001'), 2::bigint, 6000::bigint
     from (values (1, '00000000-0000-4000-8000-000000000216'::uuid, 4, 'full_house', 'king', 1000::bigint),
                  (2, '00000000-0000-4000-8000-000000000211'::uuid, 1, 'four_of_a_kind', 'jack', 5000::bigint)) as x (n, member_id, seat, hand, rank, chips)
     join public.member m on m.id = x.member_id order by x.n $$,
  'the floor reads tonight''s hits, the newest first: who, where, the hand, its Bonus and who logged it, with the night''s totals');
select results_eq($$ select hand, paid_count, paid_chips from public.high_hand_tonight('00000000-0000-4000-8000-000000000001', p_limit => 1) $$,
  $$ values ('full_house'::text, 2::bigint, 6000::bigint) $$, 'a list cut to one row still carries the whole night''s totals');
-- A promotion's record reads its own hits: an ended one never shows those of the one that runs now.
select is((select count(*)::integer from public.high_hand_tonight('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion'))), 2,
  'asked for one promotion, its hits of tonight');
select is_empty($$ select 1 from public.high_hand_tonight('00000000-0000-4000-8000-000000000001', pg_temp.id('version')) $$,
  'and none of them for any other id');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.high_hand_tonight('00000000-0000-4000-8000-000000000001')), 2, 'marketing, who manage promotions, read them too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.high_hand_tonight('00000000-0000-4000-8000-000000000001') $$, 'a dealer reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.high_hand_tonight('00000000-0000-4000-8000-000000000001') $$, 'nor a member, his own included');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_tonight('00000000-0000-4000-8000-000000000002') $$, 'the practice venue has none of the club''s');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.high_hand_tonight('00000000-0000-4000-8000-000000000001') $$, 'and staff of the practice venue alone read none of the club''s');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';

-- 2. Last week, replayed --------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
create temporary table replay on commit drop as select public.promotion_version_replay(pg_temp.id('version')) as body;
reset role;
select results_eq($$ select e -> 'event' ->> 'kind', e -> 'event' ->> 'hand', e -> 'event' -> 'rank', e -> 'event' -> 'confirmed', e -> 'event' ->> 'stake',
                            e -> 'event' ->> 'tableId' = pg_temp.table_3()::text
                     from replay, jsonb_array_elements(body -> 'events') e $$,
  $$ values ('high_hand'::text, 'royal_flush'::text, 'null'::jsonb, '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}'::jsonb,
             'nlh_100_200'::text, true) $$,
  'last week''s replay of a high hand version is the hits logged in it: the hand, its rank, each rule confirmed, and the table; tonight''s are not in it');
select is((select (private.promo_grant(v.reward, e -> 'event')).o_chips from replay, jsonb_array_elements(body -> 'events') e, public.promotion_version v
           where v.id = pg_temp.id('version')), 25000::bigint, 'and weighs as the version''s own hands pay it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.promotion_version_replay(pg_temp.id('version')) $$, '42501', null, 'a dealer replays nothing');
reset role;

select * from finish();
rollback;
