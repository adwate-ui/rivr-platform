-- The high hand bonus (redesign RD-22). A promotion lists hands from a fixed list, each with its Bonus, and three rules;
-- one runs in a venue. The floor logs a hit against a table, a player seated at it and a hand; the Bonus is paid at once,
-- every time, as one ledger entry, within the promotion's budget and apart from the daily limit on Bonus added by hand. 101
-- Vikram (super admin), 103 Aditya (admin, the floor), 104 Sana (cashier), 106 Pema (dealer), 107 Ishita (marketing), 108 Karan
-- (host). Those who add Bonus by hand log a hit (bonus.give): a cashier and a host seat players and read the strip, and log none.
-- Ishaan (211) and Kunal (216) sit at Table 3, Mihir (213) at Table 5; Vihaan (212) is not seated. The twins are proved on
-- the golden file (024_golden_twins).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
create temporary table today on commit drop as select private.club_day_of(now()) as day;
grant select on today to authenticated;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name; $$;
create function pg_temp.table_of(p_venue text, p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = ('00000000-0000-4000-8000-00000000000' || p_venue)::uuid and name = p_name;
$$;
-- The club's high hand bonus: a royal flush 25,000, a straight flush 10,000, four of a kind 5,000, Aces full 2,000, any
-- full house 1,000; both hole cards, shown at showdown, four or more dealt in.
create function pg_temp.reward() returns jsonb language sql immutable as $$
  select '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4},
           "hands": [{"hand": "royal_flush", "chips": 25000}, {"hand": "straight_flush", "chips": 10000}, {"hand": "four_of_a_kind", "chips": 5000},
                     {"hand": "aces_full", "chips": 2000}, {"hand": "full_house", "chips": 1000}]}'::jsonb;
$$;
create function pg_temp.terms_ok(p_reward jsonb, p_limits jsonb default '{"perMember": "none", "budgetChips": 50000}') returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [1, 2, 3, 4, 5, 6, 7], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', p_limits,
    '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
$$;
-- A high hand promotion put straight into the tables, as the database's owner: live from yesterday, every day, all stakes.
create function pg_temp.high_hand(p_venue text, p_name text, p_status text, p_limits jsonb default '{"perMember": "none", "budgetChips": 50000}')
returns uuid language plpgsql as $$
declare
  v_venue uuid := ('00000000-0000-4000-8000-00000000000' || p_venue)::uuid;
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values (v_venue, p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values (v_venue, v_promotion, 1, p_status, p_name, pg_temp.reward(), '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          p_limits, '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
-- A hit logged at a table for a member, every rule confirmed unless told otherwise.
create function pg_temp.log(p_table uuid, p_member text, p_hand text, p_rank text, p_request text,
                            p_confirmed jsonb default '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}')
returns uuid language sql as $$
  select public.log_high_hand(p_table, ('00000000-0000-4000-8000-000000000' || p_member)::uuid, p_hand, p_rank, p_confirmed,
                              ('44100000-0000-4000-8000-0000000000' || p_request)::uuid);
$$;
create function pg_temp.bonus_of(p_member text) returns bigint language sql as $$
  select -coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.code = 'member.bonus' and a.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid;
$$;
create function pg_temp.movements() returns integer language sql as $$ select count(*)::integer from public.ledger_transaction; $$;
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.id(text), pg_temp.table_of(text, text), pg_temp.reward(),
  pg_temp.log(uuid, text, text, text, text, jsonb) to authenticated;

-- 1. The terms ---------------------------------------------------------------------------------------------------------
select ok(pg_temp.terms_ok(pg_temp.reward()), 'hands from the list, each with its Bonus, and the three rules are terms');
select ok(pg_temp.terms_ok(pg_temp.reward(), '{"perMember": "none", "budgetChips": 200000, "budgetPeriod": "month"}'), 'with a budget, by the month too');
select results_eq($$ select h.hand, pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{hands}', jsonb_build_array(jsonb_build_object('hand', h.hand, 'chips', 500))))
                     from unnest(array['royal_flush', 'straight_flush', 'four_of_a_kind', 'aces_full', 'full_house', 'flush', 'kings_full']) with ordinality h (hand, n)
                     order by h.n $$,
  $$ values ('royal_flush'::text, true), ('straight_flush', true), ('four_of_a_kind', true), ('aces_full', true), ('full_house', true), ('flush', false),
            ('kings_full', false) $$, 'the list is fixed: a royal flush, a straight flush, four of a kind, Aces full and any full house, and nothing else');
select ok(not pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{hands}', '[]')), 'a high hand lists at least one hand');
select ok(not pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{hands}', '[{"hand": "royal_flush"}]')), 'a listed hand always has a Bonus');
select ok(not pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{hands}', '[{"hand": "royal_flush", "chips": 25020}]')), 'in whole 50s');
select ok(not pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{hands}', '[{"hand": "royal_flush", "chips": 25000}, {"hand": "royal_flush", "chips": 500}]')),
  'and is listed once');
select ok(not pg_temp.terms_ok(pg_temp.reward() #- '{rules,minPlayersDealt}') and not pg_temp.terms_ok(jsonb_set(pg_temp.reward(), '{rules,minPlayersDealt}', '1')),
  'the rules are all three, with two or more players dealt in');
select ok(not pg_temp.terms_ok(pg_temp.reward(), '{"perMember": "per_day", "budgetChips": 50000}')
          and not pg_temp.terms_ok(pg_temp.reward(), '{"perMember": "none", "budgetChips": 50000, "maxMembersPerDay": 5}')
          and not pg_temp.terms_ok(pg_temp.reward(), '{"perMember": "none", "budgetChips": 50000, "maxGrants": 5}'),
  'paid every time: no limit a member, a day or in grants');
select ok(not pg_temp.terms_ok(pg_temp.reward(), '{"perMember": "none"}'), 'its budget alone holds it, so it must have one');
select is(private.promotion_event_kind(pg_temp.reward()), 'high_hand', 'a high hand is given for a high hand, never for a visit');

-- 2. One runs in a venue -----------------------------------------------------------------------------------------------
insert into ids select 'club', pg_temp.high_hand('1', 'High hand bonus', 'live');
select throws_ok($$ select pg_temp.high_hand('1', 'Second high hand', 'live') $$, '23505', null, 'a second live high hand promotion is refused');
select throws_ok($$ select pg_temp.high_hand('1', 'Second high hand', 'scheduled') $$, '23505', null, 'so is one scheduled');
select throws_ok($$ select pg_temp.high_hand('1', 'Second high hand', 'paused') $$, '23505', null, 'or paused');
select lives_ok($$ insert into ids select 'practice', pg_temp.high_hand('2', 'Practice high hand', 'live', '{"perMember": "none", "budgetChips": 100000}') $$,
  'the practice venue runs its own');
-- Through the builder's calls: drafted, simulated, then refused at submitting while the other runs.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'weekend', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', jsonb_build_object(
  'terms', jsonb_build_object('name', 'Weekend high hand', 'reward', pg_temp.reward(), 'eligibility', '{"stakes": "all", "tiers": "all", "audience": "everyone"}'::jsonb,
    'schedule', jsonb_build_object('days', '[6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (select day from today)::text, 'timezone', 'Asia/Kolkata'),
    'limits', '{"perMember": "none", "budgetChips": 100000}'::jsonb, 'channels', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}'::jsonb, 'rulesText', '[]'::jsonb),
  'detail', 'Up to 25,000 Bonus a hand', 'runs', 'all stakes · Sat, Sun, all day'));
select lives_ok($$ select public.record_promotion_simulation(v.id,
                     '{"events": 0, "membersQualified": 0, "timesGiven": 0, "chips": 0, "perks": 0, "isBudgetReached": false}',
                     jsonb_build_object('reward', v.reward, 'eligibility', v.eligibility, 'schedule', v.schedule, 'limits', v.limits))
                   from public.promotion_version v where v.id = pg_temp.id('weekend') $$, 'a second one is drafted and simulated');
select throws_ok($$ select public.submit_promotion_version(pg_temp.id('weekend')) $$, 'RVHH1', 'Another high hand promotion is running: end it first',
  'and refused at submitting while another runs');
reset role;
-- One submitted before the other went live is refused at approving.
update public.promotion_version set status = 'awaiting_approval', submitted_at = now(),
  author_staff_id = (select s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000107')
where id = pg_temp.id('weekend');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.approve_promotion_version(pg_temp.id('weekend')) $$, 'RVHH1', null, 'and at approving');
reset role;

-- 3. Logging a hit -----------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat ' || s.phone, public.seat_member(pg_temp.table_of('1', s.at), s.seat, s.phone)
from (values ('Table 3', 1, '9000000211'), ('Table 3', 4, '9000000216'), ('Table 5', 2, '9000000213')) as s (at, seat, phone);
reset role;
create temporary table opening on commit drop as
  select pg_temp.movements() as movements, pg_temp.bonus_of('211') as ishaan, (select count(*)::integer from public.outbox_event) as events,
         (select count(*)::integer from public.promotion_grant) as grants, (select count(*)::integer from public.audit_log) as audits;

-- Who may: those who add Bonus by hand (bonus.give: super admins, admins, floor managers), nobody else.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '01') $$, '42501',
  'Only super admins, admins and floor managers log a high hand', 'a cashier, who seats players, logs no high hand');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '01') $$, '42501', null, 'nor a host');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '01') $$, '42501', null, 'a dealer logs no high hand');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '01') $$, '42501', null, 'nor marketing, who do not seat players');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '01') $$, '42501', null, 'nor a member, for himself or anyone');

-- Refused, saying which, and nothing moves.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '212', 'royal_flush', null, '02') $$, 'RVHHS',
  'That player is not seated at that table now: log a high hand before the seat is ended', 'a player who is not seated is refused, and it says when to log');
select throws_ok($$ select pg_temp.log('00000000-0000-4000-8000-0000000000ff', '211', 'royal_flush', null, '02') $$, '42501', null,
  'a table that is not there reads as no permission');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '213', 'royal_flush', null, '02') $$, 'RVHHS', null,
  'so is one seated at another table');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'flush', null, '02') $$, 'RVHHR', 'The high hand is not paid: hand_not_listed',
  'a hand the promotion does not list is refused, and the refusal says so');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'four_of_a_kind', null, '02') $$, 'RVHHR', 'The high hand is not paid: wrong_rank',
  'four of a kind with no rank is refused for its rank');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '02',
                     '{"bothHoleCards": false, "shownAtShowdown": true, "playersDealt": true}') $$, 'RVHHR', 'The high hand is not paid: both_hole_cards_not_confirmed',
  'both hole cards not confirmed: refused, and it says which rule');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '02',
                     '{"bothHoleCards": true, "shownAtShowdown": false, "playersDealt": true}') $$, 'RVHHR', 'The high hand is not paid: showdown_not_confirmed',
  'not shown at showdown: refused');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '02',
                     '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": false}') $$, 'RVHHR', 'The high hand is not paid: players_not_confirmed',
  'the players dealt in not confirmed: refused');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '02',
                     '{"bothHoleCards": true, "shownAtShowdown": true}') $$, '22023', null, 'a rule left out altogether is no hit at all');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '02',
                     '{"bothHoleCards": "yes", "shownAtShowdown": 1, "playersDealt": "true"}') $$, '22023', null,
  'and confirmed is true or false, never a word or a number');
select throws_ok($$ select public.log_high_hand(pg_temp.table_of('1', 'Table 3'), '00000000-0000-4000-8000-000000000211', 'royal_flush', null,
                     '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', null) $$, '22023', null, 'a hit needs its request id');
reset role;
select is(pg_temp.movements(), (select movements from opening), 'a refusal moves nothing in the ledger');
select is_empty($$ select 1 from public.high_hand_hit $$, 'and keeps no hit');
select is((select array[count(*)::integer] from public.promotion_grant) || (select array[count(*)::integer] from public.outbox_event)
          || (select array[count(*)::integer] from public.audit_log), (select array[grants, events, audits] from opening),
  'no grant, no event and no line in the audit log');

-- Paid at once: Ishaan's royal flush, 25,000.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'royal', pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '03');
reset role;
select results_eq($$ select h.hand, h.rank, h.chips, h.seat, h.table_id = pg_temp.table_of('1', 'Table 3'), h.promotion_id = pg_temp.id('club'),
                            (select s.user_id::text from public.staff s where s.id = h.logged_by_staff_id)
                     from public.high_hand_hit h where h.id = pg_temp.id('royal') $$,
  $$ values ('royal_flush'::text, null::text, 25000::bigint, 1, true, true, '00000000-0000-4000-8000-000000000103'::text) $$,
  'the hit is kept: the hand, the Bonus, the table and seat, the promotion, and who logged it');
select is(pg_temp.bonus_of('211'), (select ishaan + 2500000 from opening), 'Ishaan holds 25,000 more Bonus at once');
select is(pg_temp.movements(), (select movements + 1 from opening), 'through one ledger transaction');
select results_eq($$ select t.kind, count(*)::integer, sum(e.amount)::bigint, max(e.amount)::bigint
                     from public.high_hand_hit h join public.bonus_grant b on b.id = h.bonus_grant_id
                     join public.ledger_transaction t on t.id = b.ledger_transaction_id join public.ledger_entry e on e.transaction_id = t.id
                     where h.id = pg_temp.id('royal') group by t.kind $$,
  $$ values ('bonus'::text, 2, 0::bigint, 2500000::bigint) $$, 'a bonus of two entries that sum to nothing: ₹25,000 from the club''s bonus expense to his Bonus');
select results_eq($$ select g.trigger, g.chips, g.cost_paise, g.fulfilled_at is not null, g.promotion_version_id is not null, b.reason, b.amount_paise
                     from public.high_hand_hit h join public.promotion_grant g on g.id = h.promotion_grant_id join public.bonus_grant b on b.id = h.bonus_grant_id
                     where h.id = pg_temp.id('royal') $$,
  $$ values ('high_hand'::text, 25000::bigint, 2500000::bigint, true, true, 'High hand bonus'::text, 2500000::bigint) $$,
  'given as the promotion''s grant, so its budget and its list count it, and credited under the promotion''s name');
select results_eq($$ select a.action, a.entity, a.actor_user_id::text, a.after ->> 'hand', a.after ->> 'chips', a.after ->> 'table', a.after ->> 'seat',
                            a.after ->> 'member_id'
                     from public.audit_log a where a.action = 'high_hand.pay' and a.entity_id = pg_temp.id('royal')::text $$,
  $$ values ('high_hand.pay'::text, 'high_hand_hit'::text, '00000000-0000-4000-8000-000000000103'::text, 'royal_flush'::text, '25000'::text, 'Table 3'::text,
             '1'::text, '00000000-0000-4000-8000-000000000211'::text) $$,
  'the audit log has the hit with who logged it');
select results_eq($$ select e.payload ->> 'member_id', e.payload ->> 'hand', (e.payload ->> 'chips')::bigint, e.payload ->> 'table_name', (e.payload ->> 'seat')::integer
                     from public.outbox_event e where e.event_type = 'high_hand.paid' and e.idempotency_key = 'high_hand.paid:' || pg_temp.id('royal') $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::text, 'royal_flush'::text, 25000::bigint, 'Table 3'::text, 1) $$,
  'high_hand.paid carries it to the member''s app and the TVs');
select is((select count(*)::integer from public.outbox_event e join public.high_hand_hit h on e.idempotency_key = 'bonus.credited:' || h.bonus_grant_id
           where h.id = pg_temp.id('royal') and e.event_type = 'bonus.credited'), 1, 'and bonus.credited tells the member, as any Bonus does');

-- The same hit logged twice pays once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '03'), pg_temp.id('royal'), 'the same request again is the same hit');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'royal_flush', null, '03') $$, '22023', null,
  'the same request for another player is refused');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'straight_flush', 'nine', '03') $$, '22023', null,
  'and for another hand: it is not answered as if it were paid');
reset role;
select is(pg_temp.movements(), (select movements + 1 from opening), 'nothing more moves in the ledger');
select is(pg_temp.bonus_of('211'), (select ishaan + 2500000 from opening), 'Ishaan is paid once');
select is((select count(*)::integer from public.high_hand_hit), 1, 'and there is one hit');
select is((select count(*)::integer from public.audit_log where action = 'high_hand.pay'), 1, 'and one line in the audit log');

-- Every time, with no hourly window and no best hand: Ishaan again a minute later, then Kunal with a lesser hand.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'jacks', pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'four_of_a_kind', 'jack', '04');
insert into ids select 'aces', pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'full_house', 'ace', '05');
insert into ids select 'kings', pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'full_house', 'king', '06');
reset role;
select results_eq($$ select i.name, h.hand, h.rank, h.chips, h.seat from public.high_hand_hit h join ids i on i.id = h.id where i.name in ('jacks', 'aces', 'kings')
                     order by i.name $$,
  $$ values ('aces'::text, 'aces_full'::text, null::text, 2000::bigint, 4), ('jacks', 'four_of_a_kind', 'jack', 5000, 1), ('kings', 'full_house', 'king', 1000, 4) $$,
  'each hit is paid its own hand''s Bonus: four jacks 5,000; a full house of three aces as Aces full, 2,000; kings full 1,000');
select is(pg_temp.bonus_of('211'), (select ishaan + 3000000 from opening), 'Ishaan has both his hands'' Bonus tonight');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'aces_full', null, '05'), pg_temp.id('aces'),
  'a retry that names the same hand the other way, Aces full for a full house of aces, is the same hit');
reset role;

-- The budget: 50,000, of which 33,000 is paid. A royal flush's 25,000 is refused, and the refusal says what is left.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'royal_flush', null, '07') $$, 'RVHHB', 'The budget has 17000 Bonus left',
  'a payout beyond the budget is refused, and says what is left');
select isnt(pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'straight_flush', 'nine', '08'), null, 'a straight flush''s 10,000 still fits');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'straight_flush', 'eight', '09') $$, 'RVHHB', 'The budget has 7000 Bonus left',
  'the next does not: 7,000 is left');
reset role;
select is(pg_temp.movements(), (select movements + 5 from opening), 'a refusal for the budget moves nothing: five hits, five ledger transactions');
select is((select sum(chips)::bigint from public.high_hand_hit where promotion_id = pg_temp.id('club')), 43000::bigint, 'never past the budget');

-- Never for one's own member record, by login, phone or name, as Bonus added by hand. Aditya, who is a member too, is seated by Vikram.
select set_config('request.jwt.claims', '', true);
with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Aditya M.', '+919000000103')
              returning id)
insert into ids select 'aditya_member', id from made;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', id, 'verified', 'digilocker', '1990-01-01', 'ABCPA1033A',
       '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg', now() from ids where name = 'aditya_member';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'seat aditya', public.seat_member(pg_temp.table_of('1', 'Table 5'), 6, '9000000103');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.log_high_hand(pg_temp.table_of('1', 'Table 5'), pg_temp.id('aditya_member'), 'aces_full', null,
                     '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', '44100000-0000-4000-8000-0000000000b1') $$, 'RVOWN', null,
  'staff never log a high hand for their own member record');
reset role;

-- Apart from the daily limit on Bonus added by hand: with that limit at 1,000 and the most at once 500, a hit of 5,000 is paid,
-- nobody is alerted, and the 5,000 does not count against what Aditya may add by hand.
select set_config('request.jwt.claims', '', true);
delete from public.setting where key in ('bonus.daily_staff_cap', 'bonus.by_hand_cap');
-- A super admin who signed in with a code just now, as a control setting asks.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000101', 'role', 'authenticated',
  'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true),
       set_config('role', 'authenticated', true);
insert into public.setting (venue_id, key, subject, value, reason) values
  ('00000000-0000-4000-8000-000000000001', 'bonus.daily_staff_cap', '', '{"chips": 1000}', 'test 441'),
  ('00000000-0000-4000-8000-000000000001', 'bonus.by_hand_cap', '', '{"chips": 500}', 'test 441');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(pg_temp.log(pg_temp.table_of('1', 'Table 5'), '213', 'four_of_a_kind', 'ace', '10'), null,
  'with the daily limit at 1,000 and 500 the most at once, four aces are paid their 5,000');
select isnt(public.give_bonus_chips('00000000-0000-4000-8000-000000000212', 500, 'For the night', '44100000-0000-4000-8000-0000000000a1'), null,
  'and Aditya still adds 500 by hand: the hit took nothing from his day');
select isnt(public.give_bonus_chips('00000000-0000-4000-8000-000000000212', 500, 'For the night', '44100000-0000-4000-8000-0000000000a2'), null,
  'and 500 more, up to the limit');
select is(public.give_bonus_chips('00000000-0000-4000-8000-000000000212', 50, 'For the night', '44100000-0000-4000-8000-0000000000a3'), null,
  'the limit itself is what it was: past 1,000 by hand, nothing is added');
reset role;
select is((select count(*)::integer from public.alert where kind = 'bonus.daily_cap' and created_at >= now()), 1,
  'the owner is alerted once, for the Bonus added by hand, never for a high hand');

-- A table, a player or a moment the promotion is not for.
update public.promotion_version set eligibility = '{"stakes": ["nlh_50_100"], "tiers": "all", "audience": "everyone"}' where promotion_id = pg_temp.id('club');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'aces_full', null, '11') $$, 'RVHHE', null,
  'a table of a stake the promotion is not for is refused');
reset role;
update public.promotion_version set eligibility = '{"stakes": "all", "tiers": "all", "audience": "everyone"}' where promotion_id = pg_temp.id('club');

-- A frozen member is paid nothing; with the promotion paused, nothing is live to pay.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000216', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '216', 'aces_full', null, '12') $$, 'RVMBR', null, 'a frozen member is paid nothing');
reset role;
update public.promotion_version set status = 'paused' where promotion_id = pg_temp.id('club');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'aces_full', null, '13') $$, 'RVHHN', 'No high hand promotion is live',
  'with none live, a hit is refused');
select is(pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'royal_flush', null, '03'), pg_temp.id('royal'),
  'though a retry of a hit already paid is still answered with it');
reset role;

-- 4. Who reads the hits ------------------------------------------------------------------------------------------------
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.high_hand_hit where venue_id = '00000000-0000-4000-8000-000000000001'), 6, 'the floor sees the club''s hits');
select throws_ok($$ update public.high_hand_hit set chips = 50 $$, '42501', null, 'and changes none');
select throws_ok($$ delete from public.high_hand_hit $$, '42501', null, 'nor removes one');
select throws_ok($$ insert into public.high_hand_hit (venue_id, promotion_id, promotion_version_id, promotion_grant_id, bonus_grant_id, member_id, table_id,
                                                        session_id, seat, hand, chips, request_id, logged_by_staff_id)
                    select venue_id, promotion_id, promotion_version_id, promotion_grant_id, bonus_grant_id, member_id, table_id, session_id, seat, hand, chips,
                           gen_random_uuid(), logged_by_staff_id from public.high_hand_hit limit 1 $$, '42501', null, 'nor writes one straight into the table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.high_hand_hit), 6, 'a cashier, who sees the Live floor, reads them');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.high_hand_hit), 6, 'marketing, who manage promotions, see them');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.high_hand_hit $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.high_hand_hit $$, 'nor a member, straight from the table');
reset role;

-- 5. The practice venue: the same happens, and nothing reaches an outside system -----------------------------------------
create temporary table practice_opening on commit drop as select pg_temp.bonus_of('270') as kabir;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat practice', public.seat_member(pg_temp.table_of('2', 'Table 3'), 1, '9000000270');
insert into ids select 'practice_hit', pg_temp.log(pg_temp.table_of('2', 'Table 3'), '270', 'royal_flush', null, '20');
reset role;
select results_eq($$ select h.venue_id::text, h.chips, h.promotion_id = pg_temp.id('practice') from public.high_hand_hit h where h.id = pg_temp.id('practice_hit') $$,
  $$ values ('00000000-0000-4000-8000-000000000002'::text, 25000::bigint, true) $$, 'the practice venue''s floor logs a hit, paid by its own promotion');
select is(pg_temp.bonus_of('270'), (select kabir + 2500000 from practice_opening), 'Kabir of the practice venue holds its Bonus');
select isnt_empty($$ select 1 from public.outbox_event where venue_id = '00000000-0000-4000-8000-000000000002' and event_type = 'high_hand.paid' $$,
  'its event is written');
select is_empty($$ select 1 from public.claim_outbox_deliveries('push', array['high_hand.paid', 'bonus.credited', 'promotion.granted'], false, 100) d
                   where d.venue_id = '00000000-0000-4000-8000-000000000002' $$, 'and the push consumer, as any consumer, is never handed a practice venue''s event');
select isnt_empty($$ select 1 from public.outbox_delivery d join public.outbox_event e on e.id = d.event_id
                     where d.consumer = 'push' and e.event_type = 'high_hand.paid' and e.venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'while the club''s are handed over');
-- One venue's staff see only their venue's hits.
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select venue_id::text, count(*)::integer from public.high_hand_hit group by venue_id $$,
  $$ values ('00000000-0000-4000-8000-000000000002'::text, 1) $$, 'staff of the practice venue alone see its hit and none of the club''s');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'aces_full', null, '21') $$, '42501', null,
  'and log none at the club');
reset role;

-- 6. Stopped: promotions switched off, then the venue frozen ------------------------------------------------------------
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
update public.promotion_version set status = 'live' where promotion_id = pg_temp.id('club');
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'full_house', 'two', '30') $$, 'RVKIL', null,
  'with promotions switched off, no high hand is paid');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.log(pg_temp.table_of('1', 'Table 3'), '211', 'full_house', 'two', '31') $$, 'RVFRZ', null, 'nor in a frozen venue');
reset role;

select * from finish();
rollback;
