-- Members sync to the club's CRM (#647): each member's contact as the crm-sync consumer sends it, never for the practice
-- venue or an erased member; saved sign-up answers reach it; every member is queued once; service role only. Neha Kapoor
-- is a new club member who has played 90 minutes; 301 Asha is a practice-venue member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000c2151', '00000000-0000-4000-8000-000000000001', 'Neha Kapoor', '+919000000997');
insert into public.member_preference (member_id, venue_id, city, occupation, play_times, games_played)
values ('00000000-0000-4000-8000-0000000c2151', '00000000-0000-4000-8000-000000000001', 'Gurugram', 'salaried', '{weekends}', '{plo,roe}');
select results_eq($$ select event_type, payload from public.outbox_event
                    where venue_id = '00000000-0000-4000-8000-000000000001' and payload ->> 'member_id' = '00000000-0000-4000-8000-0000000c2151' $$,
  $$ values ('member.answers_saved'::text, '{"member_id": "00000000-0000-4000-8000-0000000c2151"}'::jsonb) $$,
  'saving the sign-up answers tells the CRM');

insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-0000000d2151', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c2151',
        '2026-10-30 14:00+00', '2026-10-30 17:00+00', 'door');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c2151', '00000000-0000-4000-8000-0000000d2151', g.id, 9,
       '2026-10-30 14:30+00', '2026-10-30 14:30+00', '2026-10-30 16:00+00', 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';

select results_eq($$ select full_name, phone, city, occupation, play_times, games_played, kyc_status, tier_name, seconds_played, last_visit_at
                    from public.crm_contact('00000000-0000-4000-8000-000000000001', '{"member_id": "00000000-0000-4000-8000-0000000c2151"}') $$,
  $$ values ('Neha Kapoor'::text, '+919000000997'::text, 'Gurugram'::text, 'salaried'::text, '{weekends}'::text[], '{plo,roe}'::text[],
             'none'::text, (select t.name from public.tier t join public.member m on m.tier_id = t.id where m.id = '00000000-0000-4000-8000-0000000c2151'),
             5400::bigint, '2026-10-30 14:00+00'::timestamptz) $$,
  'the contact: name, phone, the answers, no identity check yet, tier, 90 minutes played and the last visit');
select is_empty($$ select * from public.crm_contact('00000000-0000-4000-8000-000000000002', '{"member_id": "00000000-0000-4000-8000-0000000c2151"}') $$,
  'none under another venue');
select is_empty($$ select * from public.crm_contact('00000000-0000-4000-8000-000000000002', '{"member_id": "00000000-0000-4000-8000-000000000301"}') $$,
  'never at the practice venue');

create temp table queued as select public.queue_crm_sync() as n;
select is((select n from queued), (select count(*)::integer from public.member m join public.venue v on v.id = m.venue_id
                                   where not v.is_practice and m.erased_at is null),
  'every member is queued for the CRM');
select is(public.queue_crm_sync(), 0, 'once each');
select ok(exists (select 1 from public.outbox_event where event_type = 'member.crm_sync' and payload ->> 'member_id' = '00000000-0000-4000-8000-0000000c2151'),
  'the new member among them');
select ok(not exists (select 1 from public.outbox_event where event_type = 'member.crm_sync' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000301'),
  'and no practice-venue member');

update public.member set erased_at = now(), phone = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-0000000c2151';
select is_empty($$ select * from public.crm_contact('00000000-0000-4000-8000-000000000001', '{"member_id": "00000000-0000-4000-8000-0000000c2151"}') $$,
  'nothing for an erased member');
select ok(exists (select 1 from cron.job where jobname = 'outbox-crm-sync'), 'pg_cron runs the consumer');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.crm_contact('00000000-0000-4000-8000-000000000001', '{"member_id": "00000000-0000-4000-8000-000000000211"}') $$,
  '42501', null, 'only the consumer, as the service role, reads a contact');
select throws_ok($$ select public.queue_crm_sync() $$, '42501', null, 'or queues the members');
reset role;

select * from finish();
rollback;
