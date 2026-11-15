-- Bonus from promotions waits for a super admin (decision 0670). Every trigger a promotion pays Bonus on keeps it waiting:
-- no ledger lines, no Bonus, no push. 101 Vikram, a super admin at both venues, approves: each is posted exactly as the
-- grant used to post it, the Bonus's end counting from the approval; a refusal posts nothing. The high hand's grant and
-- Bonus by hand are paid at once, as before. Members 211 to 218 are the seed's; 301 is the practice venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts (decision 0491), and its floor set aside: only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';
-- Bonus ends 30 days after it is given at the club, from yesterday.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.expiry_days', '', '{"days": 30}', now() - interval '1 day', 'Test 510');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.m(p_member text) returns uuid language sql as $$ select ('00000000-0000-4000-8000-000000000' || p_member)::uuid $$;
-- A version live at a venue from yesterday, every day all day, for everyone.
create function pg_temp.live(p_venue uuid, p_name text, p_reward jsonb, p_limits jsonb default '{"perMember": "none"}') returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values (p_venue, p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values (p_venue, v_promotion, 1, 'live', p_name, p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text,
                             'timezone', 'Asia/Kolkata'),
          p_limits, '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
-- An event at the club, weighed by the engine: the grants given.
create function pg_temp.weigh(p_trigger text, p_member text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', p_trigger,
    jsonb_build_object('member_id', pg_temp.m(p_member), 'key', p_key));
$$;
-- What a member holds as Bonus on the ledger.
create function pg_temp.held(p_member text) returns bigint language sql as $$
  select -coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.code = 'member.bonus' and a.member_id = pg_temp.m(p_member);
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids select 'welcome', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Welcome 510', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}');
insert into ids select 'referral', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Referral 510', '{"kind": "bonus_chips", "chips": 1000, "on": "referral"}');
insert into ids select 'visit', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Visit 510', '{"kind": "bonus_chips", "chips": 300, "on": "visit"}');
insert into ids select 'seat', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Seat 510', '{"kind": "seat_bonus", "chips": 1000}');
insert into ids select 'tiers', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Tiers 510',
  '{"kind": "seat_bonus", "tiers": [{"count": 10, "chips": 5000}, {"count": 20, "chips": 2000}]}', '{"perMember": "once"}');
insert into ids select 'hours', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Hours 510',
  '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}');

-- Sign-up, referral and a check-in, each weighed once.
select is(pg_temp.weigh('signup', '211', 'signup:510-211'), 1, 'a sign-up is given its Bonus');
select is(pg_temp.weigh('referral', '212', 'referral:510-212'), 1, 'a referral');
select is(pg_temp.weigh('check_in', '213', 'check_in:510-213'), 1, 'a check-in');
-- A seat: Yash sat four minutes ago at Table 3 and left; the sweep weighs it, and no other seat.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-000000000001', pg_temp.m('214'), now() - interval '1 hour', now(), 'door');
with s as (
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select v.venue_id, v.member_id, v.id, g.id, 7, now() - interval '4 minutes', now() - interval '4 minutes', now(), 'left'
  from public.visit v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 3'
  where v.member_id = pg_temp.m('214') and v.closed_at = now()
  returning id)
insert into ids select 'seat 214', s.id from s;
insert into private.seat_bonus_weighed (seat_session_id)
select s.id from public.seat_session s where s.id <> (select id from ids where name = 'seat 214') on conflict do nothing;
select private.sweep_seat_bonus();
select is((select count(*)::integer from public.promotion_grant where member_id = pg_temp.m('214')), 2, 'a seat, by the seat bonus and its first tier');
-- Play time: Ritika has sat 70 minutes tonight; the step after an hour is reached.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000510a1', '00000000-0000-4000-8000-000000000001', pg_temp.m('215'), now() - interval '75 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', pg_temp.m('215'), '00000000-0000-4000-8000-0000000510a1', g.id, 2,
       now() - interval '70 minutes', now() - interval '70 minutes', 0
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000510a1', now());
select is((select count(*)::integer from public.promotion_grant where member_id = pg_temp.m('215')), 1, 'play time, at its step');
-- The old engine, on rules: a check-in rule of ₹200 Bonus, beside the version's.
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Old 510', 'live') returning id)
insert into ids select 'old', p.id from p;
insert into public.promotion_rule (venue_id, promotion_id, trigger, effect)
values ('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'old'), 'check_in', '{"kind": "bonus", "amount_paise": 20000}');
select is(pg_temp.weigh('check_in', '216', 'check_in:510-216'), 2, 'a check-in, by the version and by the old rule');

-- Waiting: every one, with its event, and nothing posted, credited or told.
create temporary table waited on commit drop as
select g.id, right(g.member_id::text, 3) as member, coalesce(v.name, p.name) as name, g.cost_paise
from public.promotion_grant g join public.promotion p on p.id = g.promotion_id left join public.promotion_version v on v.id = g.promotion_version_id
where g.member_id in (select pg_temp.m(x) from unnest(array['211', '212', '213', '214', '215', '216']) x);
grant select on waited to authenticated;
select results_eq($$ select member, name, cost_paise from waited order by 1, 2 $$,
  $$ values ('211'::text, 'Welcome 510'::text, 50000::bigint), ('212', 'Referral 510', 100000), ('213', 'Visit 510', 30000), ('214', 'Seat 510', 100000),
            ('214', 'Tiers 510', 500000), ('215', 'Hours 510', 50000), ('216', 'Old 510', 20000), ('216', 'Visit 510', 30000) $$,
  'the eight calculated, each with its amount');
select is_empty($$ select 1 from public.promotion_grant g join waited w on w.id = g.id
                   where g.status <> 'waiting' or g.bonus_grant_id is not null or g.fulfilled_at is not null or g.event is null $$,
  'each waits, with its event, nothing posted');
select is_empty($$ select 1 from public.ledger_transaction t join waited w on t.idempotency_key = 'bonus:promotion:' || w.id $$, 'no ledger lines');
select is((select sum(pg_temp.held(x)) from unnest(array['211', '212', '213', '214', '215', '216']) x), 0::numeric, 'no Bonus held');
select is_empty($$ select 1 from public.outbox_event e where e.event_type = 'bonus.credited'
                   and e.payload ->> 'member_id' in (select pg_temp.m(x)::text from unnest(array['211', '212', '213', '214', '215', '216']) x) $$,
  'and nobody told');
select is((select (event ->> 'stepMinutes')::integer from public.promotion_grant where member_id = pg_temp.m('215')), 60, 'the play-time grant keeps its step');

-- Approved two days on: Ishaan's waited since then.
update public.promotion_grant set created_at = now() - interval '2 days' where member_id = pg_temp.m('211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select grants, amount_paise from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                       (select array_agg(id) from waited), '00000000-0000-4000-8000-000000510001') $$,
  $$ values (8, 880000::bigint) $$, 'a super admin approves the eight: ₹8,800 in all');
reset role;

-- Posted as the grant posted it before: per grant, a Bonus transaction keyed by the grant, the venue's expense against the
-- member's Bonus, the promotion's name its reason, and the push.
select results_eq($$ select w.member, w.name, a.code, e.amount
                     from waited w join public.promotion_grant g on g.id = w.id join public.bonus_grant b on b.id = g.bonus_grant_id
                     join public.ledger_entry e on e.transaction_id = b.ledger_transaction_id join public.ledger_account a on a.id = e.account_id
                     order by 1, 2, 3 $$,
  $$ values ('211'::text, 'Welcome 510'::text, 'member.bonus'::text, -50000::bigint), ('211', 'Welcome 510', 'venue.bonus_expense', 50000),
            ('212', 'Referral 510', 'member.bonus', -100000), ('212', 'Referral 510', 'venue.bonus_expense', 100000),
            ('213', 'Visit 510', 'member.bonus', -30000), ('213', 'Visit 510', 'venue.bonus_expense', 30000),
            ('214', 'Seat 510', 'member.bonus', -100000), ('214', 'Seat 510', 'venue.bonus_expense', 100000),
            ('214', 'Tiers 510', 'member.bonus', -500000), ('214', 'Tiers 510', 'venue.bonus_expense', 500000),
            ('215', 'Hours 510', 'member.bonus', -50000), ('215', 'Hours 510', 'venue.bonus_expense', 50000),
            ('216', 'Old 510', 'member.bonus', -20000), ('216', 'Old 510', 'venue.bonus_expense', 20000),
            ('216', 'Visit 510', 'member.bonus', -30000), ('216', 'Visit 510', 'venue.bonus_expense', 30000) $$,
  'each posts the venue''s expense against the member''s Bonus, its amount exactly');
select is_empty($$ select 1 from waited w join public.promotion_grant g on g.id = w.id join public.bonus_grant b on b.id = g.bonus_grant_id
                   join public.ledger_transaction t on t.id = b.ledger_transaction_id
                   where g.status <> 'given' or g.fulfilled_at is null or g.decision_id is null
                      or t.kind <> 'bonus' or t.idempotency_key <> 'bonus:promotion:' || g.id or t.memo <> w.name
                      or b.reason <> w.name or b.idempotency_key <> 'promotion:' || g.id or b.amount_paise <> w.cost_paise
                      or b.remaining_paise <> w.cost_paise $$,
  'as the grant posted it: a Bonus transaction keyed by the grant, the promotion''s name its reason');
select is_empty($$ select t.id from waited w join public.promotion_grant g on g.id = w.id join public.bonus_grant b on b.id = g.bonus_grant_id
                   join public.ledger_transaction t on t.id = b.ledger_transaction_id join public.ledger_entry e on e.transaction_id = t.id
                   group by t.id having sum(e.amount) <> 0 $$, 'every transaction balances');
select is((select count(*)::integer from public.outbox_event e join waited w on true join public.promotion_grant g on g.id = w.id
           where e.event_type = 'bonus.credited' and e.payload ->> 'bonus_grant_id' = g.bonus_grant_id::text), 8, 'each member is told: Bonus added');
select is((select b.expires_at from public.bonus_grant b join public.promotion_grant g on g.bonus_grant_id = b.id where g.member_id = pg_temp.m('211')),
          now() + interval '30 days', 'its end counts from the approval, not from when it was calculated');
select is(pg_temp.held('214'), 600000::bigint, 'Yash holds his ₹6,000');

-- The same promotion's Bonus, paid at once by the old path, posts the same lines: the high hand's grant (PR 3), for Meera.
select ok(private.give_promotion_version(jsonb_build_object(
  'version_id', (select v.id from public.promotion_version v where v.promotion_id = (select id from ids where name = 'welcome')),
  'trigger', 'high_hand', 'chips', 500, 'perk', null, 'period_key', 'event:high_hand:510',
  'event', jsonb_build_object('kind', 'high_hand', 'key', 'high_hand:510', 'at', now(), 'memberId', pg_temp.m('218'), 'tableId', null))) is not null,
  'the high hand''s grant is given');
select results_eq($$ select g.status, g.fulfilled_at is not null, t.kind, t.memo, b.reason, b.amount_paise from public.promotion_grant g
                     join public.bonus_grant b on b.id = g.bonus_grant_id join public.ledger_transaction t on t.id = b.ledger_transaction_id
                     where g.member_id = '00000000-0000-4000-8000-000000000218' $$,
  $$ values ('given'::text, true, 'bonus'::text, 'Welcome 510'::text, 'Welcome 510'::text, 50000::bigint) $$, 'and paid at once, as before');
select results_eq($$ select a.code, e.amount from public.promotion_grant g join public.bonus_grant b on b.id = g.bonus_grant_id
                     join public.ledger_entry e on e.transaction_id = b.ledger_transaction_id join public.ledger_account a on a.id = e.account_id
                     where g.member_id = '00000000-0000-4000-8000-000000000218' order by 1 $$,
  $$ select a.code, e.amount from public.promotion_grant g join public.bonus_grant b on b.id = g.bonus_grant_id
     join public.ledger_entry e on e.transaction_id = b.ledger_transaction_id join public.ledger_account a on a.id = e.account_id
     where g.member_id = '00000000-0000-4000-8000-000000000211' order by 1 $$,
  'with the same lines as Ishaan''s approved Bonus of the same promotion');
-- Bonus by hand is no promotion's: paid at once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.give_bonus_chips('00000000-0000-4000-8000-000000000218', 100, 'Long wait', '00000000-0000-4000-8000-000000510002'), null,
  'Bonus by hand is added');
reset role;
select is(pg_temp.held('218'), 60000::bigint, 'at once: Meera holds the high hand''s 500 and the 100 by hand');

-- Refused: Neel's sign-up Bonus. Nothing is posted, nothing told; the decision keeps the reason.
select is(pg_temp.weigh('signup', '217', 'signup:510-217'), 1, 'Neel''s sign-up is given its Bonus');
insert into ids select 'neel', id from public.promotion_grant where member_id = pg_temp.m('217');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select grants, amount_paise from public.refuse_promotion_bonus('00000000-0000-4000-8000-000000000001',
                       array[(select id from ids where name = 'neel')], 'Signed up twice', '00000000-0000-4000-8000-000000510003') $$,
  $$ values (1, 50000::bigint) $$, 'a super admin refuses it with a reason');
reset role;
select results_eq($$ select g.status, g.bonus_grant_id is null, g.fulfilled_at is null, d.decision, d.reason, d.grants, d.amount_paise
                     from public.promotion_grant g join public.promotion_bonus_decision d on d.id = g.decision_id where g.id = (select id from ids where name = 'neel') $$,
  $$ values ('refused'::text, true, true, 'refused'::text, 'Signed up twice'::text, 1, 50000::bigint) $$, 'refused, with who decided and why');
select is(pg_temp.held('217'), 0::bigint, 'nothing posted');
select is_empty($$ select 1 from public.outbox_event e where e.event_type = 'bonus.credited' and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000217' $$,
  'nothing told');
select is(pg_temp.weigh('signup', '217', 'signup:510-217'), 0, 'and the same sign-up is not weighed again');

-- The practice venue the same: its own promotion's Bonus waits for its own super admin.
insert into ids select 'practice', pg_temp.live('00000000-0000-4000-8000-000000000002', 'Practice 510', '{"kind": "bonus_chips", "chips": 400, "on": "signup"}');
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000002', 'signup',
  jsonb_build_object('member_id', pg_temp.m('301'), 'key', 'signup:510-301'))), 1, 'at the practice venue a sign-up is given its Bonus');
select is((select status from public.promotion_grant where member_id = pg_temp.m('301')), 'waiting', 'which waits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select grants, amount_paise from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000002',
                       (select array_agg(id) from public.promotion_grant where member_id = '00000000-0000-4000-8000-000000000301'),
                       '00000000-0000-4000-8000-000000510004') $$,
  $$ values (1, 40000::bigint) $$, 'and its super admin approves it');
reset role;
select is(pg_temp.held('301'), 40000::bigint, 'posted at the practice venue');

select * from finish();
rollback;
