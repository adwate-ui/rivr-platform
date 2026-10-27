-- Markers (#74; additions flow 19). Kunal Mehra (216) gets ₹50,000 of credit and sits at Table 3;
-- Arjun Mehta (201) has a ₹2,00,000 limit and an open ₹50,000 marker, 14 days old (seed). The club's
-- cap is ₹25,00,000 and markers fall due in 30 days (seed). 104 is a cashier (markers.issue); 103 a
-- floor manager; 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.balance(p_code text, p_member uuid) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is not distinct from p_member;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'A regular'), 'active', 'Kunal has ₹50,000 of credit');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits at Table 3');
reset role;
create temp table before as select pg_temp.balance('venue.chips_outstanding', null) as chips;

-- Flow 19: within the limit, the marker posts to his receivable, never his wallet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'first', public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 3000000,
  'M10 40 C 30 10, 50 70, 70 40', '00000000-0000-4000-8000-0000000d7401');
select isnt((select id from ids where name = 'first'), null, 'a cashier issues ₹30,000 on a marker he signed');
select is(public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 3000000,
  'M10 40 C 30 10, 50 70, 70 40', '00000000-0000-4000-8000-0000000d7401'), (select id from ids where name = 'first'), 'a retried tap issues it once');
reset role;
select is(pg_temp.balance('member.receivable', '00000000-0000-4000-8000-000000000216'), 3000000::bigint, 'he owes ₹30,000');
select is(pg_temp.balance('member.cash', '00000000-0000-4000-8000-000000000216'), 0::bigint, 'his wallet is untouched');
select is((select chips from before) - pg_temp.balance('venue.chips_outstanding', null), 3000000::bigint, 'and ₹30,000 of chips are out');
select results_eq($$ select amount_paise, outstanding_paise, due_at - issued_at, settled_at is null from public.marker where id = (select id from ids where name = 'first') $$,
  $$ values (3000000::bigint, 3000000::bigint, interval '30 days', true) $$, 'open, due in 30 days');

-- Refused: above the limit, above the room's cap, while a marker is past due; not whole chips; unsigned.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 2050000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVLIM', null, 'flow 19: one chip above his limit is refused');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000020, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVCHP', null, 'a marker is whole ₹50 chips');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, '', gen_random_uuid()) $$,
  'RVSIG', null, 'and signed');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, '<script>alert(1)</script>', gen_random_uuid()) $$,
  'RVSIG', null, 'with path data, nothing else');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'credit.config', '', '{"approval_threshold_paise": 10000000, "minimum_visits": 3, "exposure_cap_paise": 9000000}',
        now(), 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 2000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVEXP', null, 'within his limit but past a ₹90,000 room cap (₹80,000 open): refused');
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'credit.config' and reason = 'Test';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 2000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'up to his limit exactly');
reset role;
update public.marker set due_at = now() - interval '1 day', issued_at = now() - interval '31 days' where id = (select id from ids where name = 'first');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 8000000, 'More'), 'active', 'his limit goes up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVDUE', null, 'but with a marker past due, no new credit');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVNST', null, 'chips on credit go to a seat');

-- The Markers screen: open markers, oldest first, with age, due date and limit.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, outstanding_paise, age_days, is_past_due, limit_paise from public.open_markers('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Kunal Mehra'::text, 3000000::bigint, 31, true, 8000000::bigint), ('Arjun Mehta', 5000000::bigint, 14, false, 20000000::bigint),
            ('Kunal Mehra', 2000000::bigint, 0, false, 8000000::bigint) $$,
  'Kunal''s past-due marker, Arjun''s from 14 days ago, and Kunal''s new one');

-- Who issues and who sees.
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  '42501', null, 'a floor manager issues no markers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select id from public.marker $$, 'a dealer sees no markers');
select is_empty($$ select * from public.open_markers('00000000-0000-4000-8000-000000000001') $$, 'nor the screen''s read');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is((select count(*)::integer from public.marker), 2, 'Kunal sees his own two markers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.marker), 1, 'and Arjun his one');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.marker where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'the practice venue''s cashier sees no club marker');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  '42501', null, 'and issues none');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';

-- What is owed is the ledger's: a receivable posted without a marker counts against the limit.
reset role;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-owed',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000216' and code = 'member.receivable'), 'amount', '1000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding' and member_id is null), 'amount', '-1000000')), null);
select is(private.member_owes('00000000-0000-4000-8000-000000000216'), 6000000::bigint, 'Kunal owes his two markers and the ₹10,000 posted beside them');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.marker), 3, 'a cashier sees the venue''s markers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select count(*)::integer from public.marker), 3, 'so does staff who read the ledger');
reset role;

-- Switched off, or no rules set: no markers.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'credit', 'Review', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
update public.marker set due_at = now() + interval '1 day' where id = (select id from ids where name = 'first');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVKIL', null, 'while credit is switched off, no markers');
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000002' and key = 'credit.config';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVCFG', null, 'and none where credit is not set up');
reset role;
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'markers.due_days';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 1000000, 'M0 0 L 10 10', gen_random_uuid()) $$,
  'RVCFG', null, 'nor without the days a marker falls due in');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'marker.issued'), 2, 'marker.issued for each');

select * from finish();
rollback;
