-- A sign-in that sees only top-up requests (redesign RD-32): guest relations accept a request and mark it done, read who
-- took each step and how long it took, and read past requests by day, a page at a time; nothing else in the venue is
-- theirs to read or change. 103 Aditya is an admin and gives the role; 106 Pema, a dealer, handles no top-up. Pooja Nair
-- is the seed's guest relations desk (0d0791). 211 Ishaan and 212 Vihaan are seated and ask.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
delete from public.top_up_request;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
-- Today's club day, read before anyone signs in: the helper is not theirs to call.
create temp table today as select private.club_day_of(now()) as day;
grant select on today to authenticated;

-- The role and its one permission.
select set_eq($$ select permission from public.role_permission where role = 'guest_relations' $$, $$ values ('top_ups.manage') $$,
  'guest relations hold one permission');
select set_eq($$ select role::text from public.role_permission where permission = 'top_ups.manage' $$,
  $$ values ('super_admin'), ('admin'), ('guest_relations') $$, 'which super admins and admins hold too, to give the role');
select is_empty($$ select polname from pg_policy where pg_get_expr(polqual, polrelid) like '%top_ups.manage%' or pg_get_expr(polwithcheck, polrelid) like '%top_ups.manage%' $$,
  'no policy on any table names it: it opens no table');

-- An admin gives the role; a floor manager's own role could not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'guest_relations'), true, 'an admin may give the role');
select isnt(public.seat_member(pg_temp.t('Table 3'), 1, '9000000211'), null, 'the floor seats Ishaan');
select isnt(public.seat_member(pg_temp.t('Table 3'), 2, '9000000212'), null, 'and Vihaan');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0703');
select is(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'guest_relations'), true, 'another admin too');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'guest_relations'), false, 'a dealer gives no role');

-- Two members ask.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.request_top_up() $$, 'Ishaan asks for a top-up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.request_top_up() $$, 'Vihaan asks for one');
reset role;
insert into ids select 'ishaan', r.session_id from public.top_up_request r where r.member_id = '00000000-0000-4000-8000-000000000211';
insert into ids select 'vihaan', r.session_id from public.top_up_request r where r.member_id = '00000000-0000-4000-8000-000000000212';
-- Ishaan asked ninety seconds ago.
update public.top_up_request set requested_at = now() - interval '90 seconds' where member_id = '00000000-0000-4000-8000-000000000211';
update public.seat_session set top_up_requested_at = now() - interval '90 seconds' where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;

-- Guest relations: sees both, accepts one and marks it done.
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0791');
select results_eq($$ select full_name, status, accepted_by, done_by from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') order by full_name $$,
  $$ values ('Ishaan Verma'::text, 'requested'::text, null::text, null::text), ('Vihaan Kapoor', 'requested', null, null) $$,
  'guest relations see tonight''s requests');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), true) $$, 'accept one');
select results_eq($$ select status, accepted_by, accepted_seconds between 90 and 95, done_by, done_seconds
                     from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma' $$,
  $$ values ('in_progress'::text, 'Pooja Nair'::text, true, null::text, null::integer) $$,
  'it says who accepted it, and how long from asked to accepted');
reset role;
update public.top_up_request set started_at = now() - interval '40 seconds' where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0791');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), false) $$, 'and mark it done');
select results_eq($$ select status, accepted_by, done_by, done_seconds between 40 and 45
                     from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Ishaan Verma' $$,
  $$ values ('fulfilled'::text, 'Pooja Nair'::text, 'Pooja Nair'::text, true) $$, 'it says who marked it done, and how long from accepted to done');
select lives_ok($$ select public.undo_top_up((select r.id from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') t
                                               join lateral (select t.request_id as id) r on true where t.full_name = 'Ishaan Verma')) $$,
  'a step of the last two minutes is theirs to undo, as the floor''s is');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), false) $$, 'and to finish again');

-- The floor still handles them, by its own permission.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'vihaan'), true) $$, 'the floor accepts the other, as before');
select is((select accepted_by from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where full_name = 'Vihaan Kapoor'), 'Aditya Malhotra',
  'and is named on it');

-- Past requests by day, paged.
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0791');
select results_eq($$ select full_name, status, total from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today)) $$,
  $$ values ('Vihaan Kapoor'::text, 'in_progress'::text, 2::bigint), ('Ishaan Verma', 'fulfilled', 2) $$, 'today''s requests, the newest first, with how many there are');
select results_eq($$ select full_name, total from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today), 2, 1) $$,
  $$ values ('Ishaan Verma'::text, 2::bigint) $$, 'a page at a time');
select is_empty($$ select 1 from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today) - 1) $$, 'none on a day with none');
select is((select count(*)::integer from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today), 1, 100000)), 2,
  'and never more than 200 rows are asked of the database at once');

-- Nothing else is theirs: no seat map, no waitlist, no member, visit, seat, Bonus, identity check, order or audit line, and
-- nothing to change. What every staff sign-in reads of its own venue (its name, tables, stakes, settings and colleagues'
-- names, by policies that name no permission) is not narrowed here (decision 0610).
select is((select count(*)::integer from public.floor_seats('00000000-0000-4000-8000-000000000001')), 0, 'guest relations read no seat map');
select is((select count(*)::integer from public.waitlist_board('00000000-0000-4000-8000-000000000001')), 0, 'nor the waitlist');
select is((select count(*)::integer from public.members_of_tier('00000000-0000-4000-8000-000000000001')), 0, 'nor the members');
select is((select count(*)::integer from public.member), 0, 'nor a member''s row');
select is((select count(*)::integer from public.seat_session), 0, 'nor a seat');
select throws_ok($$ select count(*) from public.top_up_request $$, '42501', null, 'nor the requests'' own table, which nobody reads but through the functions');
select is((select count(*)::integer from public.fnb_item), 0, 'nor the menu');
select is((select count(*)::integer from public.visit), 0, 'nor a visit');
select is((select count(*)::integer from public.bonus_grant), 0, 'nor a Bonus');
select is((select count(*)::integer from public.kyc_record), 0, 'nor an identity check');
select is((select count(*)::integer from public.fnb_order), 0, 'nor an order');
select is((select count(*)::integer from public.audit_log), 0, 'nor the audit log');
select throws_ok($$ select public.seat_member(pg_temp.t('Table 3'), 3, '9000000213') $$, '42501', null, 'they seat nobody');
select throws_ok($$ select public.add_to_waitlist(pg_temp.t('Table 3'), '9000000213', gen_random_uuid()) $$, '42501', null, 'and add nobody to a list');
select is((select count(*)::integer from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue <> 'topUps'), 0,
  'their rail counts top-ups and nothing else');

-- A dealer, and another venue's guest relations, handle none here.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')), 0, 'a dealer reads no top-ups');
select throws_ok($$ select public.set_top_up((select id from ids where name = 'vihaan'), false) $$, '42501', null, 'and handles none');
select is((select count(*)::integer from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today))), 0, 'nor reads a past day');
reset role;
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000434e1', 'Elsewhere', 'elsewhere-top-ups', false, 'Elsewhere Ltd', 'Somewhere', 'ELT');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000434e2', 'authenticated', 'authenticated', '919999000434', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000434e1', '00000000-0000-4000-8000-0000000434e2', 'Elsewhere Desk', 'Guest relations', 'guest_relations');
select pg_temp.as_person('00000000-0000-4000-8000-0000000434e2');
select is((select count(*)::integer from public.top_ups_tonight('00000000-0000-4000-8000-000000000001')), 0, 'another venue''s guest relations read none here');
select throws_ok($$ select public.set_top_up((select id from ids where name = 'vihaan'), false) $$, '42501', null, 'and handle none here');

reset role;
select is(has_function_privilege('anon', 'public.top_up_history(uuid, date, integer, integer)', 'execute'), false, 'no one signed out reads a past day');
select is(has_function_privilege('anon', 'public.top_ups_tonight(uuid)', 'execute'), false, 'or tonight');

select * from finish();
rollback;
