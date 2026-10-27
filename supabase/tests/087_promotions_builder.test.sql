-- The promotions builder (#84, flow 7) and completed call time as a condition (#80). 107 Ishita
-- (marketing) submits and 101, a super admin, approves (#144); 104 Sana (cashier) may do neither. 211 Ishaan sits at Table 3 (NLH 100/200, an
-- hour of call time).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- Flow 7's promotion as the builder sends it: Thursday 14:00 to 20:00, 100/200, double points, no limits.
create temp table flow7 as select jsonb_build_object(
  'name', 'Double points', 'runs', 'NLH 100/200 · Thursday, 14:00 to 20:00',
  'rule', jsonb_build_object('trigger', 'hours_played', 'conditions', '{"days": [4], "from": "14:00", "until": "20:00", "stakes": ["nlh_100_200"]}'::jsonb,
                             'effect', '{"kind": "points", "multiplier_percent": 200}'::jsonb)) as body;
grant select on flow7 to authenticated;

-- Submitted, it waits with its rule and card words; approved by a super admin, it goes live and is announced.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'flow7', public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from flow7));
select results_eq($$ select p.name, p.status, p.runs, p.detail, r.trigger, r.effect ->> 'multiplier_percent'
                     from public.promotion p join public.promotion_rule r on r.promotion_id = p.id where p.id = (select id from ids where name = 'flow7') $$,
  $$ values ('Double points'::text, 'pending'::text, 'NLH 100/200 · Thursday, 14:00 to 20:00'::text, null::text, 'hours_played'::text, '200'::text) $$,
  'marketing submits flow 7''s promotion, with its rule and card words, to wait for a super admin');
reset role;
select is_empty($$ select 1 from public.outbox_event where event_type = 'promotion.published'
                   and idempotency_key = 'promotion.published:' || (select id from ids where name = 'flow7') $$, 'nothing is announced yet');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion((select id from ids where name = 'flow7')) $$, 'a super admin approves it');
reset role;
select is((select status from public.promotion where id = (select id from ids where name = 'flow7')), 'live', 'and it is live');
select is((select payload ->> 'runs' from public.outbox_event where event_type = 'promotion.published'
           and idempotency_key = 'promotion.published:' || (select id from ids where name = 'flow7')), 'NLH 100/200 · Thursday, 14:00 to 20:00',
  'and promotion.published goes out for the cards and WhatsApp');

-- Refusals: not a promotion manager, a rule the engine does not know, none at all, promotions switched off.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from flow7)) $$, '42501', null,
  'a cashier submits nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select jsonb_set(body, '{rule,effect}', '{"kind": "points", "multiplier_percent": 50}') from flow7)) $$, '23514', null,
  'a rule the engine does not know is refused');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body - 'rule' from flow7)) $$, '22023', null,
  'so is a promotion without its rule');
select is((select count(*)::integer from public.promotion where name = 'Double points'), 1, 'and nothing is left of either');

-- Paused and resumed by its status: nothing is given while paused.
reset role;
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Call time drink', 'live') returning id)
insert into ids select 'drink', id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'drink'), 'hours_played', '{"call_time_complete": true}',
        '{"kind": "physical_prize", "prize": "Drink"}');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'seat', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
reset role;

-- #80: completed call time is a seat this visit whose call time the sweep recorded complete.
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'hours_played',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "hours:test-1", "hours_played": 0.5}')), 0,
  'a player still owing call time is not given a call-time promotion');
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours'
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select is(private.promotion_facts('00000000-0000-4000-8000-000000000211', null, now()) -> 'call_time_complete', 'false'::jsonb,
  'nor before the sweep records it complete');
update public.seat_session set call_time_completed_at = now() - interval '1 hour'
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.set_promotion_live((select id from ids where name = 'drink'), false) $$, 'marketing pauses it');
select throws_ok($$ select public.set_promotion_live((select id from ids where name = 'drink'), false) $$, '22023', null, 'once');
reset role;
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'hours_played',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "hours:test-2", "hours_played": 2}')), 0,
  'a paused promotion gives nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_promotion_live((select id from ids where name = 'drink'), true) $$, '42501', null, 'a cashier resumes nothing');
select throws_ok($$ update public.promotion set status = 'live' $$, '42501', null, 'and no one changes a status but through pause and resume');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.set_promotion_live((select id from ids where name = 'drink'), true) $$, 'marketing resumes it');
reset role;
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'hours_played',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "hours:test-3", "hours_played": 2}')), 1,
  'resumed, it is given once call time is complete');

-- At check-out the visit has just closed, as when points are earned: its call time still counts.
select lives_ok($$ select private.close_visit('00000000-0000-4000-8000-000000000211', now(), 'door') $$, 'Ishaan checks out');
select is(private.promotion_facts('00000000-0000-4000-8000-000000000211', null, now()) -> 'call_time_complete', 'true'::jsonb,
  'his completed call time counts at the moment the visit closes');

-- Refusals: someone who is not staff, a frozen venue, promotions switched off.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from flow7)) $$, '42501', null,
  'a member submits nothing');
reset role;
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from flow7)) $$, 'RVKIL', null,
  'nothing is submitted while promotions are switched off');
select throws_ok($$ select public.set_promotion_live((select id from ids where name = 'drink'), false) $$, 'RVKIL', null,
  'nor paused');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from flow7)) $$, 'RVFRZ', null,
  'nor while the venue is frozen');
reset role;

select * from finish();
rollback;
