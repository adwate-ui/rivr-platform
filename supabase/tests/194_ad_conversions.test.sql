-- Conversions for Meta and Google Ads (#161, #162; decision 0279): which conversion each event is, only for a member
-- who consented to marketing, never at the practice venue. 211 Ishaan buys in twice at Table 3; 641 Vivaan visits twice;
-- 301 Asha is a practice-venue member. 103 Aditya is the floor, 104 a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.conversion(p_event_type text, p_payload jsonb) returns text language sql as $$
  select conversion from public.conversion_for('00000000-0000-4000-8000-000000000001', p_event_type, p_payload);
$$;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
insert into ids select 'first', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', '00000000-0000-4000-8000-0000000c1941');
insert into ids select 'second', public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1000000, 'cash', '00000000-0000-4000-8000-0000000c1942');
reset role;
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-0000000d1941', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000641', now() - interval '2 days', now() - interval '47 hours', 'door');
insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000d1942', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000641', now());

select is_empty($$ select * from public.conversion_for('00000000-0000-4000-8000-000000000001', 'kyc.completed', '{"member_id": "00000000-0000-4000-8000-000000000211"}') $$,
  'nothing for a member who has not consented to marketing');
insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'marketing'), ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000641', 'marketing');
select results_eq($$ select conversion, phone from public.conversion_for('00000000-0000-4000-8000-000000000001', 'kyc.completed', '{"member_id": "00000000-0000-4000-8000-000000000211"}') $$,
  $$ values ('kyc_complete'::text, '+919000000211'::text) $$, 'once they consent, KYC complete, with the phone each vendor hashes');
select is(pg_temp.conversion('academy.booked', '{"member_id": "00000000-0000-4000-8000-000000000211"}'), 'academy_booking', 'an Academy booking');
select is(pg_temp.conversion('tournament.entered', '{"member_id": "00000000-0000-4000-8000-000000000211"}'), 'tournament_entry', 'a tournament entry');
select results_eq($$ select pg_temp.conversion('cage.buy_in', jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000211', 'cage_transaction_id', id))
                    from ids where name in ('first', 'second') order by 1 nulls last $$,
  $$ values ('first_buy_in'::text), (null) $$, 'the first buy-in, and not a later one (these two share a moment: the id breaks the tie)');
select is(pg_temp.conversion('visit.opened', '{"member_id": "00000000-0000-4000-8000-000000000641", "visit_id": "00000000-0000-4000-8000-0000000d1941"}'),
  'first_visit', 'a first visit');
select is(pg_temp.conversion('visit.opened', '{"member_id": "00000000-0000-4000-8000-000000000641", "visit_id": "00000000-0000-4000-8000-0000000d1942"}'),
  'repeat_visit', 'and each visit after it, a repeat visit');
select is(pg_temp.conversion('visit.closed', '{"member_id": "00000000-0000-4000-8000-000000000641"}'), null, 'no other event is a conversion');

insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 'marketing');
select is_empty($$ select * from public.conversion_for('00000000-0000-4000-8000-000000000002', 'kyc.completed', '{"member_id": "00000000-0000-4000-8000-000000000301"}') $$,
  'never at the practice venue');
select ok(exists (select 1 from cron.job where jobname = 'outbox-meta-conversions') and exists (select 1 from cron.job where jobname = 'outbox-google-ads'),
  'pg_cron runs both consumers');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select * from public.conversion_for('00000000-0000-4000-8000-000000000001', 'kyc.completed', '{"member_id": "00000000-0000-4000-8000-000000000211"}') $$,
  '42501', null, 'only the consumers, as the service role, ask');
reset role;

select * from finish();
rollback;
