-- A member's Bonus used without a seat (the owner, 20 Nov). 103 Aditya (admin) uses it; 108 Karan (host) gives no Bonus by
-- hand; 102 Meera (super admin) is member 218 Meera Iyer by name, her own record; a floor manager of another venue gives
-- none here. Ritika (215) holds ₹1,000 of Bonus: she uses ₹200 at the door, then sits with ₹100 more, so the visit's cap
-- (half) counts both; Kunal (216) holds ₹1,000 and sits with ₹400 first, then uses Bonus without a seat; Neel (217) uses
-- ₹100, sits, is undone and leaves. The cap's base is the Bonus held at the visit's first Bonus use (decision 0706): Mihir
-- (213) sits with none, is given ₹2,000 and uses ₹500; Vihaan (212) sits with none, is given more, and buys in at his next
-- seating; Naveen (254) holds a note from a seat before the ruling, which his seat's undo takes. Yash (214) came in
-- yesterday and is still at his seat past 06:00 when he uses Bonus: Players visits holds it once. No check-in is needed (the
-- owner, 22 Nov): Ishaan (211) uses Bonus with no visit open, and Neel once more after he has left.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated',
           'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
$$;
create function pg_temp.use(p_member text, p_chips integer, p_request text) returns uuid language sql as $$
  select public.use_bonus(('00000000-0000-4000-8000-000000000' || p_member)::uuid, p_chips, 'Chips for the cash game', p_request::uuid);
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.use(text, integer, text), pg_temp.table_id(text) to authenticated;
create temporary table sess (name text, id uuid) on commit drop;
create temporary table today_ on commit drop as select private.club_day_of(now()) as day;
grant all on sess, today_ to authenticated;

delete from public.setting where key = 'bonus.visit_cap';
select lives_ok($$ select private.bootstrap_venue('59600000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere-596', false, 'Elsewhere Ltd',
                    'Somewhere', 'EFM') $$, 'another venue');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '59600000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000059600', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('59600000-0000-4000-8000-0000000000e1', '59600000-0000-4000-8000-0000000000e2', 'Elsewhere Floor', 'Floor manager', 'floor');
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000209';
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 100000,
                    'Welcome', null, 'bonus.hand:596-' || m) from unnest(array['215', '216', '217']) m $$,
  'Ritika, Kunal and Neel are each given ₹1,000');

-- Who, and when: checked in or not (the owner, 22 Nov).
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 50000,
                    'Welcome', null, 'bonus.hand:596-211') $$, 'Ishaan is given ₹500');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.use('211', 100, '59600000-0000-4000-8000-000000000001'), '59600000-0000-4000-8000-000000000001'::uuid,
  'not checked in: used all the same');
select is(pg_temp.use('211', 100, '59600000-0000-4000-8000-000000000001'), '59600000-0000-4000-8000-000000000001'::uuid,
  'and the same request again is the same use, not taken for a file''s');
reset role;
select results_eq($$ select visit_id, session_id, amount_paise, private.bonus_in_force(member_id, now()) from public.bonus_redemption
                     where id = '59600000-0000-4000-8000-000000000001' $$,
  $$ values (null::uuid, null::uuid, 10000::bigint, 40000::bigint) $$, 'tied to no visit or seat, and drawn from his Bonus');
-- Checked in by a super admin, so the admin's changes to Ritika below are one change of their own in her History.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', m) from unnest(array[
  '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000217']::uuid[]) m $$,
  'Ritika, Kunal and Neel are checked in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select pg_temp.use('215', 100, '59600000-0000-4000-8000-000000000002') $$, '42501', null,
  'a host, who gives no Bonus by hand, uses none');
select pg_temp.as_person('59600000-0000-4000-8000-0000000000e2');
select throws_ok($$ select pg_temp.use('215', 100, '59600000-0000-4000-8000-000000000002') $$, '42501', null,
  'nor a floor manager of another venue');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select throws_ok($$ select pg_temp.use('216', 100, '59600000-0000-4000-8000-000000000002') $$, '42501', null,
  'nor a member, who is no staff');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.use('209', 100, '59600000-0000-4000-8000-000000000002') $$, '42501', null,
  'an erased member is no member here');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select pg_temp.use('218', 100, '59600000-0000-4000-8000-000000000003') $$, 'RVOWN', null,
  'never on a staff member''s own record');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.use('215', 75, '59600000-0000-4000-8000-000000000004') $$, 'RVCHP', null, 'not a whole 50: refused');
select throws_ok($$ select pg_temp.use('215', 0, '59600000-0000-4000-8000-000000000004') $$, 'RVCHP', null, 'nothing: refused');
select throws_ok($$ select pg_temp.use('215', -50, '59600000-0000-4000-8000-000000000004') $$, 'RVCHP', null, 'below nothing: refused');
select throws_ok($$ select public.use_bonus('00000000-0000-4000-8000-000000000215', 100, 'ok', gen_random_uuid()) $$, '22023', null,
  'a reason of two characters: refused');
select throws_ok($$ select pg_temp.use('215', 1050, '59600000-0000-4000-8000-000000000005') $$, 'RVBON', null,
  'more than the Bonus in force: refused');
reset role;
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000215', now()), 100000::bigint, 'and nothing was taken');

-- The club caps a visit at half the Bonus held at its first use.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.visit_cap', '', '{"basis_points": 5000}', '-infinity', 'Test 596');

-- Ritika: ₹200 without a seat, then ₹100 with her buy-in.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.use('215', 200, '59600000-0000-4000-8000-000000000010'), '59600000-0000-4000-8000-000000000010'::uuid,
  'an admin uses ₹200 of Ritika''s Bonus at the door; the use is the request''s id');
select is(pg_temp.use('215', 200, '59600000-0000-4000-8000-000000000010'), '59600000-0000-4000-8000-000000000010'::uuid,
  'the same request again is the same use');
select throws_ok($$ select pg_temp.use('215', 250, '59600000-0000-4000-8000-000000000010') $$, '22023',
  'That request id was used for another Bonus use', 'that request id with another amount is refused');
select throws_ok($$ select pg_temp.use('216', 200, '59600000-0000-4000-8000-000000000010') $$, '22023',
  'That request id was used for another Bonus use', 'and with the same amount for another member');
reset role;
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000215', now()), 80000::bigint, 'she holds ₹800, ₹200 taken once');
select results_eq($$ select session_id, table_id, visit_id = (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000215'
                     and closed_at is null), amount_paise, reason, used_at, (select full_name from public.staff where id = r.staff_id)
                     from public.bonus_redemption r where member_id = '00000000-0000-4000-8000-000000000215' $$,
  $$ values (null::uuid, null::uuid, true, 20000::bigint, 'Chips for the cash game'::text, null::timestamptz, 'Aditya Malhotra'::text) $$,
  'one use of her visit, with no seat or table, its reason and who used it');
select results_eq($$ select x.kind, a.code, e.amount from public.ledger_transaction x join public.ledger_entry e on e.transaction_id = x.id
                     join public.ledger_account a on a.id = e.account_id
                     where x.idempotency_key = 'bonus_use:59600000-0000-4000-8000-000000000010' order by a.code $$,
  $$ values ('bonus_buy_in'::text, 'member.bonus'::text, 20000::bigint), ('bonus_buy_in', 'venue.chips_outstanding', -20000) $$,
  'posted once, from her Bonus to the chips out, and balanced');
select results_eq($$ select count(*)::integer, (payload ->> 'amount_paise')::bigint, payload -> 'table_id', payload -> 'table_name'
                     from public.outbox_event where event_type = 'bonus.redeemed' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000215'
                     group by payload $$,
  $$ values (1, 20000::bigint, 'null'::jsonb, 'null'::jsonb) $$, 'she is told once: bonus.redeemed, with no table');
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000215' and closed_at is null),
  100000::bigint, 'the visit notes the ₹1,000 she held at its first use');
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000215'), 30000::bigint, 'so ₹300 of her ₹500 cap is left');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 1'), 6, '9000000215', null, null, 350) $$, 'RVVCP', null,
  'a buy-in with ₹350 of Bonus is more than her visit has left');
select lives_ok($$ insert into sess select 'ritika', public.seat_member(pg_temp.table_id('Table 1'), 6, '9000000215', null, null, 100) $$,
  'she sits at Table 1 with ₹100 of Bonus');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000215' and closed_at is null),
  100000::bigint, 'her first seat keeps the note of her first use');
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000215'), 20000::bigint, 'the cap counts both: ₹200 left');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.use('215', 250, '59600000-0000-4000-8000-000000000011') $$, 'RVVCP', null,
  'more than the visit has left, without a seat: refused');
select is((select left_paise from public.member_bonus_visit_left('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215')),
  20000::bigint, 'the seat sheet says ₹200 left');
select lives_ok($$ select public.move_seat((select id from sess where name = 'ritika'), pg_temp.table_id('Table 2'), 3) $$, 'she moves to Table 2');

-- Kunal: ₹400 with his buy-in first, then without a seat.
select lives_ok($$ insert into sess select 'kunal', public.seat_member(pg_temp.table_id('Table 5'), 2, '9000000216', null, null, 400) $$,
  'Kunal sits with ₹400 of Bonus');
select throws_ok($$ select pg_temp.use('216', 150, '59600000-0000-4000-8000-000000000020') $$, 'RVVCP', null,
  'then ₹150 without a seat is more than his visit has left');
select lives_ok($$ select pg_temp.use('216', 100, '59600000-0000-4000-8000-000000000021') $$, 'and ₹100 fits');
reset role;
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000216'), 0::bigint, 'none left: the cap counts the buy-in and the use');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.undo_seat((select id from sess where name = 'kunal')) $$, '22023', 'Something was already recorded at that seat',
  'a seat whose buy-in used Bonus is never undone');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000216' and closed_at is null),
  100000::bigint, 'so the use that noted his base stays, and the note with it');

-- The base is the Bonus held at the visit's first Bonus use (decision 0706). Mihir sits with none, is given ₹2,000 and
-- uses ₹500 without a seat: half of ₹2,000 is his cap.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', m) from unnest(array[
  '00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000254']::uuid[]) m $$,
  'Vihaan, Mihir and Naveen are checked in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 3'), 2, '9000000213', null, null, null) $$, 'Mihir sits with no Bonus');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null),
  null::bigint, 'a seat without Bonus notes nothing');
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 200000,
                    'Welcome', null, 'bonus.hand:596-213') $$, 'he is given ₹2,000');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select pg_temp.use('213', 500, '59600000-0000-4000-8000-000000000040') $$, 'and uses ₹500 without a seat');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null),
  200000::bigint, 'the use notes the ₹2,000 held before it');
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000213'), 50000::bigint, 'so ₹500 of his ₹1,000 cap is left');

-- Vihaan holds ₹1,000 as he sits with no Bonus, then ₹2,000 as he buys in at his next seating: the buy-in notes the base.
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 100000,
                    'Welcome', null, 'bonus.hand:596-212a') $$, 'Vihaan is given ₹1,000');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into sess select 'vihaan', public.seat_member(pg_temp.table_id('Table 3'), 1, '9000000212', null, null, null) $$,
  'he sits with no Bonus');
reset role;
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 100000,
                    'Welcome', null, 'bonus.hand:596-212b') $$, 'is given ₹1,000 more');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.move_seat((select id from sess where name = 'vihaan'), pg_temp.table_id('Private Room'), 1) $$,
  'moves to the Private Room');
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated')::text, true);
select lives_ok($$ select private.redeem_bonus_at_seat((select id from sess where name = 'vihaan'), 400) $$, 'and buys in there with ₹400 of Bonus');
select set_config('request.jwt.claims', '', true);
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000212' and closed_at is null),
  200000::bigint, 'the buy-in, his first Bonus use, notes the ₹2,000 held then, not the ₹1,000 at his first seat');
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000212'), 60000::bigint, 'so ₹600 of his ₹1,000 cap is left');

-- Naveen's note from a seat with no Bonus, before the ruling: undone, the seat takes it, as no use is left to keep it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into sess select 'naveen', public.seat_member(pg_temp.table_id('Table 3'), 3, '9000000254', null, null, null) $$,
  'Naveen sits with no Bonus');
reset role;
update public.visit set bonus_at_first_seat_paise = 50000 where member_id = '00000000-0000-4000-8000-000000000254' and closed_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.undo_seat((select id from sess where name = 'naveen')) $$, 'his seat is undone');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000254' and closed_at is null),
  null::bigint, 'and with no Bonus use left, the note goes');

-- The record's History, and the Bonus histories.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, action, entity, reason from public.member_staff_history('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000215', 50) where action = 'bonus.use' $$,
  $$ values ('Aditya Malhotra'::text, 'bonus.use'::text, 'member'::text, 'Chips for the cash game'::text) $$,
  'her History has the use once: who, what and why');
select ok((select changes @> '[{"entity": "member", "field": "chips", "after": 200}]' from public.member_staff_history('00000000-0000-4000-8000-000000000001',
             '00000000-0000-4000-8000-000000000215', 50) where action = 'bonus.use'), 'and how much');
select ok((select occurred_at from public.member_staff_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 50)
           where action = 'bonus.use') = (select created_at from public.bonus_redemption where id = '59600000-0000-4000-8000-000000000010'),
  'and when');
select results_eq($$ select kind, amount_paise, reason, table_name, staff_name from public.member_bonus_history('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000215', 50) where line_id = '59600000-0000-4000-8000-000000000010' $$,
  $$ values ('redeemed'::text, 20000::bigint, 'Chips for the cash game'::text, null::text, 'Aditya Malhotra'::text) $$,
  'the record''s Bonus history has it with no table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select results_eq($$ select kind, amount_paise, reason, table_name from public.my_bonus_history(50) where line_id = '59600000-0000-4000-8000-000000000010' $$,
  $$ values ('redeemed'::text, 20000::bigint, null::text, null::text) $$, 'hers too, with no table and no reason');
select lives_ok($$ select visit_id from public.bonus_redemption $$, 'she reads which visit');
select throws_ok($$ select reason from public.bonus_redemption $$, '42501', null, 'but not the reason');
reset role;

-- Used, on her visit's first row at the door and in Players visits.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table door on commit drop as
select * from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
where member_id in ('00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000216');
select results_eq($$ select full_name, tables -> 0 ->> 'table', bonus_used_paise, bonus_paise is not null from door order by full_name, seated_at $$,
  $$ values ('Kunal Mehra'::text, 'Table 5'::text, 50000::bigint, true), ('Ritika Das', 'Table 1', 30000, true), ('Ritika Das', 'Table 2', 0, false) $$,
  'the door: each first row has the buy-in and the use without a seat; the next seat its own');
create temporary table visits on commit drop as
select * from public.player_visits_page('00000000-0000-4000-8000-000000000001',
  jsonb_build_object('scope', jsonb_build_object('from', (select day from today_), 'to', (select day from today_)), 'page_size', 1000))
where member_id in ('00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000216');
select results_eq($$ select full_name, tables -> 0 ->> 'table', bonus_used_paise from visits order by full_name, seated_at $$,
  $$ values ('Kunal Mehra'::text, 'Table 5'::text, 50000::bigint), ('Ritika Das', 'Table 1', 30000), ('Ritika Das', 'Table 2', 0) $$,
  'and the same on Players visits');
select is((select sum(bonus_used_paise)::bigint from visits where member_id = '00000000-0000-4000-8000-000000000215'), 30000::bigint,
  'her rows add up to what she used, once');
reset role;

-- Neel: a row without a seat holds his use; once he has left, the same request is still the same use, and no more.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select pg_temp.use('217', 100, '59600000-0000-4000-8000-000000000030') $$, 'Neel uses ₹100 without sitting');
select results_eq($$ select tables, bonus_used_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
                     where member_id = '00000000-0000-4000-8000-000000000217' $$,
  $$ values ('[]'::jsonb, 10000::bigint) $$, 'his one row, without a seat, has it');
reset role;
create temporary table neel_before on commit drop as
select v.bonus_at_first_seat_paise as noted, private.bonus_visit_left(v.member_id) as left_paise
from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000217' and v.closed_at is null;
select is((select noted from neel_before), 100000::bigint, 'his use noted the ₹1,000 he held');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into sess select 'neel', public.seat_member(pg_temp.table_id('Table 3'), 4, '9000000217', null, null, null) $$,
  'he sits with no Bonus');
select lives_ok($$ select public.undo_seat((select id from sess where name = 'neel')) $$, 'and the seat is undone');
reset role;
select results_eq($$ select v.bonus_at_first_seat_paise, private.bonus_visit_left(v.member_id) from public.visit v
                     where v.member_id = '00000000-0000-4000-8000-000000000217' and v.closed_at is null $$,
  $$ select noted, left_paise from neel_before $$, 'the undo leaves his base and what is left: his use without a seat remains');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217') $$, 'he leaves');
select is(pg_temp.use('217', 100, '59600000-0000-4000-8000-000000000030'), '59600000-0000-4000-8000-000000000030'::uuid,
  'the same request after he left is the same use');
select is(pg_temp.use('217', 100, '59600000-0000-4000-8000-000000000031'), '59600000-0000-4000-8000-000000000031'::uuid,
  'and a new one goes through, tied to no visit (the owner, 22 Nov)');
reset role;
select results_eq($$ select visit_id is null from public.bonus_redemption where member_id = '00000000-0000-4000-8000-000000000217' order by visit_id is null $$,
  $$ values (false), (true) $$, 'his two uses: one in his visit, one after it');

-- A missed use's request id never answers as a use without a seat.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.add_bonus_use((select id from sess where name = 'kunal'), 100, 'Missed at the seat',
                    '59600000-0000-4000-8000-000000000021') $$, '22023', 'That request id was used for another Bonus use',
  'a missed use under a use''s request id is refused as another use''s');
reset role;

-- A use is a seat's or a visit's, never both.
select throws_ok($$ update public.bonus_redemption set session_id = (select id from sess where name = 'kunal'),
                    table_id = pg_temp.table_id('Table 3') where id = '59600000-0000-4000-8000-000000000021' $$, '23514', null,
  'a use with a visit and a seat is refused');
select throws_ok($$ update public.bonus_redemption set reason = null where id = '59600000-0000-4000-8000-000000000021' $$, '23514', null,
  'a use without a seat has its reason');

-- Yash came in yesterday and is still at his seat from then when he uses ₹100 today: his visit has no row today on
-- Players visits (it opened yesterday, and no seat of it began today), so the use is on the day he came in, once, while
-- the door shows it on his open visit. Seated again today in the same visit, it moves to today, still once.
create temporary table yash on commit drop as
with v as (insert into public.visit (venue_id, member_id, opened_at)
           values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '1 day') returning id)
select v.id as visit_id from v;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', y.visit_id, pg_temp.table_id('Table 3'), 5,
       now() - interval '1 day' + interval '10 minutes', now() - interval '1 day' + interval '10 minutes'
from yash y;
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 100000,
                    'Welcome', null, 'bonus.hand:596-214') $$, 'Yash is given ₹1,000');
create temporary table span_ on commit drop as
select jsonb_build_object('scope', jsonb_build_object('from', (select day - 1 from today_), 'to', (select day from today_)), 'page_size', 1000) as view;
grant select on span_ to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select pg_temp.use('214', 100, '59600000-0000-4000-8000-000000000050') $$, 'and uses ₹100 today, without a seat');
select results_eq($$ select tables -> 0 ->> 'table', bonus_used_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
                     where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ values ('Table 3'::text, 10000::bigint) $$, 'the door shows it on his open visit''s row');
select results_eq($$ select club_day, bonus_used_paise from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from span_))
                     where member_id = '00000000-0000-4000-8000-000000000214' order by club_day $$,
  $$ values ((select day - 1 from today_), 10000::bigint) $$,
  'Players visits: today he has no row, so it is on the day he came in, once');
reset role;
update public.seat_session set ended_at = now(), end_reason = 'left' where visit_id = (select visit_id from yash);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 3'), 6, '9000000214', null, null, null) $$,
  'he leaves that seat after 06:00 and sits again, in the same visit');
select results_eq($$ select club_day, bonus_used_paise from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from span_))
                     where member_id = '00000000-0000-4000-8000-000000000214' order by club_day $$,
  $$ values ((select day - 1 from today_), 0::bigint), ((select day from today_), 10000::bigint) $$,
  'with a row today, it is on today''s, and on his first day no more');
reset role;
select is((select count(distinct visit_id)::integer from public.seat_session where member_id = '00000000-0000-4000-8000-000000000214'), 1,
  'both seats are of the visit he came in on');
-- Had he used it yesterday instead, Players visits has it on yesterday's row, and the door still shows it on his open visit.
update public.bonus_redemption set created_at = now() - interval '1 day' + interval '20 minutes' where id = '59600000-0000-4000-8000-000000000050';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select club_day, bonus_used_paise from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select view from span_))
                     where member_id = '00000000-0000-4000-8000-000000000214' order by club_day $$,
  $$ values ((select day - 1 from today_), 10000::bigint), ((select day from today_), 0::bigint) $$,
  'a use of yesterday is on yesterday''s row');
select results_eq($$ select bonus_used_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
                     where member_id = '00000000-0000-4000-8000-000000000214' $$,
  $$ values (10000::bigint) $$, 'and the door shows it while his visit is open');
reset role;

-- A use that went through is answered as itself even when a new one is refused for too many a minute.
insert into private.rate_hit (venue_id, actor, action)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'bonus.use' from generate_series(1, 30);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.use('215', 200, '59600000-0000-4000-8000-000000000010'), '59600000-0000-4000-8000-000000000010'::uuid,
  'too many this minute, a retry of a use that went through gets its id');
select throws_ok($$ select pg_temp.use('216', 50, '59600000-0000-4000-8000-000000000060') $$, 'RVRAT', null, 'while a new use is refused');
reset role;
delete from private.rate_hit where action = 'bonus.use';

-- Reports count it with the rest; Activity files it with Bonus.
create temporary table used_today on commit drop as
select sum(amount_paise)::bigint as paise from public.bonus_redemption
where venue_id = '00000000-0000-4000-8000-000000000001' and private.club_day_of(coalesce(used_at, created_at)) = (select day from today_);
grant select on used_today to authenticated;
select ok((select paise from used_today) >= 180000, 'today''s uses hold the ₹1,800 above, with and without a seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select day from today_), (select day from today_))
           where figure = 'used'), (select paise from used_today), 'the report''s Bonus used counts them all');
reset role;
select is(private.activity_kind('bonus.use', 'member'), 'bonus_chips', 'Activity files a use with Bonus');

select * from finish();
rollback;
