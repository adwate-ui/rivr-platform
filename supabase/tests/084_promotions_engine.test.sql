-- The promotions engine (#83). 103 Aditya (admin) and 107 Ishita (marketing) manage promotions; 104
-- Sana (cashier) and 106 Pema (dealer) do not. Three live promotions answer a buy-in: "Graduate first
-- buy-in" (₹1,000 to a new player, alone, one grant in all), "Buy-in bonus Tuesday" (20% to the first
-- two at each table, ₹5,000 in all) and "Double points" (500 points, once a club day each). 211
-- Ishaan and 212 Vihaan have never visited; 216 Kunal and 217 Neel have three visits behind them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions (57_promotions.sql) back to drafts: only the test's own are weighed.
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- What a member holds in an account of theirs.
create function pg_temp.held(p_code text, p_member uuid) returns bigint language sql as $$
  select -coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.code = p_code and a.member_id = p_member;
$$;
-- A buy-in at a table, weighed by the engine: the number of grants given.
create function pg_temp.buy_in(p_member text, p_table text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'buy_in:' || p_key, 'amount_paise', 1000000, 'method', 'wallet',
                       'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_table)));
$$;
-- Any event, weighed by the engine: the number of grants given.
create function pg_temp.weigh(p_trigger text, p_member text, p_context jsonb) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', p_trigger,
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member) || p_context);
$$;
create function pg_temp.grants(p_promotion text) returns text language sql as $$
  select coalesce(string_agg(right(g.member_id::text, 3), ' ' order by g.created_at, g.member_id), 'none')
  from public.promotion_grant g join public.promotion p on p.id = g.promotion_id where p.name = p_promotion;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Who shapes promotions (#144): nobody writes a promotion, rule or budget straight into the tables, not even staff who
-- manage them; a promotion is submitted and a super admin approves it (146_promotion_approval.test.sql). The test's
-- three go in as the database's owner, and the tables still refuse a rule the engine cannot run.
with p as (insert into public.promotion (venue_id, name, status, stacks, priority)
            values ('00000000-0000-4000-8000-000000000001', 'Graduate first buy-in', 'live', false, 20) returning id)
insert into ids select 'graduate', id from p;
with p as (insert into public.promotion (venue_id, name, status, priority)
            values ('00000000-0000-4000-8000-000000000001', 'Buy-in bonus Tuesday', 'live', 10) returning id)
insert into ids select 'tuesday', id from p;
with p as (insert into public.promotion (venue_id, name, status, priority, per_player_limit, per_player_period)
            values ('00000000-0000-4000-8000-000000000001', 'Double points', 'live', 5, 1, 'day') returning id)
insert into ids select 'points', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'graduate'), 'buy_in', '{"new_player": true}',
   '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'),
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"first_n": {"count": 2, "per": "table"}}',
   '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'),
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'points'), 'buy_in', '{}', '{"kind": "points", "points": 500}');
insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'graduate'), null, 1),
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 500000, null);
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in',
   '{"kind": "bonus", "amount_paise": 100000, "percent_bps": 2000, "expires_days": 7}') $$, '23514', null,
  'a bonus is an amount or a share, not both');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"gender": "f"}', '{"kind": "spin"}') $$,
  '23514', null, 'and a condition is one the engine knows');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'lunch', '{"kind": "spin"}') $$,
  '23514', null, 'as is a trigger');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"kind": "bonus", "amount_paise": 102000, "expires_days": 7}') $$,
  '23514', null, 'a bonus is whole ₹50 chips');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"from": "22:00"}', '{"kind": "spin"}') $$,
  '23514', null, 'a window is given whole');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"from": "05:00", "until": "07:00"}', '{"kind": "spin"}') $$,
  '23514', null, 'and closes before the club''s day turns over at 06:00');
select lives_ok($$ insert into public.promotion_rule (venue_id, promotion_id, position, trigger, conditions, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 9, 'check_in', '{"from": "22:00", "until": "04:00"}', '{"kind": "spin"}') $$,
  'a late window is one window');
delete from public.promotion_rule where position = 9;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Straight to live', 'live') $$,
  '42501', null, 'an admin inserts no promotion straight into the table, live or not');
select throws_ok($$ update public.promotion set status = 'live' where id = (select id from ids where name = 'points') $$, '42501', null,
  'nor changes one');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, trigger, effect) values
  ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'tuesday'), 'buy_in', '{"kind": "points", "points": 1}') $$,
  '42501', null, 'nor writes a rule');
select throws_ok($$ update public.promotion_budget set cap_paise = null $$, '42501', null, 'or a budget');
select throws_ok($$ delete from public.promotion_rule $$, '42501', null, 'or removes a rule');
select is((select count(*)::integer from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key is null), 3,
  'but sees the venue''s promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Marketing special') $$,
  '42501', null, 'nor does marketing add one directly');
select is((select count(*)::integer from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key is null), 3,
  'though marketing sees them too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Cashier special') $$,
  '42501', null, 'a cashier adds none');
select is_empty($$ select * from public.promotion $$, 'and sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.promotion_rule $$, 'nor does a dealer see a rule');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.promotion_budget $$, 'nor a member a budget');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'staff of the practice venue alone see none of the club''s promotions');
select is_empty($$ select * from public.promotion_rule where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'rules');
select is_empty($$ select * from public.promotion_budget $$, 'or budgets');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Seated at Table 3: Ishaan and Kunal, then Neel; Vihaan at Table 3 too.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids
select 'seat ' || s.phone, public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), s.seat, s.phone)
from (values (1, '9000000211'), (2, '9000000216'), (3, '9000000217'), (4, '9000000212')) as s (seat, phone);
reset role;
select is(private.promotion_facts('00000000-0000-4000-8000-000000000216',
            (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), now())
          - array['at', 'club_day', 'tier_id', 'table_id', 'visits_in_month', 'call_time_complete'],
  '{"stake": "nlh_100_200", "days_since_last_visit": 3}'::jsonb, 'Kunal is at 100/200, last here three days ago');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000211', null, now()) -> 'days_since_last_visit', 'null'::jsonb,
  'Ishaan has no visit before this one');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000216', null, now()) ->> 'tier_id',
  (select tier_id::text from public.member where id = '00000000-0000-4000-8000-000000000216'), 'the facts carry Kunal''s tier');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000216', null, now()) ->> 'club_day',
  (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date::text, 'and tonight''s club day');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000216', null, now()) -> 'call_time_complete', 'false'::jsonb,
  'Kunal, just seated at 100/200, owes his hour of call time');
-- Two hours in, the minute's sweep records his call time complete (#78, #80).
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours',
  call_time_completed_at = now() - interval '1 hour'
where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null;
select is(private.promotion_facts('00000000-0000-4000-8000-000000000216', null, now()) -> 'call_time_complete', 'true'::jsonb,
  'and two hours in has played it');
-- 218 Meera's visits: one closed on 1 November, one on 4 November, one in October.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000218', v.opened::timestamptz, v.closed::timestamptz, 'door'
from (values ('2026-10-31T20:00:00+05:30', '2026-11-01T02:00:00+05:30'), ('2026-11-03T20:00:00+05:30', '2026-11-04T01:00:00+05:30'),
             ('2026-10-25T20:00:00+05:30', '2026-10-26T01:00:00+05:30')) as v (opened, closed);
select is(private.visits_this_month('00000000-0000-4000-8000-000000000218', '2026-11-04T00:30:00+05:30'), 1,
  'visits this month are those closed in it by then: not October''s, nor one still open');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000218', null, '2026-11-15T21:00:00+05:30') -> 'visits_in_month', '2'::jsonb,
  'Meera has two visits this month by 15 November');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000218', null, '2026-11-15T21:00:00+05:30') -> 'days_since_last_visit', '12'::jsonb,
  'her last began twelve days before');

-- A new player: the graduate bonus, alone, though the others apply too.
select is(pg_temp.buy_in('211', 'Table 3', 'test-1'), 1, 'Ishaan''s buy-in gives one promotion');
select is(pg_temp.grants('Graduate first buy-in'), '211', 'the graduate bonus, which does not stack');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000211'), 100000::bigint, 'Ishaan holds ₹1,000 of bonus');
select results_eq($$ select b.reason, b.expires_at > now() + interval '29 days', g.fulfilled_at is not null
                     from public.promotion_grant g join public.bonus_grant b on b.id = g.bonus_grant_id
                     where g.member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('Graduate first buy-in'::text, true, true) $$, 'credited at once through the bonus, ending in 30 days');
select is(pg_temp.buy_in('211', 'Table 3', 'test-1'), 0, 'a replay of the buy-in gives nothing more');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211'), 1, 'and credits nothing more');

-- Regulars: the Tuesday bonus and the points, which stack; the first two at Table 3 only.
select is(pg_temp.buy_in('216', 'Table 3', 'test-2'), 2, 'Kunal''s buy-in gives two promotions');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000216'), 200000::bigint, '20% of ₹10,000 is ₹2,000 of bonus');
select is(pg_temp.buy_in('217', 'Table 3', 'test-3'), 2, 'Neel, the second at Table 3, has both');
select is(pg_temp.buy_in('212', 'Table 3', 'test-4'), 1, 'Vihaan has only the points');
select is(pg_temp.grants('Buy-in bonus Tuesday'), '216 217', 'the third at the table has no Tuesday bonus');
select is(pg_temp.grants('Graduate first buy-in'), '211', 'and a new player no graduate bonus once its one grant is given');
select results_eq($$ select g.points, g.cost_paise, g.fulfilled_at is null from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
                     where p.name = 'Double points' and g.member_id = '00000000-0000-4000-8000-000000000212' $$,
  $$ values (500::bigint, 0::bigint, true) $$, 'the points wait for the points ledger');
select isnt_empty($$ select 1 from public.outbox_event e join public.promotion_grant g on e.idempotency_key = 'promotion.granted:' || g.id
                     where e.event_type = 'promotion.granted' and (e.payload ->> 'points')::bigint = 500
                       and g.member_id = '00000000-0000-4000-8000-000000000212' $$,
  'and promotion.granted announces them');

-- The rupee budget: ₹1,000 of ₹5,000 is left, less than a ₹2,000 bonus, so none is given at Table 5.
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat 9000000213', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'), 1, '9000000213');
reset role;
select is(pg_temp.buy_in('213', 'Table 5', 'test-5'), 1, 'Mihir, first at Table 5, has the points only');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000213'), 0::bigint, 'never part of a bonus');

-- The per-player limit: the points once a club day.
select is(pg_temp.buy_in('216', 'Table 3', 'test-6'), 0, 'Kunal''s second buy-in gives nothing');

-- A date window: everyone in the club is weighed once a club day.
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Spin at ten', 'live') returning id)
insert into ids select 'spin', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, effect)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'spin'), 'date_window', '{"kind": "spin"}');
select isnt_empty($$ select 1 from cron.job where jobname = 'promotion-windows' and schedule = '* * * * *' $$, 'the window runs every minute');
select lives_ok($$ select private.open_promotion_windows() $$, 'the window opens');
select is(pg_temp.grants('Spin at ten'), '211 212 213 216 217', 'everyone in the club has a spin');
select lives_ok($$ select private.open_promotion_windows() $$, 'the next minute');
select is((select count(*)::integer from public.promotion_grant where promotion_id = (select id from ids where name = 'spin')), 5, 'gives none twice');

-- Who sees grants: promotion managers.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.promotion_grant), 12, 'marketing sees every grant');
select throws_ok($$ update public.promotion_grant set points = 5000 $$, '42501', null, 'and changes none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.promotion_grant $$, 'a cashier sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select * from public.promotion_grant $$, 'nor does a member');
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
  '{"member_id": "00000000-0000-4000-8000-000000000216", "key": "buy_in:mine"}') $$, '42501', null, 'and no app weighs promotions');
reset role;

-- Refusals: an unknown trigger, no event key, another venue's member.
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'birthday',
  '{"member_id": "00000000-0000-4000-8000-000000000216", "key": "x"}') $$, '22023', null, 'an unknown trigger is refused');
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'check_in',
  '{"member_id": "00000000-0000-4000-8000-000000000216"}') $$, '22023', null, 'so is an event without its key');
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
  '{"member_id": "00000000-0000-4000-8000-000000000216", "key": "x", "amount_paise": 1000000}') $$, '22023', null,
  'and an amount without how it was paid');
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'check_in',
  '{"member_id": "00000000-0000-4000-8000-000000000301", "key": "x"}') $$, 'RVNOM', null, 'and a member of another venue');

-- Hours played: two hours in.
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Two hours in', 'live') returning id)
insert into ids select 'hours', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'hours'), 'hours_played', '{"min_hours": 2}', '{"kind": "spin"}');
select is(pg_temp.weigh('hours_played', '216', '{"key": "hours:test-1", "hours_played": 1.5}'), 0, 'an hour and a half is not two hours in');
select is(pg_temp.weigh('hours_played', '216', '{"key": "hours:test-2", "hours_played": 2}'), 1, 'two hours is');

-- A per-player limit over the whole promotion: one welcome drink, ever.
with p as (insert into public.promotion (venue_id, name, status, per_player_limit, per_player_period)
           values ('00000000-0000-4000-8000-000000000001', 'Welcome drink', 'live', 1, 'promotion') returning id)
insert into ids select 'drink', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, effect) values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drink'),
  'check_in', '{"kind": "physical_prize", "prize": "Welcome drink", "value_paise": 50000}');
select is(pg_temp.weigh('check_in', '217', '{"key": "check_in:test-1"}'), 1, 'Neel''s check-in has a welcome drink');
update public.promotion_grant set club_day = club_day - 1 where promotion_id = (select id from ids where name = 'drink');
select is(pg_temp.weigh('check_in', '217', '{"key": "check_in:test-2"}'), 0, 'and a later day''s none');

-- A share is of the member's own money (question #392).
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Ten percent', 'live') returning id)
insert into ids select 'ten', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
select '00000000-0000-4000-8000-000000000001', (select id from ids where name = 'ten'), 'buy_in', jsonb_build_object('table_ids', jsonb_build_array(g.id)),
       '{"kind": "bonus", "percent_bps": 1000, "expires_days": 7}'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 5';
select is(pg_temp.weigh('buy_in', '213', jsonb_build_object('key', 'buy_in:test-8', 'amount_paise', 1000000, 'method', 'bonus',
  'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'))), 0,
  'a buy-in paid from bonus earns no share');
select is(pg_temp.weigh('buy_in', '213', jsonb_build_object('key', 'buy_in:test-9', 'amount_paise', 1000000, 'method', 'cash',
  'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'))), 1,
  'one paid in cash earns 10%');
select is(pg_temp.held('member.bonus', '00000000-0000-4000-8000-000000000213'), 100000::bigint, 'Mihir holds ₹1,000 of bonus');

-- A frozen member is given nothing, and the caller goes on.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000216', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select is(pg_temp.weigh('hours_played', '216', '{"key": "hours:test-3", "hours_played": 3}'), 0, 'nothing for a frozen member, and no error');
select is(pg_temp.weigh('hours_played', '217', '{"key": "hours:test-3", "hours_played": 3}'), 1, 'while another is given');

-- Promotions switched off: nothing is given, and the caller goes on.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select is(pg_temp.buy_in('217', 'Table 3', 'test-7'), 0, 'no promotion while promotions are switched off, and no error');
select is(pg_temp.weigh('hours_played', '217', '{"key": "hours:test-4", "hours_played": 3}'), 0, 'none at all');

select * from finish();
rollback;
