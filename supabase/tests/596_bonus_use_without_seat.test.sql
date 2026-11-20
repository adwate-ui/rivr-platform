-- A member's Bonus used without a seat (the owner, 20 Nov). 103 Aditya (admin) uses it; 108 Karan (host) gives no Bonus by
-- hand; 102 Meera (super admin) is member 218 Meera Iyer by name, her own record. Ritika (215) holds ₹1,000 of Bonus: she
-- uses ₹200 at the door, then sits with ₹100 more, so the visit's cap (half) counts both; Kunal (216) holds ₹1,000 and sits
-- with ₹400 first, then uses Bonus without a seat; Neel (217) uses ₹100 and leaves.
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
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 100000,
                    'Welcome', null, 'bonus.hand:596-' || m) from unnest(array['215', '216', '217']) m $$,
  'Ritika, Kunal and Neel are each given ₹1,000');

-- Who, and when.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.use('215', 100, '59600000-0000-4000-8000-000000000001') $$, 'RVNIN', null,
  'not checked in: refused');
-- Checked in by a super admin, so the admin's changes to Ritika below are one change of their own in her History.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', m) from unnest(array[
  '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000217']::uuid[]) m $$,
  'Ritika, Kunal and Neel are checked in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select pg_temp.use('215', 100, '59600000-0000-4000-8000-000000000002') $$, '42501', null,
  'a host, who gives no Bonus by hand, uses none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select pg_temp.use('218', 100, '59600000-0000-4000-8000-000000000003') $$, 'RVOWN', null,
  'never on a staff member''s own record');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.use('215', 75, '59600000-0000-4000-8000-000000000004') $$, 'RVCHP', null, 'not a whole 50: refused');
select throws_ok($$ select pg_temp.use('215', 0, '59600000-0000-4000-8000-000000000004') $$, 'RVCHP', null, 'nothing: refused');
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
select lives_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217') $$, 'he leaves');
select is(pg_temp.use('217', 100, '59600000-0000-4000-8000-000000000030'), '59600000-0000-4000-8000-000000000030'::uuid,
  'the same request after he left is the same use');
select throws_ok($$ select pg_temp.use('217', 100, '59600000-0000-4000-8000-000000000031') $$, 'RVNIN', null, 'a new one is refused');
reset role;
select is((select count(*)::integer from public.bonus_redemption where member_id = '00000000-0000-4000-8000-000000000217'), 1, 'one use of his');

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

-- Reports count it with the rest; Activity files it with Bonus.
create temporary table used_today on commit drop as
select sum(amount_paise)::bigint as paise from public.bonus_redemption
where venue_id = '00000000-0000-4000-8000-000000000001' and private.club_day_of(coalesce(used_at, created_at)) = (select day from today_);
grant select on used_today to authenticated;
select ok((select paise from used_today) >= 90000, 'today''s uses hold the ₹900 above, with and without a seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select day from today_), (select day from today_))
           where figure = 'used'), (select paise from used_today), 'the report''s Bonus used counts them all');
reset role;
select is(private.activity_kind('bonus.use', 'member'), 'bonus_chips', 'Activity files a use with Bonus');

select * from finish();
rollback;
