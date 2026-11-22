-- Cashiers see all of Members to view and handle Bonus (the owner, 22 Nov; decision 0709): the mobiles, the record's
-- number and the feature overrides as the floor does; Bonus added by hand, used without a seat, a missed use added to a
-- past seat, and any Bonus reversed. Never Bonus from a file, an override, erasure or a member's phone changed. 104 Sana is
-- a cashier, 101 Vikram a super admin, 108 Karan a host; 212 Vihaan plays.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated',
           'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into ids values ('vihaan', '00000000-0000-4000-8000-000000000212');
create temp table phones on commit drop as select id, phone from public.member where id = '00000000-0000-4000-8000-000000000212';
grant select on phones to authenticated;

select results_eq($$ select permission from public.role_permission where role = 'cashier'
                     and permission in ('members.phone', 'bonus.give', 'bonus.correct', 'members.manage', 'members.change_phone',
                                        'members.override_features', 'members.erase') order by 1 $$,
  $$ values ('bonus.correct'), ('bonus.give'), ('members.phone') $$,
  'a cashier reads mobiles and handles Bonus, and changes no member, phone, override or erasure');
select ok(exists (select 1 from public.role_permission where role = 'super_admin' and permission = 'bonus.correct'),
  'super admins keep reversing and adding missed uses');

-- Vihaan sits at Table 5, which checks him in.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'seat', public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'),
                                                  2, '9000000212', p_call_minutes => 180);

-- Members, to view.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select phone from public.members_page('00000000-0000-4000-8000-000000000001', '{"query": "Vihaan", "page_size": 50}')
           where member_id = (select id from ids where name = 'vihaan')), (select phone from phones), 'a cashier reads the mobile in the list');
select is((select phone from public.member_record('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan'))),
  (select phone from phones), 'and on the record');
select lives_ok($$ select * from public.member_feature_overrides('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan')) $$,
  'and reads the feature overrides');
select throws_ok($$ select public.set_feature_override('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan'), 'call_time.view',
                      false, 'Not yet') $$, '42501', null, 'but overrides none');

-- Bonus: added, used, a missed use added, and reversed.
select lives_ok($$ select public.give_bonus_chips((select id from ids where name = 'vihaan'), 1000, 'Birthday', gen_random_uuid()) $$,
  'a cashier adds Bonus by hand');
select lives_ok($$ select public.use_bonus((select id from ids where name = 'vihaan'), 200, 'Chips at the cage', gen_random_uuid()) $$,
  'uses Bonus without a seat');
reset role;
-- Past the seat's Undo, so a use may be added to it.
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours'
where id = (select id from ids where name = 'seat');
insert into ids select 'grant', g.id from public.bonus_grant g where g.member_id = '00000000-0000-4000-8000-000000000212'
  and g.amount_paise = 100000 order by g.created_at desc limit 1;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select ok(exists (select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan'))
                  where session_id = (select id from ids where name = 'seat')), 'sees the seats a missed use goes to');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 100, 'Missed at the seat', gen_random_uuid()) $$,
  'adds a use a seat missed');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 100000, 'Missed at the seat', gen_random_uuid()) $$,
  'RVBON', null, 'but none past the Bonus held: only a super admin''s goes below zero (decision 0709)');
select ok(public.reverse_bonus((select id from ids where name = 'grant'), 'Given by mistake') > 0, 'reverses the Bonus given');
select throws_ok($$ select public.bonus_from_file('00000000-0000-4000-8000-000000000001', '[]'::jsonb, gen_random_uuid()) $$, '42501', null,
  'but adds or uses none from a file');
reset role;
select is((select reversed_by_staff_id from public.bonus_grant where id = (select id from ids where name = 'grant')),
  (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
  'the reversal names the cashier');

-- The reversal took back Bonus already used, so Vihaan owes some: a cashier adds no use now, a super admin still may.
select ok(private.bonus_owed_by((select id from ids where name = 'vihaan')) > 0, 'Vihaan owes Bonus');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 50, 'Missed at the seat', gen_random_uuid()) $$,
  'RVBON', null, 'with some owed, a cashier adds no use');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.add_bonus_use((select id from ids where name = 'seat'), 50, 'Missed at the seat', gen_random_uuid()) $$,
  'a super admin still does');
reset role;

-- Never on her own record: Sana signs up on her own login.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'sana', public.sign_up('Sana Qureshi', '{}');
reset role;
insert into ids select 'hers', private.credit_bonus('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'sana'), 50000,
  'A test grant', null, 'test601:hers');
insert into ids select 'other', private.credit_bonus('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan'), 50000,
  'A test grant', null, 'test601:other');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'hers'), 'Taking it back') $$, 'RVOWN', null,
  'a cashier reverses none on her own record');
reset role;

-- No longer at the club, though still a cashier at the practice venue: nothing there.
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'other'), 'Given by mistake') $$, '42501', null,
  'a cashier who left the club reverses none of its Bonus');
select is_empty($$ select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan')) $$,
  'nor sees its seats');
reset role;

-- A host still reverses nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.reverse_bonus((select id from ids where name = 'grant'), 'Given by mistake') $$, '42501', null, 'a host reverses no Bonus');
select is_empty($$ select 1 from public.bonus_use_seats('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'vihaan')) $$,
  'nor sees the seats to add a use to');
reset role;

select * from finish();
rollback;
