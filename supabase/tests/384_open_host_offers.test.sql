-- A host's open offer where the floor can honour it (8 Nov audit, I-66): shown while out and on the night the member comes
-- back, never granted by itself (#598), and only to staff who may see it. A bonus offer has no expiry. 103 is a host and the
-- floor, 106 Pema a dealer, 213 Mihir a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.offers() returns setof uuid language sql as $$
  select member_id from public.open_host_offers('00000000-0000-4000-8000-000000000001') where member_id::text like '00000000-0000-4000-8000-000000000b%' order by 1;
$$;
grant execute on function pg_temp.offers() to authenticated;

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-000000000b81', '00000000-0000-4000-8000-000000000001', 'Offered Olga', '+919000000841'),
  ('00000000-0000-4000-8000-000000000b82', '00000000-0000-4000-8000-000000000001', 'Tonight Tara', '+919000000842'),
  ('00000000-0000-4000-8000-000000000b83', '00000000-0000-4000-8000-000000000001', 'Last Week Lena', '+919000000843'),
  ('00000000-0000-4000-8000-000000000b84', '00000000-0000-4000-8000-000000000001', 'No Offer Nia', '+919000000844'),
  ('00000000-0000-4000-8000-000000000b85', '00000000-0000-4000-8000-000000000001', 'No Consent Noor', '+919000000845');
insert into public.consent (venue_id, member_id, purpose)
select '00000000-0000-4000-8000-000000000001', m.id, 'marketing' from public.member m
where m.id::text like '00000000-0000-4000-8000-000000000b8_' and m.id <> '00000000-0000-4000-8000-000000000b85';
insert into public.host_queue_item (venue_id, member_id, last_visit_at, visits, status, offer, won_back_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b81', now() - interval '40 days', 4, 'offered', '{"kind": "points", "points": 500}', null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b82', now() - interval '40 days', 4, 'won_back', '{"kind": "spin"}', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b83', now() - interval '40 days', 4, 'won_back', '{"kind": "spin"}', now() - interval '7 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b84', now() - interval '40 days', 4, 'open', null, null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b85', now() - interval '40 days', 4, 'offered', '{"kind": "spin"}', null);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.offers() $$,
  $$ values ('00000000-0000-4000-8000-000000000b81'::uuid), ('00000000-0000-4000-8000-000000000b82') $$,
  'an offer out and one won back tonight show; not last week''s, no offer, nor someone who took back consent');

select lives_ok($$ select public.record_host_contact((select item_id from public.host_queue('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000b84'), 'busy',
  '{"kind": "bonus", "amount_paise": 200000}', null) $$, 'a bonus offer needs no expiry');
select is((select offer from public.open_host_offers('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000b84'),
  '{"kind": "bonus", "amount_paise": 200000}'::jsonb, 'and shows as made');

-- Coming back marks it won back and shows it that night, with nothing given by itself.
reset role;
insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b84', now());
select is((select status from public.host_queue_item where member_id = '00000000-0000-4000-8000-000000000b84'), 'won_back', 'the visit wins them back');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000b84'), 0, 'and grants no chips by itself, as the owner said (#598)');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt_empty($$ select 1 from public.open_host_offers('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000b84' $$, 'the offer still shows, for the floor to honour');

reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000216', 'Practice Admin', 'Admin', 'admin');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.open_host_offers('00000000-0000-4000-8000-000000000001') $$, 'a dealer reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000636');
select is_empty($$ select * from public.open_host_offers('00000000-0000-4000-8000-000000000001') $$, 'nor does marketing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select * from public.open_host_offers('00000000-0000-4000-8000-000000000001') $$, 'nor an investor');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select * from public.open_host_offers('00000000-0000-4000-8000-000000000001') $$, 'nor another venue''s admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.open_host_offers('00000000-0000-4000-8000-000000000001') $$, 'a member reads none');
reset role;
select ok(not has_function_privilege('anon', 'public.open_host_offers(uuid)', 'execute'), 'nor anybody signed out');

select * from finish();
rollback;
