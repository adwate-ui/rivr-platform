-- A cashier never serves their own member record at the cage (#500; question #494 item 5). Sana (104, a cashier) is also
-- a member, on her own number. The cage's check refuses her own record, and so do a buy-in through it and a cash
-- tournament buy; a cage transaction or a marker for her own record is refused as it is written, while another member's
-- is not, a namesake on another number included. With no one signed in (the seed, a reset), nothing is refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table own as
  with made as (insert into public.member (venue_id, full_name, phone)
                values ('00000000-0000-4000-8000-000000000001', 'Sana Q.', '+919000000104') returning id)
  select id from made;
create temp table namesake as
  with made as (insert into public.member (venue_id, full_name, phone)
                values ('00000000-0000-4000-8000-000000000001', 'Sana Qureshi', '+919000000777') returning id)
  select id from made;
grant select on own, namesake to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', (select id from own), 1000000, 'cash', gen_random_uuid()) $$,
  'RVOWN', null, 'a cashier buys in no chips for her own member record, on her number');
select throws_ok($$ select public.cage_tournament_entry((select id from public.tournament where venue_id = '00000000-0000-4000-8000-000000000001' limit 1),
                                                       (select id from own), 'entry', gen_random_uuid()) $$,
  'RVOWN', null, 'nor takes her own tournament entry in cash');

-- As written, with Sana signed in.
reset role;
select throws_ok($$ select private.cage_check('00000000-0000-4000-8000-000000000001', (select id from own)) $$,
  'RVOWN', null, 'the cage''s check refuses her own record first');
select throws_ok($$ insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', (select id from own), 'buy_in', 'cash', 5000) $$,
  'RVOWN', null, 'no cage transaction of hers: no cash-out to her own wallet, no repayment');
select throws_ok($$ insert into public.marker (venue_id, member_id, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', (select id from own), 5000) $$,
  'RVOWN', null, 'and no marker to herself');
-- Another member's row passes the check and fails only on what this test leaves out.
select throws_ok($$ insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'buy_in', 'cash', 5000) $$,
  '23502', null, 'another member''s cage transaction is hers to make');
select throws_ok($$ insert into public.marker (venue_id, member_id, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 5000) $$,
  '23502', null, 'and another member''s marker');
select throws_ok($$ insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', (select id from namesake), 'buy_in', 'cash', 5000) $$,
  '23502', null, 'a member who only shares her name is served');

-- With no one signed in, nothing is anyone's own.
select set_config('request.jwt.claims', '', true);
select throws_ok($$ insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise)
                    values ('00000000-0000-4000-8000-000000000001', (select id from own), 'buy_in', 'cash', 5000) $$,
  '23502', null, 'the seed and a reset write any member''s rows');

select * from finish();
rollback;
