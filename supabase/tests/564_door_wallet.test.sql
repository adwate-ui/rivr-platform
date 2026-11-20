-- Wallet on the door (the owner, 20 Nov): each member's first row on Today's players carries the Bonus in their wallet
-- now (private.bonus_in_force, the Members list's Bonus), whichever day it was given; their other rows carry none. The
-- Bonus given that day and the Bonus used at each seat are as they were. Ritika (215) was given ₹5,500 by hand yesterday
-- and ₹1,000 today; she sits at Table 1 with ₹300 of Bonus chips, then moves to Table 2. 103 Aditya is an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table sess (id uuid) on commit drop;
create temporary table held_before on commit drop as
select private.bonus_in_force('00000000-0000-4000-8000-000000000215', now()) as paise;
grant all on sess to authenticated;

select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 550000,
  'Welcome', now() + interval '30 days', 'bonus.hand:564-a') $$, 'Ritika is given ₹5,500 by hand');
update public.bonus_grant set created_at = now() - interval '1 day' where idempotency_key = 'bonus.hand:564-a';
select lives_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 100000,
  'Welcome', now() + interval '30 days', 'bonus.hand:564-b') $$, 'and ₹1,000 today');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215') $$, 'is checked in');
select lives_ok($$ insert into sess select public.seat_member(
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1'), 6, '9000000215', null, null, 300) $$,
  'sits at Table 1 with ₹300 of Bonus chips');
select lives_ok($$ select public.move_seat((select id from sess),
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 3) $$, 'moves to Table 2');
create temporary table door on commit drop as
select * from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}');
reset role;

create temporary table held on commit drop as
select private.bonus_in_force('00000000-0000-4000-8000-000000000215', now()) as paise;
grant select on held to authenticated;
select is((select paise from held), (select paise from held_before) + 620000,
  'her wallet holds yesterday''s ₹5,500 and today''s ₹1,000, less the ₹300 she used');
select results_eq($$ select tables -> 0 ->> 'table', bonus_paise, bonus_used_paise, wallet_paise from door
                     where member_id = '00000000-0000-4000-8000-000000000215' order by tables -> 0 ->> 'table' $$,
  $$ values ('Table 1', 100000::bigint, 30000::bigint, (select paise from held)), ('Table 2', null::bigint, 0::bigint, null::bigint) $$,
  'her first row has her wallet beside today''s Bonus given and the Bonus used there; her other row has none');
select is((select count(*) from (select d.member_id from door d group by d.member_id having count(d.wallet_paise) <> 1) x), 0::bigint,
  'every member at the door has their wallet on one row alone');
select is((select count(*) from door d where d.wallet_paise is not null and d.wallet_paise <> private.bonus_in_force(d.member_id, now())), 0::bigint,
  'and it is the Bonus in force, as Members has it');
select is((select count(*) from door d where (d.wallet_paise is null) <> (d.bonus_paise is null)), 0::bigint,
  'on the same row as the Bonus given');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select page.wallet_paise from public.door_page('00000000-0000-4000-8000-000000000001',
    '{"filters": {"player": {"kind": "text", "typed": "Ritika"}}, "sort": {"key": "wallet", "direction": "descending"}}') page $$,
  $$ values ((select paise from held)), (null::bigint) $$, 'Wallet sorts on the server');
reset role;

select * from finish();
rollback;
