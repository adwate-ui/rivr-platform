-- A promotion waits for a super admin (#144; question #507; decision 0244). 107 Ishita (marketing) and 102 Meera (a
-- super admin) submit; 101 Vikram, a super admin, approves or refuses; nobody approves what they submitted. 103 Aditya
-- (admin) manages promotions but approves none; 104 Sana (cashier) does neither.
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
create temp table body as select jsonb_build_object(
  'name', 'Late night points', 'runs', 'Every night, 00:00 to 04:00',
  'rule', jsonb_build_object('trigger', 'hours_played', 'effect', '{"kind": "points", "points": 50}'::jsonb)) as promotion;
grant select on body to authenticated;
create function pg_temp.staff_of(p_person text) returns uuid language sql as $$
  select id from public.staff where user_id = ('00000000-0000-4000-8000-000000000' || p_person)::uuid
                                and venue_id = '00000000-0000-4000-8000-000000000001';
$$;

-- Submitted, a promotion waits; the list says who submitted it, and whether the reader did.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'late', public.submit_promotion('00000000-0000-4000-8000-000000000001', (select promotion from body));
select results_eq($$ select name, requested_by, is_mine from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Late night points'::text, 'Ishita Bose'::text, true) $$, 'marketing''s submission waits, and the list says it is hers');
select results_eq($$ select rules -> 0 -> 'effect', rules -> 0 ->> 'trigger', per_player_limit, budget_paise
                     from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('{"kind": "points", "points": 50}'::jsonb, 'hours_played'::text, null::integer, null::bigint) $$,
  'with what it actually does: the rule as stored, its limit and its budget, not only the words typed');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_promotion_live((select id from ids where name = 'late'), true) $$, '42501', null,
  'a cashier resumes nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.set_promotion_live((select id from ids where name = 'late'), true) $$, '22023', null,
  'and a waiting promotion is not put live by resuming it');
select is_empty($$ select * from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000002') $$,
  'nor does the club''s staff see the practice venue''s waiting list');
reset role;
select results_eq($$ select status, requested_by_staff_id from public.promotion where id = (select id from ids where name = 'late') $$,
  $$ select 'pending'::text, pg_temp.staff_of('107') $$, 'it is pending, with who submitted it');
select is_empty($$ select 1 from public.outbox_event where idempotency_key = 'promotion.published:' || (select id from ids where name = 'late') $$,
  'and nothing is announced');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001') $$, 'a cashier sees no waiting list');

-- Approval: super admins only.
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'late')) $$, '42501', null, 'a cashier approves nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'late')) $$, '42501', null, 'nor does marketing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'late')) $$, '42501', null,
  'nor an admin, who manages promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select is_mine from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001') $$, $$ values (false) $$,
  'a super admin sees it is someone else''s');
select lives_ok($$ select public.approve_promotion((select id from ids where name = 'late')) $$, 'and approves it');
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'late')) $$, 'RVDEC', null,
  'once: a second super admin is told it was already decided');
reset role;
select results_eq($$ select status, decided_by_staff_id from public.promotion where id = (select id from ids where name = 'late') $$,
  $$ select 'live'::text, pg_temp.staff_of('101') $$, 'it is live, with who approved it');
select is((select payload ->> 'name' from public.outbox_event where idempotency_key = 'promotion.published:' || (select id from ids where name = 'late')),
  'Late night points', 'and promotion.published goes out');

-- Never one's own: a super admin's submission needs another super admin.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
insert into ids select 'own', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select jsonb_set(promotion, '{name}', '"Own points"') from body));
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'own')) $$, 'RVTWO', null,
  'a super admin does not approve their own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion((select id from ids where name = 'own')) $$, 'another super admin does');

-- Refusal: back to draft, with the reason; a refused template is submitted again from its draft.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'refused', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select jsonb_set(promotion, '{name}', '"Too generous"') from body));
select throws_ok($$ select public.refuse_promotion((select id from ids where name = 'refused'), 'No budget') $$, '42501', null,
  'marketing refuses nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.refuse_promotion((select id from ids where name = 'refused'), 'No') $$, '22023', null, 'a refusal says why');
select lives_ok($$ select public.refuse_promotion((select id from ids where name = 'refused'), 'Fifty points a night is too many') $$,
  'a super admin refuses it');
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'refused')) $$, 'RVDEC', null, 'and it cannot then be approved');
reset role;
select results_eq($$ select status, refused_reason from public.promotion where id = (select id from ids where name = 'refused') $$,
  $$ values ('draft'::text, 'Fifty points a night is too many'::text) $$, 'it is a draft again, with the reason');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select results_eq($$ select name, refused_by, refused_reason from public.promotions_sent_back('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Too generous'::text, 'Vikram Rao'::text, 'Fifty points a night is too many'::text) $$,
  'and the one who submitted it reads who sent it back, and why');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.promotions_sent_back('00000000-0000-4000-8000-000000000001') $$, 'a cashier reads none of it');
reset role;
update public.promotion set status = 'draft' where template_key = 'referral' and venue_id = '00000000-0000-4000-8000-000000000001';
insert into ids select 'referral', id from public.promotion where template_key = 'referral' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.submit_promotion_template((select id from ids where name = 'referral')) $$, 'a template is submitted');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.refuse_promotion((select id from ids where name = 'referral'), 'Not this month') $$, 'refused');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.submit_promotion_template((select id from ids where name = 'referral')) $$, 'and submitted again');
reset role;
select results_eq($$ select status, refused_reason, decided_by_staff_id from public.promotion where id = (select id from ids where name = 'referral') $$,
  $$ values ('pending'::text, null::text, null::uuid) $$, 'waiting afresh, the old refusal cleared');

-- Not while promotions are switched off; and the approval permission is a super admin's alone.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.approve_promotion((select id from ids where name = 'referral')) $$, 'RVKIL', null,
  'nothing is approved while promotions are switched off');
select throws_ok($$ select public.refuse_promotion((select id from ids where name = 'referral'), 'Not now') $$, 'RVKIL', null,
  'nor refused');
reset role;
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001')
where venue_id = '00000000-0000-4000-8000-000000000001' and level = 'feature_kill' and feature = 'promotions';
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.refuse_promotion((select id from ids where name = 'referral'), 'Not now') $$, 'RVFRZ', null,
  'nor while the venue is frozen');
reset role;
select throws_ok($$ insert into public.role_permission (role, permission) values ('admin', 'promotions.approve') $$, '23514', null,
  'no role but super admin may hold promotions.approve');

select * from finish();
rollback;
