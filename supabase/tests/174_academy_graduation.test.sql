-- Academy attendance and graduation (#128): staff who manage members mark a booked student present at a class, once a
-- day, and graduate her: the Academy graduate tier is set, and with the graduate freeroll running, the graduation
-- trigger grants it with no manual step. 622 Ritu has a booking with her UTR given on a batch running this week (seed
-- 75_academy_graduation.sql). 103 Aditya is an admin (members.manage); 104 Sana a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ritu on commit drop as
  select id from public.academy_booking where member_id = '00000000-0000-4000-8000-000000000622';
grant select on ritu to authenticated;

-- The graduate freeroll is running at the club.
update public.promotion set status = 'live', starts_at = now() - interval '1 day'
where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = 'graduate_freeroll';

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.mark_academy_attendance((select id from ritu)) $$, '42501', null, 'a cashier marks no attendance');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.mark_academy_attendance((select id from ritu)) $$, 'staff mark Ritu present at today''s class');
select lives_ok($$ select public.mark_academy_attendance((select id from ritu)) $$, 'twice is still once');
reset role;
select is((select count(*)::integer from public.academy_attendance where member_id = '00000000-0000-4000-8000-000000000622'), 1,
  'one class attended');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.graduate_academy_member((select id from ritu)) $$, 'she graduates');
select throws_ok($$ select public.graduate_academy_member((select id from ritu)) $$, 'RVDUP', null, 'once');
reset role;
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = '00000000-0000-4000-8000-000000000622'),
  'Academy graduate', 'on the Academy graduate tier');
select ok((select graduated_at is not null from public.academy_booking where id = (select id from ritu)), 'her booking says so');
select results_eq(
  $$ select r.effect ->> 'kind' from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
     join public.promotion_rule r on r.promotion_id = p.id
     where g.member_id = '00000000-0000-4000-8000-000000000622' and p.template_key = 'graduate_freeroll' $$,
  $$ values ('freeroll_ticket'::text) $$, 'and the graduate freeroll arrives with no manual step');

select * from finish();
rollback;
