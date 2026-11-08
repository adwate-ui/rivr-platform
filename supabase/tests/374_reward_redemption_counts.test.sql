-- Each reward's redemptions in the last 30 days, for staff who keep the catalogue or hand rewards over (audit 8 Nov,
-- F-072). Mihir (213) redeems two caps and has one cancelled; one more went 31 days ago. 107 Ishita keeps the catalogue,
-- 108 the host desk hands over, 106 Pema deals.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20000, 'Test', 'test:374:mihir');
insert into public.reward_item (venue_id, kind, name, detail, points, stock)
values ('00000000-0000-4000-8000-000000000001', 'merchandise', 'Count test cap', 'At the desk', 1000, 10);
insert into ids select 'item', id from public.reward_item where name = 'Count test cap';

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'first', public.redeem_reward((select id from ids where name = 'item'), 1000, 'count-1');
insert into ids select 'second', public.redeem_reward((select id from ids where name = 'item'), 1000, 'count-2');
insert into ids select 'third', public.redeem_reward((select id from ids where name = 'item'), 1000, 'count-3');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.cancel_redemption((select id from ids where name = 'second'), 'Test out of caps') $$, 'the desk cancels one');
reset role;
update public.redemption set created_at = now() - interval '31 days' where id = (select id from ids where name = 'third');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select results_eq($$ select redeemed from public.reward_redemption_counts('00000000-0000-4000-8000-000000000001') where reward_item_id = (select id from ids where name = 'item') $$,
  $$ values (1) $$, 'the catalogue''s keeper sees one in the last 30 days: not the cancelled one, nor the one 31 days ago');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select results_eq($$ select redeemed from public.reward_redemption_counts('00000000-0000-4000-8000-000000000001') where reward_item_id = (select id from ids where name = 'item') $$,
  $$ values (1) $$, 'so does the host desk');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.reward_redemption_counts('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.reward_redemption_counts('00000000-0000-4000-8000-000000000001') $$, 'nor does a member');

select * from finish();
rollback;
