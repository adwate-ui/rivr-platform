-- A cancelled redemption refunds what it took (#462). Mihir (213) redeems a cap of two for 1,000 points; the host desk
-- (108) cancels it with a reason: his points come back, so does the cap, and it can no longer be handed over.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.points() returns bigint language sql as $$
  select -coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.member_id = '00000000-0000-4000-8000-000000000213' and a.code = 'member.points';
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20000, 'Test', 'test:165:mihir');
insert into public.reward_item (venue_id, kind, name, detail, points, stock)
values ('00000000-0000-4000-8000-000000000001', 'merchandise', 'Cancel test cap', 'At the desk', 1000, 2);
insert into ids select 'item', id from public.reward_item where name = 'Cancel test cap';
create temp table held as select pg_temp.points() as points;

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'redemption', public.redeem_reward((select id from ids where name = 'item'), 1000, 'cancel-1');
reset role;
select is(pg_temp.points(), (select points from held) - 1000, 'redeeming took his 1,000 points');
select is((select stock from public.reward_item where id = (select id from ids where name = 'item')), 1, 'and one of the two caps');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.cancel_redemption((select id from ids where name = 'redemption'), 'Out of caps') $$, '42501', null,
  'a dealer cancels nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.cancel_redemption((select id from ids where name = 'redemption'), 'no') $$, '22023', null, 'not without a reason');
select lives_ok($$ select public.cancel_redemption((select id from ids where name = 'redemption'), 'Out of caps at the desk') $$,
  'the host desk cancels it, with a reason');
select lives_ok($$ select public.cancel_redemption((select id from ids where name = 'redemption'), 'Out of caps at the desk') $$,
  'a second tap changes nothing');
select throws_ok($$ select public.hand_over_redemption((select id from ids where name = 'redemption')) $$, 'RVCNL', null,
  'and a cancelled redemption is never handed over');
select is_empty($$ select * from public.venue_redemptions('00000000-0000-4000-8000-000000000001') where id = (select id from ids where name = 'redemption') $$,
  'it leaves the desk''s list');
reset role;

select is(pg_temp.points(), (select points from held), 'his 1,000 points are back, once');
select is((select stock from public.reward_item where id = (select id from ids where name = 'item')), 2, 'so is the cap');
select results_eq($$ select action, reason from public.audit_log where entity = 'redemption' and entity_id = (select id::text from ids where name = 'redemption')
       and action = 'redemption.cancel' $$,
  $$ values ('redemption.cancel'::text, 'Out of caps at the desk'::text) $$, 'the cancel is audited with its reason');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_redemptions() where id = (select id from ids where name = 'redemption') $$, 'and leaves his own list');

-- One handed over is not cancelled.
insert into ids select 'second', public.redeem_reward((select id from ids where name = 'item'), 1000, 'cancel-2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.hand_over_redemption((select id from ids where name = 'second')) $$, 'the desk hands his second cap over');
select throws_ok($$ select public.cancel_redemption((select id from ids where name = 'second'), 'Changed his mind') $$, 'RVHND', null,
  'after which it is not cancelled');
reset role;

select * from finish();
rollback;
