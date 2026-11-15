-- The high hand for the member and on the TV (redesign RD-25): the member's offers hold the high hand that runs at their
-- club; a payout's line in their Bonus history carries its hand; and a TV reads the hands, the rules and tonight's payouts
-- of its own venue, a member by first name and initial or, hidden, by number. 103 Aditya (admin, the floor). Ishaan
-- Verma (211) sits at Table 3; Asha (301) is a member of the practice venue.
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
-- Ishaan's member number, which a TV cannot read for itself.
create temporary table ishaan on commit drop as select member_number from public.member where id = '00000000-0000-4000-8000-000000000211';
grant select, insert on ids to authenticated;
grant select on ishaan to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.id(text), pg_temp.table_3() to authenticated;

-- A TV at the club, one at the practice venue, and a tablet, each with its own login.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e451', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000451'),
  ('00000000-0000-4000-8000-00000000e452', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000452'),
  ('00000000-0000-4000-8000-00000000e453', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000453');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d451', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e451'),
  ('00000000-0000-4000-8000-00000000d452', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV', '00000000-0000-4000-8000-00000000e452'),
  ('00000000-0000-4000-8000-00000000d453', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet', '00000000-0000-4000-8000-00000000e453');
-- Each shows the waitlist and turns to the High hand bonus board in between.
insert into public.tv_screen (device_id, venue_id, mode, rotation) values
  ('00000000-0000-4000-8000-00000000d451', '00000000-0000-4000-8000-000000000001', 'waitlist', '{high_hand}'),
  ('00000000-0000-4000-8000-00000000d452', '00000000-0000-4000-8000-000000000002', 'waitlist', '{high_hand}');

-- 1. No high hand runs ---------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.my_high_hand() $$, 'with no high hand running, a member''s offers have none');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'nor a TV a board to show');
reset role;

-- The club's high hand bonus, live since last week, on the app and the TVs: a royal flush 25,000, four of a kind 5,000.
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'High hand bonus', 'draft') returning id)
insert into ids select 'promotion', id from p;
with v as (insert into public.promotion_version (venue_id, promotion_id, version, status, name, detail, reward, eligibility, schedule, limits, channels)
           values ('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion'), 1, 'live', 'High hand bonus', 'Up to 25,000 Bonus a hand',
                   '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4},
                     "hands": [{"hand": "royal_flush", "chips": 25000}, {"hand": "four_of_a_kind", "chips": 5000}]}',
                   '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
                   jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 10)::text,
                                      'timezone', 'Asia/Kolkata'),
                   '{"perMember": "none", "budgetChips": 200000}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}')
           returning id)
insert into ids select 'version', id from v;
select private.sync_promotion(pg_temp.id('promotion'));

-- 2. The member's offers ---------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select promotion_id, name, reward -> 'hands' -> 1 ->> 'hand', (reward -> 'hands' -> 1 ->> 'chips')::integer from public.my_high_hand() $$,
  $$ select pg_temp.id('promotion'), 'High hand bonus'::text, 'four_of_a_kind'::text, 5000 $$,
  'a member reads the high hand that runs at their club, with its hands and their Bonus');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select 1 from public.my_high_hand() $$, 'a member of the practice venue reads none of the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.my_high_hand() $$, 'nor staff, who are no member');
reset role;
-- Off the app's channel, or with the member's tier without the offers, it is no offer.
update public.promotion_version set channels = channels || '{"playerApp": false}' where id = pg_temp.id('version');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.my_high_hand() $$, 'not shown in the app, it is not among the offers');
reset role;
update public.promotion_version set channels = channels || '{"playerApp": true}' where id = pg_temp.id('version');
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select m.venue_id, m.tier_id, 'promotions.feed', false, 'locked', now() from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.my_high_hand() $$, 'nor for a member whose tier has no offers');
reset role;
delete from public.tier_feature f using public.member m
where m.id = '00000000-0000-4000-8000-000000000211' and f.tier_id = m.tier_id and f.feature_key = 'promotions.feed' and not f.is_enabled;

-- 3. A payout: the member's history names the hand --------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat', public.seat_member(pg_temp.table_3(), 1, '9000000211');
insert into ids select 'jacks', public.log_high_hand(pg_temp.table_3(), '00000000-0000-4000-8000-000000000211', 'four_of_a_kind', 'jack',
  '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', '44500000-0000-4000-8000-000000000001');
insert into ids select 'by hand', public.give_bonus_chips('00000000-0000-4000-8000-000000000211', 500, 'Long wait', '44500000-0000-4000-8000-000000000002');
reset role;
update public.bonus_grant set created_at = now() - interval '1 minute' where id = (select h.bonus_grant_id from public.high_hand_hit h where h.id = pg_temp.id('jacks'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select kind, amount_paise, reason, hand, rank from public.my_bonus_history(2) $$,
  $$ values ('credited'::text, 50000::bigint, 'Long wait'::text, null::text, null::text), ('credited', 500000, 'High hand bonus', 'four_of_a_kind', 'jack') $$,
  'the member''s history has the payout with its hand and rank, and any other line with none, the newest first');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select 1 from public.my_bonus_history() where hand is not null $$, 'another member reads none of it');
reset role;

-- 4. The TV's board -------------------------------------------------------------------------------------------------------
select has_trigger('public', 'high_hand_hit', 'high_hand_hit_signal_tv', 'a payout tells the venue''s TVs to read the board again');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select results_eq($$ select name, reward -> 'hands' -> 0 ->> 'hand', (reward -> 'rules' ->> 'minPlayersDealt')::integer, jsonb_array_length(payouts) from public.tv_high_hand() $$,
  $$ values ('High hand bonus'::text, 'royal_flush'::text, 4, 1) $$, 'a TV reads the high hand that runs at its venue: its hands, its rules and tonight''s payouts');
select results_eq($$ select p ->> 'name', p -> 'member_number', p ->> 'hand', p ->> 'rank', p ->> 'table', (p ->> 'chips')::integer
                     from public.tv_high_hand() b cross join lateral jsonb_array_elements(b.payouts) p $$,
  $$ values ('Ishaan V.'::text, 'null'::jsonb, 'four_of_a_kind'::text, 'jack'::text, 'Table 3'::text, 5000) $$,
  'a payout shows the member by first name and initial, the hand, the table and the Bonus');
reset role;
-- Only a TV that shows the board reads it: one that does not turn to it, or whose venue switched the board off, reads none.
update public.tv_screen set rotation = '{}' where device_id = '00000000-0000-4000-8000-00000000d451';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'a TV that does not show the board reads none of it');
reset role;
update public.tv_screen set mode = 'high_hand' where device_id = '00000000-0000-4000-8000-00000000d451';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tv.boards', '',
        '{"waitlist": true, "call_time": true, "promotions": true, "leaderboard": true, "high_hand": false}', now() - interval '1 second', 'test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'nor one whose venue switched the board off');
reset role;
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'tv.boards' and reason = 'test';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is((select jsonb_array_length(payouts) from public.tv_high_hand()), 1, 'with the board as its own, the TV reads it again');
reset role;
-- A member who hid their name on the TVs is shown by number, as the hours leaderboard shows them.
insert into public.member_preference (member_id, venue_id, name_on_tvs) values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', false)
on conflict (member_id) do update set name_on_tvs = false;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select results_eq($$ select p -> 'name', (p ->> 'member_number')::bigint from public.tv_high_hand() b cross join lateral jsonb_array_elements(b.payouts) p $$,
  $$ select 'null'::jsonb, member_number from ishaan $$,
  'hidden from the TVs, they are a member number and no name');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e452');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'the practice venue''s TV reads none of the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e453');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'a tablet is no TV');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'nor staff');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'nor a member');
reset role;
select throws_ok($$ insert into public.high_hand_hit (venue_id, promotion_id, promotion_version_id, promotion_grant_id, bonus_grant_id, member_id, table_id, session_id, seat, hand, rank, chips, request_id, logged_by_staff_id)
                    select venue_id, promotion_id, promotion_version_id, promotion_grant_id, bonus_grant_id, member_id, table_id, session_id, seat, hand, rank, chips, gen_random_uuid(), logged_by_staff_id
                    from public.high_hand_hit where id = pg_temp.id('jacks') $$, '23505', null, 'two hits never share a Bonus grant, so a history line names one hand');
-- An earlier night's payout is off the board, and off the TVs' channel there is no board.
update public.high_hand_hit set created_at = now() - interval '2 days' where id = pg_temp.id('jacks');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is((select jsonb_array_length(payouts) from public.tv_high_hand()), 0, 'a payout of another night is not tonight''s');
reset role;
update public.promotion_version set channels = channels || '{"tv": false}' where id = pg_temp.id('version');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is_empty($$ select 1 from public.tv_high_hand() $$, 'not shown on the TVs, there is no board');
reset role;

-- On a break from play, a member is off the board, as they are off the leaderboard. A break is never taken back, so last.
update public.promotion_version set channels = channels || '{"tv": true}' where id = pg_temp.id('version');
update public.high_hand_hit set created_at = now() where id = pg_temp.id('jacks');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is((select jsonb_array_length(payouts) from public.tv_high_hand()), 1, 'tonight''s payout is back on the board');
reset role;
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '1 minute', now() + interval '7 days');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e451');
select is((select jsonb_array_length(payouts) from public.tv_high_hand()), 0, 'a member on a break from play is not shown');
reset role;

select * from finish();
rollback;
