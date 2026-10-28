-- The host queue (#165; decision 0276): the day's sweep queues each lapsed regular once, never a self-excluded one; a
-- host (103 Aditya, members.manage) records why and the offer; a visit wins the player back; a member cannot see it.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.queued() returns setof text language sql as $$
  select m.full_name from public.host_queue_item h join public.member m on m.id = h.member_id
  where h.status in ('open', 'offered') and m.id::text like '00000000-0000-4000-8000-000000000b%' order by 1;
$$;

-- Lata and Kiran came four times and not for a month; Ravi once; Sana four times but is on a break; Meera four times,
-- last week; Dev four times but was on a break since; Neha four times but gave no marketing consent; Omar four times
-- but is frozen. All but Neha consented to marketing.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000001', 'Lata Iyer', '+919000000881'),
  ('00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000001', 'Ravi Menon', '+919000000882'),
  ('00000000-0000-4000-8000-000000000b03', '00000000-0000-4000-8000-000000000001', 'Sana Qureshi', '+919000000883'),
  ('00000000-0000-4000-8000-000000000b04', '00000000-0000-4000-8000-000000000001', 'Meera Nair', '+919000000884'),
  ('00000000-0000-4000-8000-000000000b05', '00000000-0000-4000-8000-000000000001', 'Dev Arora', '+919000000885'),
  ('00000000-0000-4000-8000-000000000b06', '00000000-0000-4000-8000-000000000001', 'Neha Bose', '+919000000886'),
  ('00000000-0000-4000-8000-000000000b07', '00000000-0000-4000-8000-000000000001', 'Omar Sheikh', '+919000000887'),
  ('00000000-0000-4000-8000-000000000b08', '00000000-0000-4000-8000-000000000001', 'Kiran Das', '+919000000888');
insert into public.consent (venue_id, member_id, purpose)
select '00000000-0000-4000-8000-000000000001', m.id, 'marketing' from public.member m
where m.id::text like '00000000-0000-4000-8000-000000000b0_' and m.id <> '00000000-0000-4000-8000-000000000b06';
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', m, now() - d, now() - d + interval '4 hours', 'door'
from (values ('00000000-0000-4000-8000-000000000b01'::uuid), ('00000000-0000-4000-8000-000000000b03'), ('00000000-0000-4000-8000-000000000b05'),
             ('00000000-0000-4000-8000-000000000b06'), ('00000000-0000-4000-8000-000000000b07'), ('00000000-0000-4000-8000-000000000b08')) as v (m),
     (values (interval '30 days'), (interval '45 days'), (interval '60 days'), (interval '75 days')) as g (d);
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b02', now() - interval '40 days', now() - interval '40 days' + interval '2 hours', 'door');
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b04', now() - d, now() - d + interval '4 hours', 'door'
from (values (interval '7 days'), (interval '30 days'), (interval '45 days'), (interval '60 days')) as g (d);
insert into public.self_exclusion (venue_id, member_id, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b03', now() + interval '20 days');
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b05', now() - interval '28 days', now() - interval '2 days');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000b07', 'Test');

select lives_ok($$ select private.queue_lapsed_players() $$, 'the day''s sweep');
select results_eq($$ select * from pg_temp.queued() $$, $$ values ('Kiran Das'::text), ('Lata Iyer') $$,
  'queues the lapsed regulars only: not a one-off visitor, one on a break or back from one, one who came last week, one without marketing consent or one frozen');
insert into public.self_exclusion (venue_id, member_id, ends_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b08', now() + interval '7 days');
select results_eq($$ select * from pg_temp.queued() $$, $$ values ('Lata Iyer'::text) $$, 'a break taken later takes the player out of the queue');
select lives_ok($$ select private.queue_lapsed_players() $$, 'the next day''s sweep');
select is((select count(*)::integer from public.host_queue_item where member_id = '00000000-0000-4000-8000-000000000b01'), 1, 'queues her once');

-- The host records the call, and the offer, as a promotion effect.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, visits, status from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer' $$,
  $$ values ('Lata Iyer'::text, 4, 'open'::text) $$, 'a host sees her, with her visits');
select lives_ok($$ select public.record_host_contact((select item_id from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer'), 'busy',
  '{"kind": "points", "points": 500}', 'Call back on Friday') $$, 'records that she is busy, and an offer of 500 points');
select results_eq($$ select status, churn_reason, offer ->> 'kind', note from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer' $$,
  $$ values ('offered'::text, 'busy'::text, 'points'::text, 'Call back on Friday'::text) $$, 'and the queue shows it');
select throws_ok($$ select public.record_host_contact((select item_id from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer'), 'tired', null, null) $$,
  '22023', null, 'a reason is one of the list');
select throws_ok($$ select public.record_host_contact((select item_id from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer'), 'busy',
  '{"kind": "cash"}', null) $$, '23514', null, 'and an offer is one of the promotion effects');
select throws_ok($$ select public.record_host_contact((select item_id from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer'), 'busy',
  '{"kind": "bonus", "amount_paise": 1000000000000000, "expires_days": 30}', null) $$, '23514', null, 'whole, within the builder''s own limits');
reset role;
update public.consent set withdrawn_at = now() where member_id = '00000000-0000-4000-8000-000000000b01' and purpose = 'marketing';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.host_queue('00000000-0000-4000-8000-000000000001') where full_name = 'Lata Iyer' $$, 'withdrawing marketing consent takes her off the host''s list');
reset role;
update public.consent set withdrawn_at = null where member_id = '00000000-0000-4000-8000-000000000b01' and purpose = 'marketing';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.host_queue('00000000-0000-4000-8000-000000000001') $$, 'a member sees no queue');
select throws_ok($$ select public.close_host_item((select id from public.host_queue_item limit 1)) $$, '42501', null, 'nor closes an item');
reset role;

-- She comes back: won back, and not queued again for that lapse.
insert into public.visit (venue_id, member_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b01');
select results_eq($$ select status, won_back_at is not null from public.host_queue_item where member_id = '00000000-0000-4000-8000-000000000b01' $$,
  $$ values ('won_back'::text, true) $$, 'a visit wins her back');
select lives_ok($$ select private.queue_lapsed_players() $$, 'the next sweep');
select is_empty($$ select * from pg_temp.queued() $$, 'queues nobody');

select * from finish();
rollback;
