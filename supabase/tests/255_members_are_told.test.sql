-- Members are told (decision 0303): member.notice for an identity check's outcome, a reward ready or cancelled, and a seat
-- on the leaving list that ends. 103 Aditya (admin); members 204 Rohan, 211 Ishaan, 213 Mihir.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The notices raised for a member in this test (the seed's, raised as it loaded, are left out).
create function pg_temp.notices(p_member text) returns setof jsonb language sql as $$
  select e.payload - 'member_id' from public.outbox_event e
  where e.event_type = 'member.notice' and e.payload ->> 'member_id' = p_member and e.occurred_at = now();
$$;
grant execute on function pg_temp.notices(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Rohan's identity check: started, then waiting for review, then refused; a check that only changes its PAN says nothing.
insert into public.kyc_record (venue_id, member_id, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', '1992-03-03');
select is_empty($$ select * from pg_temp.notices('00000000-0000-4000-8000-000000000204') $$, 'a check started says nothing');
update public.kyc_record set status = 'needs_review' where member_id = '00000000-0000-4000-8000-000000000204';
update public.kyc_record set pan = 'ABCPB2044B' where member_id = '00000000-0000-4000-8000-000000000204';
update public.kyc_record set status = 'refused', refusal = 'staff_rejected' where member_id = '00000000-0000-4000-8000-000000000204';
select bag_eq($$ select * from pg_temp.notices('00000000-0000-4000-8000-000000000204') $$,
  $$ values ('{"notice": "kyc_in_review", "params": []}'::jsonb), ('{"notice": "kyc_refused", "params": ["staff_rejected"]}'::jsonb) $$,
  'waiting for review, then refused by its code, never a reviewer''s words');

-- Mihir redeems a cap, which sends nothing (he did it in the app), then Karan, a host, cancels it: Mihir hears which, not why.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 5000, 'Test', 'test:255:mihir');
insert into public.reward_item (venue_id, kind, name, detail, points, stock)
values ('00000000-0000-4000-8000-000000000001', 'merchandise', 'Notice test cap', 'At the host desk', 1000, 2);
insert into ids select 'item', id from public.reward_item where name = 'Notice test cap';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'redemption', public.redeem_reward((select id from ids where name = 'item'), 1000, 'notice-1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select public.cancel_redemption((select id from ids where name = 'redemption'), 'Out of caps at the desk');
reset role;
select results_eq($$ select n from pg_temp.notices('00000000-0000-4000-8000-000000000213') n where n ->> 'notice' like 'reward%' $$,
  $$ values ('{"notice": "reward_cancelled", "params": ["Notice test cap"]}'::jsonb) $$,
  'a reward cancelled names the reward, never staff''s words');

-- Ishaan, seated, goes on the leaving list; when the floor frees his seat he hears it. A seat not on the list says nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table seats as
select 'ishaan'::text as name, public.seat_member((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 4, '9000000211') as id
union all
select 'rohan', public.seat_member((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 6, '9000000215');
reset role;
update public.seat_session set leaving_at = now() where id = (select id from seats where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select id from seats where name = 'ishaan'), 'left');
select public.end_seat((select id from seats where name = 'rohan'), 'left');
reset role;
select results_eq($$ select * from pg_temp.notices('00000000-0000-4000-8000-000000000211') $$,
  $$ values ('{"notice": "seat_released", "params": ["Table 3", "4"]}'::jsonb) $$, 'released from the leaving list, he hears his seat is free');
select is_empty($$ select * from pg_temp.notices('00000000-0000-4000-8000-000000000215') $$, 'a seat not on the leaving list says nothing');

-- The practice venue tells no member anything.
insert into public.kyc_record (venue_id, member_id, date_of_birth)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', '1990-01-01')
on conflict (member_id) do update set status = 'started';
update public.kyc_record set status = 'needs_review' where member_id = '00000000-0000-4000-8000-000000000301';
select is_empty($$ select * from pg_temp.notices('00000000-0000-4000-8000-000000000301') $$, 'a practice member hears nothing');

-- Rohan's check is reopened and verified, then reopened and verified again within the hour: he hears it once.
update public.kyc_record set status = 'started', refusal = null where member_id = '00000000-0000-4000-8000-000000000204';
update public.kyc_record set status = 'verified', verified_at = now(),
  photo_path = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000204/selfie.jpg'
where member_id = '00000000-0000-4000-8000-000000000204';
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000204';
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000204';
select is((select count(*)::integer from pg_temp.notices('00000000-0000-4000-8000-000000000204') n where n ->> 'notice' = 'kyc_verified'), 1,
  'a check verified twice in the hour sends one message');

select * from finish();
rollback;
