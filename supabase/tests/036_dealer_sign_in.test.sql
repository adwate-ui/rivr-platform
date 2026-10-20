-- Dealer sign-in and downs (#41): staff managers who may grant a dealer's role set its PIN; on a
-- tablet fixed to a table a dealer signs in with it and their down starts, ending the one before;
-- five wrong PINs lock it; End of down stamps the off time. 101 Vikram (super admin, the owner) sets
-- PINs; 103 Aditya is an admin, who may not; 106 Pema is a dealer; 104 Sana a cashier; 201 Arjun a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000002');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet B', '00000000-0000-4000-8000-00000000e002');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
-- Tashi, a dealer who signs in only on a tablet.
insert into public.staff (id, venue_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-000000000001', 'Tashi Namgyal', 'Dealer', 'dealer');

-- Staff ids, read here as postgres: a tablet or a member cannot read the staff table.
create temporary table staff_ids on commit drop as
select (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000106' and venue_id = '00000000-0000-4000-8000-000000000001') as pema,
       (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000106' and venue_id = '00000000-0000-4000-8000-000000000002') as pema_practice,
       (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001') as sana;
grant select on staff_ids to authenticated;
create function pg_temp.pema() returns uuid language sql as $$ select pema from staff_ids; $$;
create function pg_temp.pema_practice() returns uuid language sql as $$ select pema_practice from staff_ids; $$;
create function pg_temp.sana() returns uuid language sql as $$ select sana from staff_ids; $$;
grant execute on function pg_temp.pema(), pg_temp.pema_practice(), pg_temp.sana() to authenticated;

-- PINs.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_dealer_pin(pg_temp.pema(), '2741') $$, '42501', null, 'a cashier sets no PIN');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_dealer_pin(pg_temp.pema(), '2741') $$, '42501', null,
  'nor an admin: a dealer logs hands, which an admin may not, so the PIN would let them');
select is_empty($$ select * from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'and an admin lists no dealers to set');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.set_dealer_pin(pg_temp.sana(), '2741') $$, '42501', null, 'the owner sets none for someone who deals no hands');
select throws_ok($$ select public.set_dealer_pin(pg_temp.pema(), '1111') $$, '22023', null, 'a PIN is not one digit four times');
select throws_ok($$ select public.set_dealer_pin(pg_temp.pema(), '27a1') $$, '22023', null, 'and is four digits');
select lives_ok($$ select public.set_dealer_pin(pg_temp.pema(), '2741') $$, 'the owner sets Pema''s PIN');
select lives_ok($$ select public.set_dealer_pin('00000000-0000-4000-8000-00000000f001', '5820') $$, 'and Tashi''s');
select lives_ok($$ select public.set_dealer_pin(pg_temp.pema_practice(), '2741') $$, 'and Pema''s at the practice venue, the same PIN');
select results_eq($$ select full_name, has_pin from public.venue_dealers('00000000-0000-4000-8000-000000000001') where full_name in ('Pema Lepcha', 'Tashi Namgyal') $$,
  $$ values ('Pema Lepcha'::text, true), ('Tashi Namgyal'::text, true) $$, 'and sees who has one');
select throws_ok($$ select * from public.staff_credential $$, '42501', null, 'no one reads a PIN''s hash');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.venue_dealers('00000000-0000-4000-8000-000000000001') $$, 'a dealer does not list the dealers');
reset role;
select ok((select pin_hash like '$2a$08$%' from public.staff_credential where staff_id = pg_temp.pema()), 'the PIN is kept as a bcrypt hash');

-- On the tablet.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e002');
select throws_ok($$ select * from public.tablet_dealers() $$, '22023', null, 'a tablet not fixed to a table signs no dealer in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.dealer_sign_in(pg_temp.pema(), '2741') $$, '42501', null, 'nor does anyone but a tablet');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select full_name from public.tablet_dealers() $$, $$ values ('Pema Lepcha'::text), ('Tashi Namgyal'::text) $$,
  'the tablet lists the dealers who have a PIN');
select results_eq($$ select down_id is null, refusal, tries_left from public.dealer_sign_in(pg_temp.pema(), '2740') $$,
  $$ values (true, 'wrong_pin'::text, 4) $$, 'a wrong PIN is refused, with the tries left');
select results_eq($$ select down_id is null, refusal, tries_left from public.dealer_sign_in(pg_temp.sana(), '2740') $$,
  $$ values (true, 'wrong_pin'::text, 4) $$, 'someone with no PIN gets the same answer, so the tablet does not tell who has one');
select results_eq($$ select refusal from public.dealer_sign_in(pg_temp.pema_practice(), '2741') $$, $$ values ('wrong_pin'::text) $$,
  'and a PIN from another venue does not sign in here');
select results_eq($$ select down_id is not null, refusal from public.dealer_sign_in(pg_temp.pema(), '2741') $$,
  $$ values (true, null::text) $$, 'the right one starts the down');
select results_eq($$ select full_name, started_at = now() from public.current_down() $$, $$ values ('Pema Lepcha'::text, true) $$,
  'which the tablet shows, with its on time');
select results_eq($$ select refusal from public.dealer_sign_in('00000000-0000-4000-8000-00000000f001', '5820') $$, $$ values (null::text) $$,
  'Tashi takes over the table');
reset role;
select results_eq($$ select s.full_name, d.ended_at is not null from public.dealer_down d join public.staff s on s.id = d.staff_id
                     where d.device_id = '00000000-0000-4000-8000-00000000d001' order by s.full_name $$,
  $$ values ('Pema Lepcha'::text, true), ('Tashi Namgyal'::text, false) $$, 'which ends Pema''s down, off time stamped');
select is((select failed_attempts from public.staff_credential where staff_id = pg_temp.pema()), 0, 'and her right PIN cleared the wrong one');

-- Five wrong PINs lock it until a new one is set.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq(format($$ select refusal, tries_left from public.dealer_sign_in(%L, '0000') $$, pg_temp.pema()),
  format($$ values ('wrong_pin'::text, %s) $$, 5 - n), 'a wrong PIN, one try fewer left') from generate_series(1, 4) as n;
select results_eq($$ select refusal from public.dealer_sign_in(pg_temp.pema(), '0000') $$, $$ values ('locked'::text) $$, 'the fifth locks it');
select results_eq($$ select refusal from public.dealer_sign_in(pg_temp.pema(), '2741') $$, $$ values ('locked'::text) $$, 'even to the right PIN');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt((select locked_until from public.venue_dealers('00000000-0000-4000-8000-000000000001') where full_name = 'Pema Lepcha'), null,
  'the owner sees it locked');
select lives_ok($$ select public.set_dealer_pin(pg_temp.pema(), '6402') $$, 'and sets a new PIN');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select refusal from public.dealer_sign_in(pg_temp.pema(), '6402') $$, $$ values (null::text) $$, 'which works at once');

-- A dealer who moves tables: signing in at Table 2 ends her down at Table 3.
reset role;
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d002', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e002');
select results_eq($$ select refusal from public.dealer_sign_in(pg_temp.pema(), '6402') $$, $$ values (null::text) $$, 'Pema signs in at Table 2');
reset role;
select results_eq($$ select t.name from public.dealer_down d join public.game_table t on t.id = d.table_id
                     where d.staff_id = pg_temp.pema() and d.ended_at is null $$,
  $$ values ('Table 2'::text) $$, 'which ends her down at Table 3: one open down, at Table 2');

-- End of down.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e002');
select lives_ok($$ select * from public.end_down(0) $$, 'End of down');
select is_empty($$ select * from public.current_down() $$, 'leaves the table without a dealer');
select is((select count(*)::integer from public.dealer_down where ended_at is null), 0, 'and every down here has its off time');

-- A dealer whose access is revoked signs in nowhere, and the tablet no longer lists her.
reset role;
insert into public.control_state (venue_id, level, staff_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'access_revoke', '00000000-0000-4000-8000-00000000f001', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select refusal from public.dealer_sign_in('00000000-0000-4000-8000-00000000f001', '5820') $$, $$ values ('wrong_pin'::text) $$,
  'Tashi, revoked, cannot sign in with his PIN');
select results_eq($$ select full_name from public.tablet_dealers() $$, $$ values ('Pema Lepcha'::text) $$, 'and is not listed');

-- Who sees downs, and a freeze.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.dealer_down $$, 'a member sees no downs');
select throws_ok($$ select * from public.dealer_sign_in(pg_temp.pema(), '6402') $$, '42501', null, 'and signs no dealer in');
reset role;
-- A down open when the freeze starts.
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, pg_temp.pema(), a.device_id from public.tablet_assignment a where a.device_id = '00000000-0000-4000-8000-00000000d001';
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select * from public.dealer_sign_in(pg_temp.pema(), '6402') $$, 'RVFRZ', null, 'no down starts while the venue is frozen');
select lives_ok($$ select * from public.end_down(0) $$, 'but a down can end: it moves no money, seat or hand');
select is_empty($$ select * from public.current_down() $$, 'and it has');
reset role;
set local role anon;
select throws_ok($$ select * from public.current_down() $$, '42501', null, 'a visitor calls none of it');
reset role;

select * from finish();
rollback;
