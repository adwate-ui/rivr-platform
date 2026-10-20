-- Dual control (#20, decision 0063). The club's threshold is ₹1,00,000 (the seed). 104 and 105 are
-- cashiers (cage.transact, cage.second_approve); 106 Pema a dealer. A write names its first approver
-- (the staff member who decides it); approvals are recorded from each approver's own session.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Signs in as a staff member for the private functions, which the server's own writes call.
create function pg_temp.as_staff(p_person text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.staff(p_person text) returns uuid language sql as $$
  select id from public.staff where user_id = p_person::uuid and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_staff(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select on ids to authenticated;
insert into ids values ('withdrawal', gen_random_uuid()), ('small', gen_random_uuid()), ('other', gen_random_uuid());
-- The write's guard for the withdrawal, with its amount and first approver.
create function pg_temp.guard(p_amount bigint, p_first text) returns void language sql as $$
  select private.assert_second_approved('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'withdrawal'), p_amount, now(),
                                        case when p_first is null then null else pg_temp.staff(p_first) end);
$$;

-- From the threshold up, in force at the write's time.
select is(private.second_approver_needed('00000000-0000-4000-8000-000000000001', 9995000, now()), false, '₹99,950 needs no second approver');
select is(private.second_approver_needed('00000000-0000-4000-8000-000000000001', 10000000, now()), true, '₹1,00,000 does, as flow 9 has it');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.second_approver_threshold', '', '{"threshold_paise": 20000000}', now() + interval '1 hour', 'Raised');
select is(private.second_approver_needed('00000000-0000-4000-8000-000000000001', 15000000, now()), true, '₹1,50,000 does now');
select is(private.second_approver_needed('00000000-0000-4000-8000-000000000001', 15000000, now() + interval '2 hours'), false,
  'and not once the raised threshold is in force');
select is(private.second_approver_needed('00000000-0000-4000-8000-0000000000e1', 5000, now()), true, 'with no threshold set, every amount does');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'cage.second_approver_threshold', '', '{"threshold_paise": 1020}', now() + interval '1 day', 'Odd') $$,
  '23514', null, 'a threshold is whole ₹50 chips');

-- Without a second approver the write is refused; a write must name its first approver.
select throws_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000104') $$, 'RVAPP', null,
  'a ₹1,00,000 withdrawal is refused without a second approver');
select lives_ok($$ select private.assert_second_approved('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'small'), 5000000, now(),
  pg_temp.staff('00000000-0000-4000-8000-000000000104')) $$, 'a ₹50,000 one goes ahead without');
select throws_ok($$ select pg_temp.guard(5000000, null) $$, '42501', null, 'and none goes ahead without its first approver named');

-- The first approver is not their own second; another approver is.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
insert into ids select 'by 104', private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'withdrawal'), 10000000);
select throws_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000104') $$, 'RVAPP', null,
  'the cashier who approved it is not the second approver of their own write');
select lives_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000105') $$, 'with another cashier as first approver, it goes ahead');
select throws_ok($$ select pg_temp.guard(12000000, '00000000-0000-4000-8000-000000000105') $$, 'RVAPP', null, 'never for another amount');
select throws_ok($$ select private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'withdrawal'), 12000000) $$,
  '22023', null, 'and an approval is for one amount');
select is(private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'withdrawal'), 10000000),
  (select id from ids where name = 'by 104'), 'approving again gives the same approval');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000105');
insert into ids select 'by 105', private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'withdrawal'), 10000000);
select isnt((select id from ids where name = 'by 105'), (select id from ids where name = 'by 104'), 'another approver''s approval is their own');
select lives_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000104') $$,
  'so with 104 as first approver, 105''s approval lets it go ahead');
select results_eq($$ select a.amount_paise, s.user_id from public.second_approval a join public.staff s on s.id = a.approved_by_staff_id
                     where a.subject_id = (select id from ids where name = 'withdrawal') order by s.user_id $$,
  $$ values (10000000::bigint, '00000000-0000-4000-8000-000000000104'::uuid), (10000000, '00000000-0000-4000-8000-000000000105') $$,
  'each approval names its approver and amount');
select is((select count(*)::integer from public.audit_log where entity = 'second_approval' and entity_id = (select id from ids where name = 'by 104')::text), 1,
  'and is audited');
select throws_ok($$ update public.second_approval set amount_paise = 1 $$, '42501', null, 'and never changed');

-- An approval counts only while its approver is active.
update public.staff set is_active = false where id = pg_temp.staff('00000000-0000-4000-8000-000000000105');
select throws_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000104') $$, 'RVAPP', null,
  'an approver let go since approving no longer counts');
update public.staff set is_active = true where id = pg_temp.staff('00000000-0000-4000-8000-000000000105');

-- Who may approve: not a dealer, not another venue's cashier, no app directly.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'other'), 10000000) $$,
  '42501', null, 'a dealer approves nothing');
update public.staff set is_active = false where id = pg_temp.staff('00000000-0000-4000-8000-000000000105');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000105');
select throws_ok($$ select private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'other'), 10000000) $$,
  '42501', null, 'nor does the practice venue''s cashier at the club');
select set_config('role', 'authenticated', true);
select is_empty($$ select * from public.second_approval $$, 'and sees none of the club''s approvals');
reset role;
update public.staff set is_active = true where id = pg_temp.staff('00000000-0000-4000-8000-000000000105');
select set_config('role', 'authenticated', true);
select throws_ok($$ select private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'other'), 10000000) $$,
  '42501', null, 'and no app calls it directly');

-- Who sees approvals: the cage; not a dealer.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.second_approval), 2, 'the cage sees the venue''s approvals');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.second_approval $$, 'a dealer does not');
reset role;

-- An approver whose access is revoked no longer counts; a frozen venue approves nothing.
insert into public.control_state (venue_id, level, staff_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'access_revoke', pg_temp.staff('00000000-0000-4000-8000-000000000105'), 'Under review');
select throws_ok($$ select pg_temp.guard(10000000, '00000000-0000-4000-8000-000000000104') $$, 'RVAPP', null,
  'an approver whose access is revoked no longer counts');
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select private.record_second_approval('00000000-0000-4000-8000-000000000001', 'withdrawal', (select id from ids where name = 'other'), 10000000) $$,
  'RVFRZ', null, 'nothing is approved while the venue is frozen');

select * from finish();
rollback;
