-- The referral programme (#151). Yash (214) signed up with Mihir's (213) code; his first buy-in completes the referral
-- and the referral promotion (seeded live) gives each of them ₹1,000 of bonus. 103 seats; 104 is the cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A venue of its own, made first as its settings take effect when the test begins.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.referral_bonus(p_member text) returns bigint language sql as $$
  select coalesce(sum(amount_paise), 0)::bigint from public.bonus_grant where member_id = p_member::uuid and reason = 'Referral';
$$;

select is((select count(*)::integer from public.cage_transaction where member_id = '00000000-0000-4000-8000-000000000214' and kind = 'buy_in'), 0,
  'Yash has never bought in');
insert into public.sign_up_attribution (member_id, venue_id, referral_code)
select '00000000-0000-4000-8000-000000000214', venue_id, 'rivr' || member_number from public.member where id = '00000000-0000-4000-8000-000000000213'
on conflict (member_id) do update set referral_code = excluded.referral_code;

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select code, referred from public.my_referral() $$,
  $$ select 'RIVR' || member_number, 0 from public.member where id = '00000000-0000-4000-8000-000000000213' $$, 'Mihir''s code is RIVR and his number');
select is((select bonus_paise from public.my_referral()), 100000::bigint, 'and a referral gives each side ₹1,000 while the promotion runs');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214'),
  null, 'Yash sits at Table 3');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 1000000, 'cash', gen_random_uuid()),
  null, 'and buys in ₹10,000 for the first time');
reset role;

select results_eq($$ select member_id, referrer_member_id from public.referral $$,
  $$ values ('00000000-0000-4000-8000-000000000214'::uuid, '00000000-0000-4000-8000-000000000213'::uuid) $$, 'his first buy-in completes the referral');
select is(pg_temp.referral_bonus('00000000-0000-4000-8000-000000000214'), 100000::bigint, 'Yash gets ₹1,000 of bonus');
select is(pg_temp.referral_bonus('00000000-0000-4000-8000-000000000213'), 100000::bigint, 'and so does Mihir');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 1000000, 'cash', gen_random_uuid()),
  null, 'Yash buys in again');
reset role;
select is((select count(*)::integer from public.referral), 1, 'a second buy-in completes nothing more');
select is(pg_temp.referral_bonus('00000000-0000-4000-8000-000000000213'), 100000::bigint, 'and gives no more bonus');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select referred from public.my_referral()), 1, 'Mihir has referred one member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is((select count(*)::integer from public.referral), 0, 'a member reads no referral row: who referred him is another member''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.referral), 1, 'staff who read members see the venue''s referral');
reset role;

-- Another venue's referral stays there.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e1', 'Elsewhere Referrer', '+919000000997'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000e1', 'Elsewhere Friend', '+919000000996');
insert into public.referral (venue_id, member_id, referrer_member_id, code)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000e3', 'RIVR1');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.referral where venue_id = '00000000-0000-4000-8000-0000000000e1'), 0,
  'staff see no referral of another venue');
reset role;

-- A code counts only while its member can refer: their tier has referrals, and they have not excluded themselves.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', 'Referral Newcomer', '+919000000995');
insert into public.sign_up_attribution (member_id, venue_id, referral_code)
select '00000000-0000-4000-8000-0000000000f1', venue_id, 'RIVR' || member_number from public.member where id = '00000000-0000-4000-8000-000000000213';
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'referral.share_cards', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_referral() $$, 'a member whose tier has no referrals has no code');
reset role;
select private.complete_referral('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', gen_random_uuid());
select is((select count(*)::integer from public.referral where member_id = '00000000-0000-4000-8000-0000000000f1'), 0,
  'and his code completes nothing');
delete from public.member_feature_override where member_id = '00000000-0000-4000-8000-000000000213' and feature_key = 'referral.share_cards';
insert into public.self_exclusion (venue_id, member_id, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() + interval '6 months');
select private.complete_referral('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', gen_random_uuid());
select is((select count(*)::integer from public.referral where member_id = '00000000-0000-4000-8000-0000000000f1'), 0,
  'nor does a self-excluded member''s, so nobody is paid while excluded');

-- A member's own code, or one no member has, completes nothing.
insert into public.sign_up_attribution (member_id, venue_id, referral_code)
select '00000000-0000-4000-8000-000000000211', venue_id, 'RIVR' || member_number from public.member where id = '00000000-0000-4000-8000-000000000211'
on conflict (member_id) do update set referral_code = excluded.referral_code;
select private.complete_referral('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', gen_random_uuid());
select is((select count(*)::integer from public.referral where member_id = '00000000-0000-4000-8000-000000000211'), 0, 'never one''s own code');
select is(has_function_privilege('authenticated', 'private.complete_referral(uuid, uuid, uuid)', 'execute'), false, 'and no app completes one');

select * from finish();
rollback;
