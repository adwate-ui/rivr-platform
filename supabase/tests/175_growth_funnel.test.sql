-- Growth funnel (#166): sign-up, KYC, a first visit and a first buy-in by source, counts only. 103 Aditya is an admin
-- (reports.read) who seats; 104 a cashier; 101 is staff at the practice venue too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.stages(p_kind text, p_code text) returns table (signed_up integer, kyc_done integer, visited integer, bought_in integer)
language sql as $$
  select f.signed_up, f.kyc_done, f.visited, f.bought_in from public.growth_funnel('00000000-0000-4000-8000-000000000001') f
  where f.source_kind = p_kind and f.source_code is not distinct from p_code;
$$;
grant execute on function pg_temp.stages(text, text) to authenticated;

-- A new member who came by a link from funneltest.
create temp table newbie as
  with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Funnel Newbie', '+919000000951') returning id)
  select id from made;
insert into public.sign_up_attribution (member_id, venue_id, utm_source) select id, '00000000-0000-4000-8000-000000000001', 'funneltest' from newbie;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.stages('link', 'funneltest') $$, $$ values (1, 0, 0, 0) $$, 'a sign-up from a link counts by its source');
select ok(exists (select 1 from public.growth_funnel('00000000-0000-4000-8000-000000000001') f where f.source_kind = 'direct' and f.source_code is null and f.signed_up > 0),
  'members with no source count as direct');
reset role;

-- They finish KYC and come in; then Yash (214), from the same link, sits and buys in.
insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
select '00000000-0000-4000-8000-000000000001', id, 'verified', now(), '1990-01-01', '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg' from newbie;
insert into public.visit (venue_id, member_id) select '00000000-0000-4000-8000-000000000001', id from newbie;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.stages('link', 'funneltest') $$, $$ values (1, 1, 1, 0) $$, 'KYC and the first visit count');
reset role;
insert into public.sign_up_attribution (member_id, venue_id, utm_source)
values ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000001', 'funneltest')
on conflict (member_id) do update set utm_source = excluded.utm_source, referral_code = null, creator_code = null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 5, '9000000214');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 1000000, 'cash', gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select signed_up, bought_in from pg_temp.stages('link', 'funneltest') $$, $$ values (2, 1) $$, 'and a first buy-in');

-- A referral counts as a referral, whoever's code it was; a creator's code by the code.
reset role;
update public.sign_up_attribution set referral_code = 'rivr1', creator_code = 'zoya' where member_id = (select id from newbie);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.stages('referral', null) $$, $$ values (1, 1, 1, 0) $$, 'a referral wins over a code or a link');
reset role;
update public.sign_up_attribution set referral_code = null where member_id = (select id from newbie);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.stages('creator', 'zoya') $$, $$ values (1, 1, 1, 0) $$, 'a creator''s code by the code');

-- Only staff who read reports, and never for the practice venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.growth_funnel('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier reads no funnel');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.growth_funnel('00000000-0000-4000-8000-000000000002') $$, '22023', null, 'the practice venue has none');
reset role;

select * from finish();
rollback;
