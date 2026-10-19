-- The member record (#60). Arjun Mehta (201) is a black card qualifying at 100/200 (seed); Kabir
-- Sethi (202) a member. 110 is a membership manager (members.manage); 108 a host (members.read); 106 a
-- dealer (neither).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.tier(p_name text) returns uuid language sql as $$
  select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.tier(text) to authenticated;

-- Finding a member, and their record.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select results_eq($$ select full_name, tier_name from public.member_search('00000000-0000-4000-8000-000000000001', 'arjun') $$,
  $$ values ('Arjun Mehta'::text, 'Black card'::text) $$, 'a host finds Arjun by name, case aside');
select results_eq($$ select full_name from public.member_search('00000000-0000-4000-8000-000000000001', '9000000202') $$,
  $$ values ('Kabir Sethi'::text) $$, 'or a member by mobile number');
select results_eq($$ select full_name from public.member_search('00000000-0000-4000-8000-000000000001',
                     (select member_number::text from public.member where id = '00000000-0000-4000-8000-000000000202')) $$,
  $$ values ('Kabir Sethi'::text) $$, 'or by member number');
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', 'a') $$, 'one character finds nobody');
select results_eq($$ select tier_name, tier_until, qualifying_small_blind, qualifying_big_blind, is_kyc_complete, early_departures
                     from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201') $$,
  $$ values ('Black card'::text, null::date, 10000::bigint, 20000::bigint, false, 0) $$, 'and opens his record: tier, qualifying stake, KYC');
select is_empty($$ select * from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301') $$,
  'a member of another venue has no record here');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
  (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card'), 'Regular') $$,
  '42501', null, 'a host does not change tiers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', 'Arjun') $$, 'a dealer finds no one');
select is_empty($$ select * from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201') $$,
  'nor opens a record');

-- A tier change: a reason and an optional last day, kept; never by writing the tier directly.
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ update public.member set tier_id = (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card')
                    where id = '00000000-0000-4000-8000-000000000202' $$, '42501', null, 'the tier is never written directly');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Founders'' Circle'), 'ok') $$,
  '22023', null, 'a reason of three characters or more');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Member'), 'Same') $$,
  '22023', null, 'a different tier');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Founders'' Circle'),
  'Guest', (now() at time zone 'Asia/Kolkata')::date - 2) $$, '22023', null, 'a last day still to come');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
  (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000002' limit 1), 'Practice tier') $$,
  '22023', null, 'a tier of this venue');
select isnt(public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Founders'' Circle'),
  'Owner''s guest for the weekend', (now() at time zone 'Asia/Kolkata')::date + 2), null, 'a membership manager changes Kabir''s tier');
select results_eq($$ select tier_name, tier_until from public.member_record('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  $$ values ('Founders'' Circle'::text, (now() at time zone 'Asia/Kolkata')::date + 2) $$, 'his record shows the tier and its last day');
select results_eq($$ select f.name, t.name, c.reason, c.is_expiry, s.full_name from public.member_tier_change c
                     join public.tier f on f.id = c.from_tier_id join public.tier t on t.id = c.to_tier_id
                     join public.staff s on s.id = c.changed_by_staff_id where c.member_id = '00000000-0000-4000-8000-000000000202' $$,
  $$ select 'Member'::text, 'Founders'' Circle'::text, 'Owner''s guest for the weekend'::text, false,
            (select full_name from public.staff where user_id = '00000000-0000-4000-8000-000000000110' and venue_id = '00000000-0000-4000-8000-000000000001') $$,
  'the change is kept: from, to, why and who');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::integer from public.member_tier_change), 1, 'staff who read members see the change');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is((select count(*)::integer from public.member_tier_change), 1, 'and so does Kabir');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select id from public.member_tier_change $$, 'Arjun does not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select id from public.member_tier_change $$, 'nor a dealer');
reset role;
select throws_ok($$ update public.member_tier_change set reason = 'Changed' $$, null, null, 'a tier change is never changed');

-- Once its last day has passed, the sweep puts him back, once.
alter table public.member_tier_change disable trigger member_tier_change_never_changed;
update public.member_tier_change set created_at = now() - interval '3 days', ends_at = now() - interval '1 minute';
alter table public.member_tier_change enable trigger member_tier_change_never_changed;
select private.end_tier_changes();
select private.end_tier_changes();
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = '00000000-0000-4000-8000-000000000202'), 'Member',
  'Kabir is back on his tier when the change ends');
select results_eq($$ select count(*)::integer, count(*) filter (where is_expiry)::integer from public.member_tier_change
                     where member_id = '00000000-0000-4000-8000-000000000202' $$, $$ values (2, 1) $$, 'and that is kept, once');

-- Two changes with last days, in either order, and a change for good after one with an end: the
-- member always ends on the tier in force, never stranded on one that has ended.
create function pg_temp.change(p_tier text, p_reason text) returns uuid language sql as $$
  select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier(p_tier), p_reason,
                                (now() at time zone 'Asia/Kolkata')::date + 5);
$$;
create function pg_temp.end_change(p_id uuid) returns void language sql as $$
  alter table public.member_tier_change disable trigger member_tier_change_never_changed;
  update public.member_tier_change set created_at = created_at - interval '3 days', ends_at = now() - interval '1 minute' where id = p_id;
  alter table public.member_tier_change enable trigger member_tier_change_never_changed;
$$;
create function pg_temp.kabir() returns text language sql as $$
  select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = '00000000-0000-4000-8000-000000000202';
$$;
grant execute on function pg_temp.change(text, text) to authenticated;
create temp table chain (name text primary key, id uuid);
grant select, insert on chain to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
insert into chain select 'first', pg_temp.change('Founders'' Circle', 'Guest week');
insert into chain select 'second', pg_temp.change('Black card', 'Big game weekend');
reset role;
select pg_temp.end_change((select id from chain where name = 'first'));
select pg_temp.end_change((select id from chain where name = 'second'));
select private.end_tier_changes();
select is(pg_temp.kabir(), 'Member', 'both ended, the first first: back on Member, not stranded on Founders'' Circle');
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
insert into chain select 'longer', pg_temp.change('Founders'' Circle', 'Guest week');
insert into chain select 'shorter', pg_temp.change('Black card', 'One night');
reset role;
select pg_temp.end_change((select id from chain where name = 'shorter'));
select private.end_tier_changes();
select is(pg_temp.kabir(), 'Founders'' Circle', 'the shorter, later one ended: the longer one is in force again');
select pg_temp.end_change((select id from chain where name = 'longer'));
select private.end_tier_changes();
select is(pg_temp.kabir(), 'Member', 'then that ends too: back on Member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
insert into chain select 'pending', pg_temp.change('Founders'' Circle', 'Guest week');
select isnt(public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Black card'), 'For good'),
  null, 'a change for good while one is pending');
reset role;
select pg_temp.end_change((select id from chain where name = 'pending'));
select private.end_tier_changes();
select is(pg_temp.kabir(), 'Black card', 'the change for good stands when the earlier one ends');

-- The practice venue's changes are its own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select isnt(public.set_member_tier('00000000-0000-4000-8000-000000000002',
  (select id from public.member where venue_id = '00000000-0000-4000-8000-000000000002' order by full_name limit 1),
  (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000002'
   and t.id <> (select m.tier_id from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000002' order by m.full_name limit 1) limit 1),
  'Training'), null, 'a change at the practice venue');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000108' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select results_eq($$ select distinct venue_id from public.member_tier_change $$, $$ values ('00000000-0000-4000-8000-000000000002'::uuid) $$,
  'the practice venue''s host sees only its changes');
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', 'Kabir') $$, 'and finds no club member');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000108' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Not while the venue is frozen, and not by someone no longer at the club.
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000110' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Founders'' Circle'), 'Guest') $$,
  '42501', null, 'the practice venue''s manager changes no club tier');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000110' and venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ select public.set_member_tier('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', pg_temp.tier('Founders'' Circle'), 'Guest') $$,
  'RVFRZ', null, 'nor while the venue is frozen');
reset role;

select * from finish();
rollback;
