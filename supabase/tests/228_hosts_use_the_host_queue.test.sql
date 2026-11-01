-- The host role uses the host queue (F2-04): a host (108 Karan Gill) reads it, records a call and closes one; a cashier
-- (104 Sana Qureshi), without host_queue.manage, reads nothing and is refused both. A frozen venue refuses the host too.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Two lapsed regulars who agreed to offers, in the queue.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000001', 'Lata Iyer', '+919000000891'),
  ('00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-000000000001', 'Kiran Das', '+919000000892');
insert into public.consent (venue_id, member_id, purpose) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c01', 'marketing'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c02', 'marketing');
insert into public.host_queue_item (id, venue_id, member_id, last_visit_at, visits) values
  ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c01', now() - interval '30 days', 4),
  ('00000000-0000-4000-8000-0000000c0102', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c02', now() - interval '30 days', 4);

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.host_queue('00000000-0000-4000-8000-000000000001')), 0,
  'a cashier, without host_queue.manage, reads no queue');
select throws_ok($$ select public.record_host_contact('00000000-0000-4000-8000-0000000c0101', 'busy') $$,
  '42501', 'Only a host at the venue records a call', 'a cashier records no call');
select throws_ok($$ select public.close_host_item('00000000-0000-4000-8000-0000000c0101') $$,
  '42501', 'Only a host at the venue closes a call', 'a cashier closes no call');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select results_eq(
  $$ select full_name from public.host_queue('00000000-0000-4000-8000-000000000001')
     where member_id in ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000c02') order by 1 $$,
  $$ values ('Kiran Das'::text), ('Lata Iyer') $$, 'a host reads the queue');
select lives_ok($$ select public.record_host_contact('00000000-0000-4000-8000-0000000c0101', 'busy', '{"kind": "points", "points": 500}', 'Calls back Friday') $$,
  'a host records a call, with an offer');
select lives_ok($$ select public.close_host_item('00000000-0000-4000-8000-0000000c0102') $$, 'a host closes a call');

reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select h.status, h.churn_reason, s.user_id from public.host_queue_item h join public.staff s on s.id = h.handled_by_staff_id
     where h.id in ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-0000000c0102') order by h.member_id $$,
  $$ values ('offered'::text, 'busy'::text, '00000000-0000-4000-8000-000000000108'::uuid), ('closed', null, '00000000-0000-4000-8000-000000000108') $$,
  'the call, its offer and the close are kept, as the host''s');

insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'F2-04 test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.record_host_contact('00000000-0000-4000-8000-0000000c0101', 'budget') $$,
  'RVFRZ', null, 'a frozen venue refuses the host''s call');

select * from finish();
rollback;
