-- Waitlist priority (#40). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200 in that
-- order and weights the black card (2, at its qualifying stake only) and Founders' Circle (1). Arjun
-- (201) and Vihaan (212) are black cards at 100/200; Tara (209) becomes Founders' Circle here; Dev (210)
-- and Ishaan (211) are members. now() is the same all through the transaction, so joins are given
-- their own earlier times where order matters.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.type_id(text) to authenticated;
create function pg_temp.joined(p_member uuid, p_code text, p_ago interval) returns void language sql as $$
  update public.waitlist_entry set joined_at = now() - p_ago
  where member_id = p_member and table_type_id = pg_temp.type_id(p_code) and status = 'waiting';
$$;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', m.id, 'verified', 'digilocker', '1990-01-01', m.pan,
       '00000000-0000-4000-8000-000000000001/' || m.id || '/selfie.jpg', now()
from (values ('00000000-0000-4000-8000-000000000201'::uuid, 'ABCPA1111A'), ('00000000-0000-4000-8000-000000000209'::uuid, 'ABCPM3333C'),
             ('00000000-0000-4000-8000-000000000203'::uuid, 'ABCPN1234D'), ('00000000-0000-4000-8000-000000000210'::uuid, 'ABCPD2100E')) as m (id, pan);
update public.member set tier_id = (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Founders'' Circle')
where id = '00000000-0000-4000-8000-000000000209';

-- Five wait on 100/200: the seeded three, then Dev and Ishaan.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000210", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'a fourth joins 100/200');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000211", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'and a fifth');
reset role;
-- Every join on the list gets its own time, the seeded three's included (the seed's are seed-time).
select pg_temp.joined('00000000-0000-4000-8000-000000000202', 'nlh_100_200', interval '30 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000203', 'nlh_100_200', interval '29 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000204', 'nlh_100_200', interval '28 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000210', 'nlh_100_200', interval '5 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000211', 'nlh_100_200', interval '4 minutes');

-- The black card joins behind them; then Founders' Circle; then, on 50/100, Naina and the black card.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'a black card joins 100/200 behind five');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000209", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid()), null, 'Founders'' Circle joins 100/200');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()), null, 'Naina joins 50/100');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select isnt(public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()), null, 'then the black card');
reset role;
select pg_temp.joined('00000000-0000-4000-8000-000000000201', 'nlh_100_200', interval '3 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000209', 'nlh_100_200', interval '2 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000203', 'nlh_50_100', interval '2 minutes');
select pg_temp.joined('00000000-0000-4000-8000-000000000201', 'nlh_50_100', interval '1 minute');

-- The floor sees each list in that order, with the reason only where priority applies.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select results_eq(
  $$ select t.code, b.full_name, b.place, b.priority_reason from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
     join public.table_type t on t.id = b.table_type_id order by t.code, b.place $$,
  $$ values ('nlh_100_200'::text, 'Arjun Mehta'::text, 1, 'Black card'::text), ('nlh_100_200', 'Tara Menon', 2, 'Founders'' Circle'),
            ('nlh_100_200', 'Kabir Sethi', 3, null), ('nlh_100_200', 'Naina Kapoor', 4, null), ('nlh_100_200', 'Rohan Bhatia', 5, null),
            ('nlh_100_200', 'Dev Malhotra', 6, null), ('nlh_100_200', 'Ishaan Verma', 7, null),
            ('nlh_50_100', 'Naina Kapoor', 1, null), ('nlh_50_100', 'Arjun Mehta', 2, null) $$,
  'a black card behind five is first at its stake, with the reason; Founders'' Circle next; then join time; by join time at another stake');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select results_eq($$ select table_type_name, place from public.my_waitlist() order by table_type_name $$,
  $$ values ('NLH 100/200'::text, 1), ('NLH 50/100', 2) $$, 'and the member sees the same places');
reset role;

-- Weights are effective-dated, and a place keeps the weight in force when the member joined. From now
-- the black card weighs nothing, so Arjun stays first, while Vihaan, added now, queues by join time.
-- A weight set for tomorrow is not yet in force: Founders' Circle keeps its weight today.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select venue_id, 'waitlist.priority_weights', id::text, '{"weight": 0, "only_at_qualifying_stake": true}', now(), 'Test'
from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select venue_id, 'waitlist.priority_weights', id::text, '{"weight": 0, "only_at_qualifying_stake": false}', now() + interval '1 day', 'Test'
from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Founders'' Circle';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select isnt(public.add_to_waitlist(pg_temp.type_id('nlh_100_200'), '9000000212', gen_random_uuid()), null, 'Vihaan, a black card, is added now');
select results_eq(
  $$ select b.full_name, b.place, b.priority_reason from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
     where b.table_type_id = pg_temp.type_id('nlh_100_200') and b.place in (1, 2, 8) order by b.place $$,
  $$ values ('Arjun Mehta'::text, 1, 'Black card'::text), ('Tara Menon', 2, 'Founders'' Circle'), ('Vihaan Kapoor', 8, null) $$,
  'a weight changed after a member joined leaves their place; one added after it gets the new weight; tomorrow''s is not yet in force');
reset role;

select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   select venue_id, 'waitlist.priority_weights', id::text, '{"weight": -1, "only_at_qualifying_stake": true}', now() + interval '2 days', 'Test'
                   from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card' $$,
  '23514', null, 'a weight is never negative');

select * from finish();
rollback;
