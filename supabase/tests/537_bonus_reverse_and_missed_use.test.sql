-- Bonus reversed, and a use added after the fact (#1077, the owner, 18 Nov). 101 Vikram, a super admin, reverses Bonus given
-- to 211 Ishaan and adds a use a seat missed: the whole of a reversal comes back even if part was spent, the balance may go
-- below nothing, Bonus given next pays it first, and none is used at a buy-in meanwhile. 103 a floor manager, 104 a cashier
-- and e9 (staff of another venue) may do neither; nor may Vikram on his own record.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
create function pg_temp.balance() returns bigint language sql as $$
  select private.bonus_balance('00000000-0000-4000-8000-000000000211', now());
$$;
create function pg_temp.remaining(p_name text) returns bigint language sql as $$
  select g.remaining_paise from public.bonus_grant g where g.id = (select id from ids where name = p_name);
$$;
-- The Bonus report's figure, its chart's total and its sources' total for one club day, read as the reports read them.
create function pg_temp.figure(p_name text, p_day date) returns bigint language sql as $$
  select amount from private.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', p_day, p_day) where figure = p_name;
$$;
create function pg_temp.chart(p_day date) returns bigint language sql as $$
  select coalesce(sum(amount), 0)::bigint from private.report_chart('00000000-0000-4000-8000-000000000001', 'bonus', p_day, p_day);
$$;
create temp table today_view on commit drop as
select jsonb_build_object('scope', jsonb_build_object('from', d, 'to', d), 'page_size', 1000) as v
from (select (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date as d) t;
-- The Door's and the Players report's Bonus for Ishaan tonight, and the Bonus given list's rows: his, of tonight.
create function pg_temp.lists() returns table (door bigint, visits bigint, listed bigint) language sql as $$
  select (select bonus_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}') where member_id = '00000000-0000-4000-8000-000000000211'),
         (select bonus_paise from public.player_visits_page('00000000-0000-4000-8000-000000000001', (select v from today_view)) where member_id = '00000000-0000-4000-8000-000000000211'),
         (select coalesce(sum(amount_paise), 0)::bigint from public.bonus_given_page('00000000-0000-4000-8000-000000000001', (select v from today_view))
          where member_id = '00000000-0000-4000-8000-000000000211');
$$;
create function pg_temp.sources(p_day date) returns bigint language sql as $$
  select coalesce(sum(given_paise), 0)::bigint from private.bonus_report('00000000-0000-4000-8000-000000000001', p_day, p_day);
$$;
grant execute on function pg_temp.as_user(uuid), pg_temp.balance(), pg_temp.remaining(text) to authenticated;
grant select, insert on ids to authenticated;

-- Ishaan holds ₹2,000 (a) and ₹1,000 (b), given in that order, neither ending.
insert into ids select 'a', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 200000,
  'Welcome Bonus', null, 'test537:a');
insert into ids select 'b', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000,
  'Birthday', null, 'test537:b');
-- Given on two days, as grants always are: one transaction would give both the same moment.
update public.bonus_grant set created_at = now() - interval '2 days' where id = (select id from ids where name = 'a');
update public.bonus_grant set created_at = now() - interval '1 day' where id = (select id from ids where name = 'b');
-- A seat of his from earlier tonight, its visit closed; and Ira (212) seated a moment ago, inside its Undo.
with v as (insert into public.visit (venue_id, member_id, opened_at)
           values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '4 hours') returning id),
s as (insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds)
      select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', v.id,
             (select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 7,
             now() - interval '3 hours', now() - interval '3 hours', 0
      from v returning id)
insert into ids select 'seat', s.id from s;
update public.seat_session set ended_at = now() - interval '1 hour', end_reason = 'left' where id = (select id from ids where name = 'seat');
update public.visit set closed_at = now() - interval '1 hour', close_reason = 'door'
where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
with v as (insert into public.visit (venue_id, member_id, opened_at)
           values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '5 minutes') returning id),
s as (insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds)
      select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', v.id,
             (select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 8, now(), now(), 0
      from v returning id)
insert into ids select 'fresh', s.id from s;
insert into ids values ('use', gen_random_uuid()), ('use2', gen_random_uuid());
select is(pg_temp.balance(), 300000::bigint, 'Ishaan holds ₹3,000 of Bonus');

-- Who may: a super admin alone, at the venue.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'a'), 'Given by mistake') $$, '42501', null,
  'a floor manager reverses no Bonus');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 500, 'Missed at the seat', gen_random_uuid()) $$,
  '42501', null, 'nor adds a use');
select is_empty($$ select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'nor sees the seats to add one to');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'a'), 'Given by mistake') $$, '42501', null, 'nor a cashier');
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e9');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'a'), 'Given by mistake') $$, '42501', null,
  'nor staff of another venue');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 500, 'Missed at the seat', gen_random_uuid()) $$,
  '42501', null, 'who adds no use either');

-- A use the seat missed: ₹1,500 from the older grant, on the seat's own time, with its reason.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select results_eq($$ select session_id, seat from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  $$ select (select id from ids where name = 'seat'), 7 $$, 'a super admin sees his seat from earlier tonight');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 1525, 'Missed at the seat', gen_random_uuid()) $$,
  'RVCHP', null, 'whole fifties only');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 500, 'no', gen_random_uuid()) $$,
  '22023', null, 'and a reason of three characters at least');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'fresh'), 500, 'Missed at the seat', gen_random_uuid()) $$,
  '22023', null, 'not a seat still inside its Undo');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 1500, 'Missed at the seat', (select id from ids where name = 'use')) $$,
  'he adds ₹1,500 the seat missed');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 1500, 'Missed at the seat', (select id from ids where name = 'use')) $$,
  'the same request again is the same use');
reset role;
select is(pg_temp.balance(), 150000::bigint, 'the balance drops ₹1,500, once');
select is(array[pg_temp.remaining('a'), pg_temp.remaining('b')], array[50000, 100000]::bigint[], 'from the older grant first');
select ok((select r.used_at = s.started_at and r.reason = 'Missed at the seat' from public.bonus_redemption r join public.seat_session s on s.id = r.session_id
           where r.id = (select id from ids where name = 'use')), 'used on the seat''s own time, with its reason');
select results_eq($$ select count(*)::integer, sum(e.amount)::bigint from public.ledger_entry e
                     where e.transaction_id = (select r.ledger_transaction_id from public.bonus_redemption r where r.id = (select id from ids where name = 'use')) $$,
  $$ values (2, 0::bigint) $$, 'the ledger holds its two lines, and they balance');

-- Reversed: the whole ₹2,000, though ₹1,500 of it was spent: its ₹500, then ₹1,000 of the other, and ₹500 owed.
create temp table before_a on commit drop as
  select pg_temp.figure('given', private.club_day_of(now() - interval '2 days')) as then_day, pg_temp.figure('given', private.club_day_now()) as tonight;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'a'), 'ok') $$, '22023', null, 'a reason of two characters: refused');
select lives_ok($$ select public.reverse_bonus((select id from ids where name = 'a'), 'Given to the wrong member') $$, 'he reverses the ₹2,000');
select is(public.reverse_bonus((select id from ids where name = 'a'), 'Given to the wrong member'), null::bigint, 'asked again, it is done: nothing more taken');
reset role;
select is(pg_temp.balance(), -50000::bigint, 'the balance is ₹500 below nothing');
-- The owner, 19 Nov: a reversal counts on its own day, and past days never change.
select is(array[pg_temp.figure('given', private.club_day_of(now() - interval '2 days')) - (select then_day from before_a),
                (select tonight from before_a) - pg_temp.figure('given', private.club_day_now())],
  array[0, 200000]::bigint[], 'the day it was given keeps its figure; tonight''s Bonus given drops by the ₹2,000 that came back');
select is((select reversal_paise from public.bonus_grant where id = (select id from ids where name = 'a')), 200000::bigint, 'what came back is kept with it');
select is((select t.reverses_transaction_id from public.bonus_grant g join public.ledger_transaction t on t.id = g.reversal_transaction_id
           where g.id = (select id from ids where name = 'a')), null::uuid, 'not marked as the grant''s exact opposite: it may be less');
select is(array[pg_temp.remaining('a'), pg_temp.remaining('b')], array[0, 0]::bigint[], 'both grants are used up');
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000211'), 50000::bigint, 'he owes ₹500');
select results_eq($$ select t.idempotency_key = 'bonus_reversal:' || g.id, (select count(*)::integer from public.ledger_entry e where e.transaction_id = t.id),
                            (select sum(e.amount)::bigint from public.ledger_entry e where e.transaction_id = t.id)
                     from public.bonus_grant g join public.ledger_transaction t on t.id = g.reversal_transaction_id
                     where g.id = (select id from ids where name = 'a') $$,
  $$ values (true, 2, 0::bigint) $$, 'one transaction takes it back, in two balanced lines');
select is((select count(*)::integer from public.ledger_transaction t where t.idempotency_key = 'bonus_reversal:' || (select id from ids where name = 'a')), 1, 'once');
select results_eq($$ select (e.amount)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
                     join public.bonus_grant g on g.reversal_transaction_id = e.transaction_id where g.id = (select id from ids where name = 'a') $$,
  $$ values (200000::bigint) $$, 'the whole ₹2,000 comes off his Bonus account');
select is((-private.account_balance((select a.id from public.ledger_account a where a.member_id = '00000000-0000-4000-8000-000000000211' and a.code = 'member.bonus')))::bigint,
  pg_temp.balance(), 'his Bonus account agrees with the balance, below nothing too');
select results_eq($$ select event_type, (payload ->> 'amount_paise')::bigint, (payload ->> 'owed_paise')::bigint from public.outbox_event
                     where event_type in ('bonus.reversed', 'bonus.use_added') and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211'
                     order by event_type $$,
  $$ values ('bonus.reversed'::text, 200000::bigint, 50000::bigint), ('bonus.use_added', 150000, 0) $$, 'each is a business event, once');
select is(private.activity_kind('bonus.reverse', 'member'), 'bonus_chips', 'Activity files a reversal under Bonus');
select is(private.activity_kind('bonus.use_add', 'member'), 'bonus_chips', 'and a use added');
select results_eq($$ select a.reason, (a.after ->> 'chips')::integer from public.audit_log a
                     where a.action = 'bonus.reverse' and a.entity_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('Given to the wrong member'::text, 2000) $$, 'the audit log keeps it, why and how many, once');

-- What members and staff see.
select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select is((select bonus_paise from public.my_bonus()), -50000::bigint, 'his app shows ₹500 below nothing');
select results_eq($$ select kind, amount_paise, reason from public.my_bonus_history(5) where kind in ('reversed', 'redeemed') order by kind $$,
  $$ values ('redeemed'::text, 150000::bigint, null::text), ('reversed', 200000, null) $$,
  'and both in his history, with no reason the club gave (the owner, 19 Nov)');
select throws_ok($$ select reversal_reason from public.bonus_grant $$, '42501', null, 'nor can he select why it was reversed');
select throws_ok($$ select reason from public.bonus_redemption $$, '42501', null, 'nor why a use was added');
select is((select count(*)::integer from public.bonus_grant where reversal_paise is not null), 1, 'the rest of his grants he reads, as before');
select is((select t.memo from public.ledger_transaction t
           where t.id = (select g.reversal_transaction_id from public.bonus_grant g where g.id = (select id from ids where name = 'a'))),
  'Bonus reversed', 'the ledger he reads names the reversal, not why');
select is((select t.memo from public.ledger_transaction t where t.idempotency_key = 'bonus_buy_in:' || (select id from ids where name = 'use')),
  'Bonus use added', 'nor why a use was added');
select is((select count(*)::integer from public.bonus_owed), 1, 'he sees what he owes');
select throws_ok($$ insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_grant_id)
                    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'paid', -50000, (select id from ids where name = 'b')) $$,
  '42501', null, 'and writes none of it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000212');
select is_empty($$ select 1 from public.bonus_owed $$, 'another member sees none of it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.bonus_owed where member_id = '00000000-0000-4000-8000-000000000211'), 1, 'the cage sees what the venue''s members owe');
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e9');
select is_empty($$ select 1 from public.bonus_owed $$, 'staff of another venue see none of it');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is((select bonus_paise from public.member_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211')), -50000::bigint,
  'his record shows it below nothing');
select results_eq($$ select line_id = (select id from ids where name = 'a'), staff_name
                     from public.member_bonus_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 10) where kind = 'reversed' $$,
  $$ values (true, 'Vikram Rao'::text) $$, 'the reversal is its own line, under the grant''s id, with who reversed it');
reset role;

-- No Bonus is used while some is owed; Bonus given next pays it first.
select throws_ok($$ select private.draw_bonus('00000000-0000-4000-8000-000000000211', 5000) $$, 'RVBON', null, 'nothing is used at a buy-in while some is owed');
insert into ids select 'c', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 30000, 'Played two hours', null, 'test537:c');
select is(array[pg_temp.remaining('c'), pg_temp.balance()], array[0, -20000]::bigint[], '₹300 given pays ₹300 of it: ₹200 still owed');
insert into ids select 'd', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 100000, 'Played four hours', null, 'test537:d');
select is(array[pg_temp.remaining('d'), pg_temp.balance()], array[80000, 80000]::bigint[], '₹1,000 given pays the last ₹200 and keeps ₹800');
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000211'), 0::bigint, 'nothing owed now');

-- One given tonight and reversed tonight leaves tonight's Bonus given, chart, sources and what is outstanding lower by
-- exactly its amount (read as the reports read them, with Vikram's claims).
insert into ids select 'e', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 70000, 'Given in error', null, 'test537:e');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
reset role;
create temp table tonight on commit drop as
  select pg_temp.figure('given', private.club_day_now()) as given, pg_temp.chart(private.club_day_now()) as chart,
         pg_temp.sources(private.club_day_now()) as sources, pg_temp.figure('outstanding', private.club_day_now()) as outstanding;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.reverse_bonus((select id from ids where name = 'e'), 'Given in error') $$, 'he reverses Bonus given tonight');
reset role;
select is(array[(select given from tonight) - pg_temp.figure('given', private.club_day_now()),
                (select chart from tonight) - pg_temp.chart(private.club_day_now()),
                (select sources from tonight) - pg_temp.sources(private.club_day_now()),
                (select outstanding from tonight) - pg_temp.figure('outstanding', private.club_day_now())],
  array[70000, 70000, 70000, 70000]::bigint[], 'tonight''s Bonus given, its chart, its sources and what is outstanding each drop by it');
select is(pg_temp.balance(), 80000::bigint, 'his balance as it was'); 

-- A use beyond the balance, and beyond any visit's cap: ₹800 of it, ₹1,200 owed.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.visit_cap', '', '{"basis_points": 1000}', now(), 'test 537');
create temp table before_use on commit drop as select pg_temp.figure('outstanding', private.club_day_now()) as outstanding;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 2000, 'Missed again', (select id from ids where name = 'use2')) $$,
  '₹2,000 more the seat missed, past any cap');
reset role;
select is(pg_temp.balance(), -120000::bigint, 'the balance is ₹1,200 below nothing');
select is((select outstanding from before_use) - pg_temp.figure('outstanding', private.club_day_now()), 200000::bigint,
  'what is outstanding drops by all ₹2,000: ₹800 used, ₹1,200 owed');
select ok(not ('bonus' = any(private.member_erasure_blockers('00000000-0000-4000-8000-000000000211'))),
  'owing Bonus holds nothing back from erasure: it is written off then (the owner, 19 Nov)');
-- Below nothing, he is seated as ever.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 1,
                     p_member_number => (select member_number from public.member where id = '00000000-0000-4000-8000-000000000211')) $$,
  'he is seated though his Bonus is below nothing');

-- The lists count a reversal on its own day too: one given and reversed tonight lowers the Door's and the Players report's
-- Bonus for him by it, and the Bonus given list nets to the same with a reversal row below nothing.
reset role;
insert into ids select 'f', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 70000, 'Given twice', null, 'test537:f');
create temp table lists_before on commit drop as select * from pg_temp.lists();
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.reverse_bonus((select id from ids where name = 'f'), 'Given twice') $$, 'he reverses Bonus given twice tonight');
reset role;
select is(array[(select door from lists_before) - (select door from pg_temp.lists()), (select visits from lists_before) - (select visits from pg_temp.lists()),
                (select listed from lists_before) - (select listed from pg_temp.lists())],
  array[70000, 70000, 70000]::bigint[], 'the Door, the Players report and the Bonus given list each drop by it');
select results_eq($$ select amount_paise, source, staff_name from public.bonus_given_page('00000000-0000-4000-8000-000000000001', (select v from today_view))
                     where source = 'reversed' and reason = 'Given twice' $$,
  $$ values (-70000::bigint, 'reversed'::text, 'Vikram Rao'::text) $$, 'the list shows the reversal below nothing, and who reversed it');

-- A use counts on its seat's club day: one added for a seat two nights ago counts that night, not tonight.
reset role;
with v as (insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
           values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '50 hours', now() - interval '47 hours', 'door') returning id),
s as (insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds, ended_at, end_reason)
      select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', v.id,
             (select id from public.game_table where name = 'Table 2' and venue_id = '00000000-0000-4000-8000-000000000001'), 3,
             now() - interval '49 hours', now() - interval '49 hours', 0, now() - interval '48 hours', 'left'
      from v returning id)
insert into ids select 'earlier', s.id from s;
create temp table used_before on commit drop as
  select pg_temp.figure('used', private.club_day_of(now() - interval '49 hours')) as earlier, pg_temp.figure('used', private.club_day_now()) as tonight;
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'earlier'), 500, 'Missed that night', gen_random_uuid()) $$,
  'a use the seat of two nights ago missed');
reset role;
select is(array[pg_temp.figure('used', private.club_day_of(now() - interval '49 hours')) - (select earlier from used_before),
                pg_temp.figure('used', private.club_day_now()) - (select tonight from used_before)],
  array[50000, 0]::bigint[], 'counted on its seat''s night, not tonight');
-- Set right: Bonus given pays all he owes, and he may be erased once nothing else holds him.
insert into ids select 'settle', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 170000, 'Set right', null, 'test537:settle');
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000211'), 0::bigint, 'Bonus given pays all he owed');
-- Only ever added to.
select throws_ok($$ update public.bonus_owed set amount_paise = 1 where member_id = '00000000-0000-4000-8000-000000000211' $$, '42501', null,
  'what is owed is never changed');
select is(private.strip_erased_fields('{"reversal_reason": "Given to Ira by mistake"}'::jsonb), '{}'::jsonb, 'an erasure takes a reversal''s reason with the rest');

-- What expired went back then: a grant of ₹1,000 with ₹600 spent and ₹400 expired gives back ₹600; one all expired, nothing.
create function pg_temp.expire(p_grant uuid) returns void language plpgsql as $$
declare v_grant public.bonus_grant; v_txn uuid;
begin
  select * into v_grant from public.bonus_grant where id = p_grant;
  v_txn := private.post_ledger_transaction(v_grant.venue_id, 'bonus_expiry', 'bonus_expiry:' || v_grant.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_grant.member_id and a.code = 'member.bonus'),
                         'amount', v_grant.remaining_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_grant.venue_id and a.code = 'venue.bonus_expense'
                                         and a.member_id is null), 'amount', (-v_grant.remaining_paise)::text)),
    null, 'Bonus expired');
  update public.bonus_grant set remaining_paise = 0, expired_at = now(), expiry_transaction_id = v_txn where id = p_grant;
end;
$$;
insert into ids select 'p', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 100000, 'Part expired', null, 'test537:p');
update public.bonus_grant set remaining_paise = 40000 where id = (select id from ids where name = 'p');
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'erasure_test', 'test537:p-play', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000212' and code = 'member.bonus'), 'amount', '60000'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '-60000')), null);
select pg_temp.expire((select id from ids where name = 'p'));
insert into ids select 'q', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 50000, 'All expired', null, 'test537:q');
select pg_temp.expire((select id from ids where name = 'q'));
insert into ids select 'r', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 30000, 'Ended, not swept', null, 'test537:r');
update public.bonus_grant set expires_at = now() - interval '1 minute' where id = (select id from ids where name = 'r');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is(public.reverse_bonus((select id from ids where name = 'p'), 'Given by mistake'), 60000::bigint, 'part expired: the ₹600 that did not comes back');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'q'), 'Given by mistake') $$, 'RVNIL', null,
  'all expired: nothing to take back, its own refusal');
reset role;
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000212'), 60000::bigint, 'with nothing else in force, Ira owes the ₹600');

-- Erased owing it, Ira's debt is written off (the owner, 19 Nov): a ledger write-off and a row below nothing, owing nothing.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is((select bonus_paise from public.member_erasure_preview('00000000-0000-4000-8000-000000000212')), 30000::bigint,
  'the erasure preview names the ₹300 erasure will forfeit, once the ₹600 owed is written off');
reset role;
create temp table forfeit on commit drop as select private.forfeit_member_bonus(m) as summary from public.member m
where m.id = '00000000-0000-4000-8000-000000000212';
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000212'), 0::bigint, 'erasure writes off what was owed');
select results_eq($$ select kind, amount_paise from public.bonus_owed where member_id = '00000000-0000-4000-8000-000000000212' and kind = 'written_off' $$,
  $$ values ('written_off'::text, -60000::bigint) $$, 'kept as a row below nothing');
select is((select sum(e.amount)::bigint from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
           join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
           where t.idempotency_key = 'member_erasure_forfeit:owed:00000000-0000-4000-8000-000000000212'), -60000::bigint,
  'the ledger writes it off her Bonus account');
select is((select (summary ->> 'bonus_paise')::bigint from forfeit), 30000::bigint, 'then forfeits the ₹300 that ended unswept');
select is((select jsonb_array_length(summary -> 'forfeit_transactions') from forfeit), 2, 'two transactions, the write-off and the forfeit');
select is((select private.account_balance(a.id) from public.ledger_account a
           where a.member_id = '00000000-0000-4000-8000-000000000212' and a.code = 'member.bonus'), 0::bigint, 'her Bonus account ends at zero');

-- A promotion's Bonus reversed frees the promotion (the owner, 19 Nov): its limits no longer count the grant, so it may be
-- earned again.
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Welcome 537') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'ended', 'Welcome 537', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "once"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
insert into ids select 'promo', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 50000, 'Welcome 537', null, 'test537:promo');
insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, chips, source_key, period_key, club_day,
                                    status, bonus_grant_id, fulfilled_at)
select '00000000-0000-4000-8000-000000000001', v.promotion_id, v.id, '00000000-0000-4000-8000-000000000213', 'signup', v.reward, 50000, 500, 'signup:537', 'once', private.club_day_now(),
       'given', (select id from ids where name = 'promo'), now()
from public.promotion_version v where v.name = 'Welcome 537';
create function pg_temp.held() returns integer language sql as $$
  select (private.promotion_tally(v.promotion_id, '00000000-0000-4000-8000-000000000213', 'once', null, private.club_day_now(), v.limits) ->> 'grantsGiven')::integer
  from public.promotion_version v where v.name = 'Welcome 537';
$$;
select is(pg_temp.held(), 1, 'the promotion counts its grant');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.reverse_bonus((select id from ids where name = 'promo'), 'Signed up twice') $$, 'he reverses a promotion''s Bonus');
reset role;
select is((select status from public.promotion_grant where bonus_grant_id = (select id from ids where name = 'promo')), 'reversed', 'its grant is marked reversed');
select is(pg_temp.held(), 0, 'and the promotion no longer counts it: it may be earned again');

-- Never on one's own record: Vikram signs up on his own login.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
insert into ids select 'vikram', public.sign_up('Vikram Rao', '{}');
reset role;
insert into ids select 'mine', private.credit_bonus('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vikram'), 50000, 'A test grant', null, 'test537:mine');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'mine'), 'Taking it back') $$, 'RVOWN', null,
  'never on his own member record');
reset role;

-- Any seat of the member's, from any visit (the owner, 19 Nov): Yash's twelve visits, the oldest offered and taking a use.
do $$
declare d int; v uuid; s uuid;
begin
  for d in 1..12 loop
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - make_interval(days => d + 1, hours => 3), now() - make_interval(days => d + 1), 'door')
    returning id into v;
    insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds, ended_at, end_reason)
    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', v, (select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 1 + d % 9,
            now() - make_interval(days => d + 1, hours => 3), now() - make_interval(days => d + 1, hours => 3), 0, now() - make_interval(days => d + 1), 'left')
    returning id into s;
    insert into ids values ('yash' || d, s);
  end loop;
end $$;
-- This file's earlier uses count toward the minute's limit; this one is not about it.
delete from private.rate_hit where action = 'bonus.use_add';
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select is((select count(*)::integer from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214')), 10, 'the console reads ten at a time');
select ok(not exists (select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214') u where u.session_id = (select id from ids where name = 'yash12')),
  'the oldest waits for Show earlier');
select ok(exists (select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 500) u where u.session_id = (select id from ids where name = 'yash12')),
  'then the seat of his oldest visit is offered');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'yash12'), 50, 'Missed long ago', gen_random_uuid()) $$,
  'and takes a use added');
reset role;
select is((select count(*)::integer from public.bonus_redemption where session_id = (select id from ids where name = 'yash12')), 1, 'on that seat');

-- The Bonus report puts tonight's reversals on a line of their own, below nothing, as the Bonus given list names them.
select results_eq($$ select members, grants, given_paise from private.bonus_report('00000000-0000-4000-8000-000000000001', private.club_day_now(), private.club_day_now())
                     where source = 'reversed' and label is null $$,
  $$ select count(distinct g.member_id), count(*), -sum(g.reversal_paise)::bigint from public.bonus_grant g
     where g.venue_id = '00000000-0000-4000-8000-000000000001' and private.club_day_of(g.reversed_at) = private.club_day_now() $$,
  'the Bonus report gives tonight''s reversals their own line, below nothing');

select * from finish();
rollback;
