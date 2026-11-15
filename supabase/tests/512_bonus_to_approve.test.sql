-- Bonus to approve (decision 0670): the queue a super admin works through, a page at a time on the server, with the rail's
-- count, and who may decide. 101 Vikram and 102 Meera are super admins, 103 Aditya an admin, 107 Ishita marketing (the
-- seed). Members 211 to 214 are given a check-in Bonus that waits.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.m(p_member text) returns uuid language sql as $$ select ('00000000-0000-4000-8000-000000000' || p_member)::uuid $$;
grant execute on function pg_temp.m(text) to authenticated;
create function pg_temp.live(p_name text, p_chips integer) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', p_name, jsonb_build_object('kind', 'bonus_chips', 'chips', p_chips, 'on', 'visit'),
          '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text,
                             'timezone', 'Asia/Kolkata'),
          '{"perMember": "none"}', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
-- The grant of a member's check-in.
create function pg_temp.grant_of(p_member text) returns uuid language sql as $$
  select id from public.promotion_grant where member_id = pg_temp.m(p_member) and source_key like 'check_in:512-%';
$$;
grant execute on function pg_temp.grant_of(text) to authenticated;
create temporary table page on commit drop as select * from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001') limit 0;
grant select, insert, delete on page to authenticated;

select pg_temp.live('Visit 512', 300);
select count(*) from unnest(array['211', '212', '213', '214']) x
cross join lateral private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'check_in',
  jsonb_build_object('member_id', pg_temp.m(x), 'key', 'check_in:512-' || x));
-- Mihir's waited since yesterday.
update public.promotion_grant set club_day = club_day - 1, created_at = created_at - interval '1 day',
  event = event || jsonb_build_object('at', now() - interval '1 day')
where id = pg_temp.grant_of('213');

-- The queue, as a super admin reads it: oldest first, each with its member, promotion, amount, why and when.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into page select * from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001');
select results_eq($$ select total, right(member_id::text, 3), member_number, promotion_name, amount_paise, trigger from page $$,
  $$ values (4::bigint, '213'::text, (select member_number from public.member where id = pg_temp.m('213')), 'Visit 512'::text, 30000::bigint, 'check_in'::text),
            (4, '211', (select member_number from public.member where id = pg_temp.m('211')), 'Visit 512', 30000, 'check_in'),
            (4, '212', (select member_number from public.member where id = pg_temp.m('212')), 'Visit 512', 30000, 'check_in'),
            (4, '214', (select member_number from public.member where id = pg_temp.m('214')), 'Visit 512', 30000, 'check_in') $$,
  'four waiting, the one waiting since yesterday first');
delete from page;
insert into page select * from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001', '{"filters": {"when": {"kind": "date", "preset": "today"}}}');
select is((select string_agg(right(member_id::text, 3), ' ' order by member_id) from page), '211 212 214', 'today''s alone, by its date');
delete from page;
insert into page select * from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001', '{"query": "Mihir"}');
select is((select right(member_id::text, 3) from page), '213', 'searched by name');
select results_eq($$ select column_key, value, members from public.list_choices('bonus_waiting', '00000000-0000-4000-8000-000000000001', '{}') order by 1, 2 $$,
  $$ values ('promotion'::text, 'Visit 512'::text, 4::bigint), ('why', 'check_in', 4) $$, 'its menus count by promotion and by why');
select is((select waiting from private.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'bonusApprovals'), 4,
  'the rail counts them for a super admin');

-- Nobody else: an admin and marketing see none and decide none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001')), 0, 'an admin''s queue is empty');
select is_empty($$ select 1 from private.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'bonusApprovals' $$,
  'and the rail counts none for an admin');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('211')], gen_random_uuid()) $$,
  '42501', null, 'an admin approves nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select * from public.refuse_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('211')], 'Not ours', gen_random_uuid()) $$,
  '42501', null, 'nor marketing refuses');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('211')], gen_random_uuid()) $$,
  '42501', null, 'nor a member their own');

-- What a decision needs: Bonus chosen, a request id, and to refuse, a reason.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', '{}', gen_random_uuid()) $$, '22023', null, 'none chosen is refused');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('211')], null) $$,
  '22023', null, 'so is no request id');
select throws_ok($$ select * from public.refuse_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('211')], ' x ', gen_random_uuid()) $$,
  '22023', null, 'and a refusal without a reason');

-- Never one's own record: Meera, a super admin, by the mobile number of Vihaan's record.
reset role;
update public.member set phone = (select s.phone from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where id = pg_temp.m('212');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('212')], gen_random_uuid()) $$,
  'RVOWN', null, 'a super admin never approves a Bonus for their own record');
select is((select count(*)::integer from public.bonus_waiting_page('00000000-0000-4000-8000-000000000001') where member_id = pg_temp.m('212')), 0,
  'nor sees it in the queue');
select is((select waiting from private.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'bonusApprovals'), 3,
  'nor counts it');

-- Approved, then the same request again: answered with its first try, nothing posted twice.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select grants, amount_paise from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                       array[pg_temp.grant_of('211'), pg_temp.grant_of('213')], '00000000-0000-4000-8000-000000512001') $$,
  $$ values (2, 60000::bigint) $$, 'Vikram approves two');
select results_eq($$ select grants, amount_paise from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                       array[pg_temp.grant_of('211'), pg_temp.grant_of('213')], '00000000-0000-4000-8000-000000512001') $$,
  $$ values (2, 60000::bigint) $$, 'the same press again is answered the same');
select throws_ok($$ select * from public.refuse_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('214')], 'Not ours',
                     '00000000-0000-4000-8000-000000512001') $$, '22023', null, 'and its request id is not another decision''s');
select results_eq($$ select grants, amount_paise from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                       array[pg_temp.grant_of('211')], gen_random_uuid()) $$,
  $$ values (0, 0::bigint) $$, 'a Bonus another press decided is left as decided');
reset role;
select is((select count(*)::integer from public.bonus_grant where idempotency_key = 'promotion:' || pg_temp.grant_of('211')), 1, 'posted once');

-- Activity: one line a decision, with who, how many and the total.
select results_eq($$ select a.who, a.action, a.kind, a.about, a.amount from private.activity_line a
                     where a.entity = 'promotion_bonus_decision' and a.venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('Vikram Rao'::text, 'bonus.approve'::text, 'bonus_chips'::text, '2'::text, 600::bigint) $$, 'Activity has one line: Vikram approved two, 600 in all');
select results_eq($$ select d.decision, d.grants, d.amount_paise, d.reason, s.full_name from public.promotion_bonus_decision d
                     join public.staff s on s.id = d.decided_by_staff_id where d.request_id = '00000000-0000-4000-8000-000000512001' $$,
  $$ values ('approved'::text, 2, 60000::bigint, null::text, 'Vikram Rao'::text) $$, 'and the decision keeps who decided');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.promotion_bonus_decision $$, 'an admin reads no decision');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select isnt_empty($$ select 1 from public.promotion_bonus_decision $$, 'a super admin reads them');

-- The member's record lists what was given: Ishaan's approved Bonus, not Yash's waiting one.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.member_promotion_grants(pg_temp.m('211'), 20)), 1, 'an approved Bonus is on the member''s record');
select is((select count(*)::integer from public.member_promotion_grants(pg_temp.m('214'), 20)), 0, 'a waiting one is not');

-- A frozen venue decides nothing.
reset role;
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test 512', s.id from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001', array[pg_temp.grant_of('214')], gen_random_uuid()) $$,
  'RVFRZ', null, 'a frozen venue approves nothing');
reset role;
select is((select status from public.promotion_grant where id = pg_temp.grant_of('214')), 'waiting', 'and Yash''s still waits');

select * from finish();
rollback;
