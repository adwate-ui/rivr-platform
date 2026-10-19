-- Waitlist priority (#40). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200 in that
-- order and weights the black card (2, at its qualifying stake only) and Founders' Circle (1). Arjun
-- (201) is a black card at 100/200; Tara (209) becomes Founders' Circle here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.type_id(text) to authenticated;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'verified', 'digilocker', '1985-05-05', 'ABCPA1111A',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000209', 'verified', 'digilocker', '1992-03-03', 'ABCPM3333C',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000209/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'verified', 'digilocker', '1990-04-12', 'ABCPN1234D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg', now());
update public.member set tier_id = (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Founders'' Circle')
where id = '00000000-0000-4000-8000-000000000209';

-- The black card joins 100/200 behind three and is first.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'a black card joins 100/200');
select is((select place from public.my_waitlist() where table_type_name = 'NLH 100/200'), 1, 'and is first, at their qualifying stake');

-- Founders' Circle joins after and goes second, ahead of join time.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Founders'' Circle joins 100/200');
select is((select place from public.my_waitlist()), 2, 'and is second: behind the black card, ahead of join time');

-- On 50/100, after Naina, the black card queues by join time.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()), null, 'Naina joins 50/100 first');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()), null, 'then the black card');
select is((select place from public.my_waitlist() where table_type_name = 'NLH 50/100'), 2, 'who is second there, by join time');

-- The floor sees each list in that order, with the reason only where priority applies.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select results_eq(
  $$ select t.code, b.full_name, b.place, b.priority_reason from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
     join public.table_type t on t.id = b.table_type_id order by t.code, b.place $$,
  $$ values ('nlh_100_200'::text, 'Arjun Mehta'::text, 1, 'Black card'::text), ('nlh_100_200', 'Tara Menon', 2, 'Founders'' Circle'),
            ('nlh_100_200', 'Kabir Sethi', 3, null), ('nlh_100_200', 'Naina Kapoor', 4, null), ('nlh_100_200', 'Rohan Bhatia', 5, null),
            ('nlh_50_100', 'Naina Kapoor', 1, null), ('nlh_50_100', 'Arjun Mehta', 2, null) $$,
  'the floor sees the order and the reason: black card at its stake, Founders'' Circle, then join time');
reset role;

-- Weights are effective-dated: from now on the black card weighs nothing, and Arjun queues by join time.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select venue_id, 'waitlist.priority_weights', id::text, '{"weight": 0, "only_at_qualifying_stake": true}', now(), 'Test'
from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select place from public.my_waitlist() where table_type_name = 'NLH 100/200'), 5,
  'a weight changed in the setting reorders the list from then on');
reset role;

select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   select venue_id, 'waitlist.priority_weights', id::text, '{"weight": -1, "only_at_qualifying_stake": true}', now() + interval '1 day', 'Test'
                   from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card' $$,
  null, null, 'a weight is never negative');

select * from finish();
rollback;
