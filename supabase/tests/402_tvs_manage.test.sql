-- A permission for TVs alone (#656; the owner, 3 Nov): Floor and Cashier pair TVs, choose what each shows and unpair one, and reach no
-- other device. 104 is a cashier; a host becomes the Floor member here, as the seed has none; another host stays one.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null order by h.user_id limit 1);
create temp table people on commit drop as
select s.role::text as who, (min(s.user_id::text))::uuid as user_id from public.staff s
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id is not null group by 1;
grant select on people to authenticated;
create function pg_temp.as_who(p_who text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', (select p.user_id from people p where p.who = p_who), 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
grant execute on function pg_temp.as_who(text) to authenticated;

set local role service_role;
create temporary table screen on commit drop as select * from public.start_tv_pairing('203.0.113.9');
reset role;
grant select on screen to authenticated;

insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-0000000d4021', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV'),
  ('00000000-0000-4000-8000-0000000d4023', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage computer'),
  ('00000000-0000-4000-8000-0000000d4024', '00000000-0000-4000-8000-000000000001', 'tv', 'Door TV'),
  ('00000000-0000-4000-8000-0000000d4025', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV'),
  ('00000000-0000-4000-8000-0000000d4022', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Table 1 tablet');
insert into public.tv_screen (device_id, venue_id, mode) values ('00000000-0000-4000-8000-0000000d4021', '00000000-0000-4000-8000-000000000001', 'waitlist');

select pg_temp.as_who('floor');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', '000000', 'TV', 'waitlist') $$, 'RVCOD', null, 'the floor may pair a TV: the code is all that is wrong');
select lives_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from screen), 'Hall TV', 'waitlist') $$, 'and with a live code, pairs it');
select lives_ok($$ select public.set_tv_mode('00000000-0000-4000-8000-0000000d4021', 'call_time') $$, 'and choose what one shows');
select lives_ok($$ select public.set_tv_rotation('00000000-0000-4000-8000-0000000d4021', array['waitlist']::public.tv_mode[]) $$, 'and what it turns to');
select is((select count(*)::integer from public.tv_pairing_policy('00000000-0000-4000-8000-000000000001')), 1, 'and read the pairing policy, which Pair a TV needs');
select lives_ok($$ select public.open_tv_pairing_window('00000000-0000-4000-8000-000000000001') $$, 'and open the pairing window');
select throws_ok($$ select public.start_device_pairing('00000000-0000-4000-8000-0000000d4022') $$, '42501', null, 'but not pair a dealer tablet');
select throws_ok($$ insert into public.device (venue_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Another cage') $$, '42501', null, 'nor add a cage computer');
update public.device set revoked_at = now(), revoked_reason = 'Mine now' where id = '00000000-0000-4000-8000-0000000d4022';
reset role;
select ok((select revoked_at is null from public.device where id = '00000000-0000-4000-8000-0000000d4022'), 'nor unpair a tablet');
select pg_temp.as_who('floor');
update public.device set revoked_at = now(), revoked_reason = 'Mine now' where id = '00000000-0000-4000-8000-0000000d4023';
update public.device set revoked_at = now(), revoked_reason = 'Not ours' where id = '00000000-0000-4000-8000-0000000d4025';
reset role;
select ok((select revoked_at is null from public.device where id = '00000000-0000-4000-8000-0000000d4023'), 'nor a cage computer');
select ok((select revoked_at is null from public.device where id = '00000000-0000-4000-8000-0000000d4025'), 'nor another venue''s TV');

select pg_temp.as_who('cashier');
select lives_ok($$ select public.set_tv_mode('00000000-0000-4000-8000-0000000d4021', 'waitlist') $$, 'a cashier chooses what a TV shows');
update public.device set revoked_at = now(), revoked_reason = 'Broken' where id = '00000000-0000-4000-8000-0000000d4021';
reset role;
select ok((select revoked_at is not null from public.device where id = '00000000-0000-4000-8000-0000000d4021'), 'and unpairs one');

select pg_temp.as_who('host');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', '000000', 'TV', 'waitlist') $$, '42501', null, 'a host pairs none');
reset role;

-- A venue freeze: a TV stays on its "club closed" screen.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 402');
select pg_temp.as_who('cashier');
select throws_ok($$ update public.device set revoked_at = now(), revoked_reason = 'Frozen' where id = '00000000-0000-4000-8000-0000000d4024' $$, 'RVFRZ', null, 'during a freeze a cashier unpairs no TV');
select pg_temp.as_who('super_admin');
select lives_ok($$ update public.device set revoked_at = now(), revoked_reason = 'Stolen' where id = '00000000-0000-4000-8000-0000000d4024' $$, 'a super admin still can: the way out of a mistaken freeze');
reset role;

select * from finish();
rollback;
