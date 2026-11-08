-- The 21+ check for every order source (#757; the security review of decision 0302): a member under 21 gets no alcohol
-- from the app, the dealer's tablet or the console, comped or paid; food still comes from all three, and at 21 the bar
-- serves him from any of them. Yash (214) sits at Table 3, seat 5; Tablet A there with Pema's down (as 171_fnb_orders);
-- 103 Aditya is an admin (fnb.manage).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table items on commit drop as select name, id::text as id from public.fnb_item where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on items to authenticated;
create function pg_temp.lines(p_name text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('item_id', (select id from items where name = p_name), 'quantity', 1));
$$;
grant execute on function pg_temp.lines(text) to authenticated;
create function pg_temp.table_3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
grant execute on function pg_temp.table_3() to authenticated;

delete from public.tablet_assignment;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table where id = pg_temp.table_3();
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'fnb.table_side', true, 'Test');
insert into public.kyc_record (venue_id, member_id, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', (private.club_day_of(now()) - interval '20 years')::date)
on conflict (member_id) do update set date_of_birth = excluded.date_of_birth;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_3(), 5, '9000000214');
reset role;

-- At 20: no alcohol from the tablet, nor from the console, paid or comped.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select * from public.tablet_fnb_order(5, pg_temp.lines('Whisky')) $$, 'RVAGE', null, 'the dealer''s tablet orders him no alcohol at 20');
select lives_ok($$ select * from public.tablet_fnb_order(5, pg_temp.lines('Club sandwich')) $$, 'though it still orders his food');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table_3(), 5, pg_temp.lines('Whisky'), false) $$,
  'RVAGE', null, 'nor does the console, paid');
select throws_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table_3(), 5, pg_temp.lines('Whisky'), true) $$,
  'RVAGE', null, 'nor comped, admin or not');
select lives_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table_3(), 5, pg_temp.lines('French fries'), true) $$,
  'and the console still comps his food');
reset role;

-- At 21 every source serves him.
update public.kyc_record set date_of_birth = (private.club_day_of(now()) - interval '21 years')::date where member_id = '00000000-0000-4000-8000-000000000214';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select * from public.tablet_fnb_order(5, pg_temp.lines('Whisky')) $$, 'at 21 the tablet orders his whisky');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select * from public.console_fnb_order('00000000-0000-4000-8000-000000000001', pg_temp.table_3(), 5, pg_temp.lines('Whisky'), true) $$,
  'and the console comps one');
reset role;

select * from finish();
rollback;
