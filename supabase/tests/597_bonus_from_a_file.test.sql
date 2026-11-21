-- Bonus added and used from a file (the owner, 22 Nov; decision 0707). 102 Meera (super admin) saves the files; she is
-- member 218 by name, her own record; 103 Aditya (admin) may not. Ritika (215) and Kunal (216) are each given ₹1,000. A
-- file adds ₹500 to Ritika and uses ₹1,500 of hers, the Add above paying for it, and ₹200 of Kunal's while he is checked in
-- under a visit cap that does not bind it. Neel (217) owes ₹1,000 after a reversal: a Use alone is refused, an Add first
-- pays it. Member 301 is the practice venue's; 209 is erased.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated',
           'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
$$;
-- A line of a file: its line in the file, the member (by the end of their id), Add or Use, chips and a reason.
create function pg_temp.line(p_line integer, p_member text, p_kind text, p_chips integer, p_reason text) returns jsonb language sql as $$
  select jsonb_build_object('line', p_line, 'member_id', '00000000-0000-4000-8000-000000000' || p_member, 'kind', p_kind, 'chips', p_chips,
                            'reason', p_reason);
$$;
create function pg_temp.save(p_lines jsonb, p_request text) returns integer language sql as $$
  select public.bonus_from_file('00000000-0000-4000-8000-000000000001', p_lines, p_request::uuid);
$$;
-- What a file's refusal says: its code, and the line its detail names.
create function pg_temp.refusal(p_lines jsonb) returns text language plpgsql as $$
declare
  v_state text;
  v_detail text;
begin
  perform public.bonus_from_file('00000000-0000-4000-8000-000000000001', p_lines, gen_random_uuid());
  return 'none';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
  return v_state || ' ' || coalesce(v_detail, '');
end;
$$;
create function pg_temp.held(p_member text) returns bigint language sql security definer as $$
  select private.bonus_in_force(('00000000-0000-4000-8000-000000000' || p_member)::uuid, now());
$$;
grant execute on function pg_temp.as_person(text), pg_temp.line(integer, text, text, integer, text), pg_temp.save(jsonb, text),
  pg_temp.refusal(jsonb), pg_temp.held(text) to authenticated;

update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000209';
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, 100000,
                    'Welcome', null, 'bonus.hand:597-' || m) from unnest(array['215', '216', '217']) m $$,
  'Ritika, Kunal and Neel are each given ₹1,000');
create temporary table numbers on commit drop as
select right(id::text, 3) as person, member_number::text as number from public.member
where id in ('00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000218', '00000000-0000-4000-8000-000000000209',
             '00000000-0000-4000-8000-000000000301');
grant select on numbers to authenticated;
create temporary table today_ on commit drop as select private.club_day_of(now()) as day;
create temporary table report_before (figure text, amount bigint) on commit drop;
grant select on today_ to authenticated;
grant all on report_before to authenticated;

-- The preview's members.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select results_eq(
  $$ select key, full_name, in_force_paise, owed_paise, is_own from public.bonus_file_members('00000000-0000-4000-8000-000000000001',
       array[(select number from numbers where person = '215'), '+919000000216', (select number from numbers where person = '218'),
             (select number from numbers where person = '209'), (select number from numbers where person = '301'), '+919999999999', 'nobody'])
     order by full_name $$,
  $$ values ('+919000000216'::text, 'Kunal Mehra'::text, 100000::bigint, 0::bigint, false),
            ((select number from numbers where person = '218'), 'Meera Iyer', 0, 0, true),
            ((select number from numbers where person = '215'), 'Ritika Das', 100000, 0, false) $$,
  'a super admin reads the members a file names, by number or phone: never one erased, of the practice venue, or no one''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.bonus_file_members('00000000-0000-4000-8000-000000000001', array['+919000000216'])), 0,
  'an admin reads none');

-- Who, and what a file may hold.
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift')), '59700000-0000-4000-8000-000000000001') $$,
  '42501', null, 'an admin saves no file');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select pg_temp.save('[]', '59700000-0000-4000-8000-000000000001') $$, '22023', null, 'an empty file is refused');
select throws_ok($$ select pg_temp.save((select jsonb_agg(pg_temp.line(n, '215', 'add', 50, 'Diwali gift')) from generate_series(1, 501) n),
                    '59700000-0000-4000-8000-000000000001') $$, '22023', null, 'and one of 501 lines');
select throws_ok($$ select public.bonus_from_file('00000000-0000-4000-8000-000000000001', jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift')), null) $$,
  '22023', null, 'and one with no request id');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '301', 'add', 500, 'Diwali gift'))),
  '22023 3', 'a line naming the practice venue''s member is refused, by its line');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(4, '209', 'add', 500, 'Diwali gift'))), '22023 4', 'and one naming an erased member');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(5, '215', 'gift', 500, 'Diwali gift'))), '22023 5', 'a type that is not Add or Use');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(6, '215', 'add', 75, 'Diwali gift'))), 'RVCHP 6', 'chips not in whole 50s');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(6, '215', 'add', 100050, 'Diwali gift'))), 'RVCHP 6', 'more than 1,00,000 chips');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(7, '215', 'use', 100, ' ok '))), '22023 7', 'a reason of two characters');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(8, '218', 'add', 500, 'Diwali gift'))), 'RVOWN 8', 'her own record');
-- All or none: the Add on line 2 is undone with the Use refused on line 3.
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(2, '216', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1050, 'At the bar'))),
  'RVBON 3', 'a Use of more than the Bonus in force is refused, by its line');
select is(pg_temp.held('216'), 100000::bigint, 'and the Add above it was undone with it');

-- Kunal is checked in, and the club caps a visit at half the Bonus held: a file's use is no visit's.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.visit_cap', '', '{"basis_points": 1000}', '-infinity', 'Test 597');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216') $$, 'Kunal is checked in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into report_before
select figure, amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select day from today_), (select day from today_));

-- The file.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1500, 'Paid at the bar'),
                                         pg_temp.line(4, '216', 'use', 200, 'Food on the 21st')), '59700000-0000-4000-8000-000000000002'),
  3, 'the file goes: three lines');
select is(pg_temp.held('215'), 0::bigint, 'Ritika''s ₹1,000 and the ₹500 added are used: the Add above paid for the Use');
select is(pg_temp.held('216'), 80000::bigint, 'Kunal holds ₹800: ₹200 used, more than his visit''s cap of ₹100 would allow');
reset role;
select is((select bonus_at_first_seat_paise from public.visit where member_id = '00000000-0000-4000-8000-000000000216' and closed_at is null),
  null::bigint, 'and his visit notes no cap base: the use is none of its');
select results_eq(
  $$ select member_id, session_id, table_id, visit_id, amount_paise, reason, used_at, (select full_name from public.staff where id = r.staff_id)
     from public.bonus_redemption r where r.id in (private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 2),
                                                    private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 3)) order by amount_paise $$,
  $$ values ('00000000-0000-4000-8000-000000000216'::uuid, null::uuid, null::uuid, null::uuid, 20000::bigint, 'Food on the 21st'::text, null::timestamptz, 'Meera Iyer'::text),
            ('00000000-0000-4000-8000-000000000215', null, null, null, 150000, 'Paid at the bar', null, 'Meera Iyer') $$,
  'each use is a record of its own: no seat, table or visit, its reason and who saved it');
select results_eq(
  $$ select x.kind, a.code, e.amount from public.ledger_transaction x join public.ledger_entry e on e.transaction_id = x.id
     join public.ledger_account a on a.id = e.account_id
     where x.idempotency_key = 'bonus_file_use:' || private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 2) order by a.code $$,
  $$ values ('bonus_buy_in'::text, 'member.bonus'::text, 150000::bigint), ('bonus_buy_in', 'venue.chips_outstanding', -150000) $$,
  'Ritika''s use is posted from her Bonus to the chips out, and balanced');
select results_eq(
  $$ select amount_paise, remaining_paise, reason from public.bonus_grant where idempotency_key = 'bonus.hand:file:59700000-0000-4000-8000-000000000002:1' $$,
  $$ values (50000::bigint, 0::bigint, 'Diwali gift'::text) $$, 'the Add is Bonus by hand, keyed on the file and its place, all of it used');
select results_eq(
  $$ select event_type, count(*)::integer from public.outbox_event
     where payload ->> 'member_id' in ('00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000216')
       and event_type in ('bonus.credited', 'bonus.redeemed') and created_at = now() group by event_type order by event_type $$,
  $$ values ('bonus.credited'::text, 3), ('bonus.redeemed', 2) $$,
  'each member is told: the welcome Bonus, the Add, and each use with no table');

-- Again, it is the same file.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1500, 'Paid at the bar'),
                                         pg_temp.line(4, '216', 'use', 200, 'Food on the 21st')), '59700000-0000-4000-8000-000000000002'),
  3, 'the same file again gives the same count');
select is(pg_temp.held('216'), 80000::bigint, 'and changes nothing');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '216', 'add', 500, 'Diwali gift')), '59700000-0000-4000-8000-000000000002') $$,
  '22023', 'That request id was used for another file', 'that request id with another file is refused');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'use', 500, 'Diwali gift')), '59700000-0000-4000-8000-000000000002') $$,
  '22023', 'That request id was used for another file', 'and with its first line as a Use');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1500, 'Paid at the bar')),
                    '59700000-0000-4000-8000-000000000002') $$,
  '22023', 'That request id was used for another file', 'and with its first lines alone');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1500, 'Paid at the bar'),
                    pg_temp.line(4, '216', 'use', 200, 'Food on the 21st'), pg_temp.line(5, '216', 'add', 50, 'More')), '59700000-0000-4000-8000-000000000002') $$,
  '22023', 'That request id was used for another file', 'and with a line more');
select throws_ok($$ select pg_temp.save(jsonb_build_array(pg_temp.line(2, '215', 'add', 500, 'Diwali gift'), pg_temp.line(3, '215', 'use', 1000, 'Paid at the bar'),
                    pg_temp.line(4, '216', 'use', 200, 'Food on the 21st')), '59700000-0000-4000-8000-000000000002') $$,
  '22023', 'That request id was used for another file', 'and with a later line changed');
reset role;
select ok((select bool_and(id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') from public.bonus_redemption
           where id in (private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 2), private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 3))),
  'a file''s use ids are version-4 ids, as the push consumer reads them');
create temporary table file_use on commit drop as select private.bonus_file_use_id('59700000-0000-4000-8000-000000000002', 3) as id;
grant select on file_use to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.use_bonus('00000000-0000-4000-8000-000000000216', 200, 'Chips for the bar', (select id from file_use)) $$,
  '22023', 'That request id was used for another Bonus use', 'a use without a seat under a file use''s id is refused, never answered as done');

-- The record's History and Bonus history, the member's own, the door, and the report.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, action, reason from public.member_staff_history('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000215', 50) where action like 'bonus.%' $$,
  $$ values ('Meera Iyer'::text, 'bonus.file'::text, 'Diwali gift; Paid at the bar'::text) $$,
  'Ritika''s History has the file once, as one change from a file: who, and each reason');
select ok((select changes @> '[{"entity": "member", "field": "added_chips", "after": 500}, {"entity": "member", "field": "used_chips", "after": 1500}]'
           from public.member_staff_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 50)
           where action = 'bonus.file'), 'with both figures: the Add and the Use');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select results_eq($$ select amount, reason from public.activity_page('00000000-0000-4000-8000-000000000001', p_kind => 'bonus_chips', p_page_size => 200)
                     where action = 'bonus.file' and about = 'Ritika Das' $$,
  $$ values (500::bigint, 'Diwali gift; Paid at the bar'::text) $$, 'Activity has her once among the Bonus changes: the chips added, and the reasons');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, amount_paise, reason, table_name, staff_name from public.member_bonus_history('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000215', 50) where kind = 'redeemed' $$,
  $$ values ('redeemed'::text, 150000::bigint, 'Paid at the bar'::text, null::text, 'Meera Iyer'::text) $$,
  'the record''s Bonus history has the use with no table');
select is((select coalesce(sum(bonus_used_paise), 0)::bigint from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000216'), 0::bigint, 'the door shows no use on Kunal''s visit');
select results_eq(
  $$ select f.figure, f.amount - b.amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select day from today_),
       (select day from today_)) f join report_before b using (figure) where f.figure in ('by_hand', 'used') order by f.figure $$,
  $$ values ('by_hand'::text, 50000::bigint), ('used', 170000) $$,
  'the report counts the Add as Bonus by hand, and both uses');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select results_eq($$ select kind, amount_paise, reason, table_name from public.my_bonus_history(50) where kind = 'redeemed' $$,
  $$ values ('redeemed'::text, 150000::bigint, null::text, null::text) $$, 'Ritika''s own history has the use, with no table and no reason');

-- Neel owes ₹1,000: a Use alone is refused; an Add above it pays what is owed first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(pg_temp.save(jsonb_build_array(pg_temp.line(2, '217', 'use', 1000, 'Paid at the bar')), '59700000-0000-4000-8000-000000000003'), 1,
  'Neel''s ₹1,000 is used from a file');
select lives_ok($$ select public.reverse_bonus((select id from public.bonus_grant where idempotency_key = 'bonus.hand:597-217'), 'Given by mistake') $$,
  'and the ₹1,000 he was given is reversed: he owes it');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(2, '217', 'use', 50, 'Paid at the bar'))), 'RVBON 2', 'a Use while he owes is refused');
select is(pg_temp.save(jsonb_build_array(pg_temp.line(2, '217', 'add', 1500, 'Diwali gift'), pg_temp.line(3, '217', 'use', 500, 'Paid at the bar')),
                       '59700000-0000-4000-8000-000000000004'), 2, 'an Add of ₹1,500 first, then a Use of ₹500, goes');
reset role;
select is(private.bonus_owed_by('00000000-0000-4000-8000-000000000217'), 0::bigint, 'the Add paid the ₹1,000 he owed');
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000217', now()), 0::bigint, 'and the ₹500 he kept was used');

-- Two Adds of 50 for Kunal in one file: his History adds them up, where a change a line would say 50 once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(pg_temp.save(jsonb_build_array(pg_temp.line(2, '216', 'add', 50, 'Diwali gift'), pg_temp.line(3, '216', 'add', 50, 'Diwali gift'),
                                         pg_temp.line(4, '216', 'add', 100, 'Referral')), '59700000-0000-4000-8000-000000000005'), 3, 'three Adds for Kunal go');
reset role;
select results_eq($$ select after - 'bonus_file_id', reason from public.audit_log
                     where action = 'bonus.file' and after ->> 'bonus_file_id' = '59700000-0000-4000-8000-000000000005' $$,
  $$ values ('{"added_chips": 200, "lines": [2, 3, 4]}'::jsonb, 'Diwali gift; Referral'::text) $$,
  'the audit log has him once: 200 added, the lines and each reason once');

-- A frozen member: the preview says so, and the file is refused at that line.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000215', 'Under review');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is((select is_frozen from public.bonus_file_members('00000000-0000-4000-8000-000000000001', array[(select number from numbers where person = '215')])),
  true, 'the preview reads Ritika as frozen');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(2, '216', 'add', 50, 'Diwali gift'), pg_temp.line(3, '215', 'add', 50, 'Diwali gift'))),
  'RVMBR 3', 'a line for her is refused, by its line');
reset role;

-- Promotions stopped: no file goes.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test 597', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is(pg_temp.refusal(jsonb_build_array(pg_temp.line(2, '216', 'add', 500, 'Diwali gift'))), 'RVKIL ', 'promotions stopped: refused');
reset role;

select * from finish();
rollback;
