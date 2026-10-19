-- The WhatsApp consumer (#62): the service role reads a member's number and marketing opt-in to send
-- a message, nobody else does; the consumer is scheduled. A messaging stop holding its deliveries is
-- 006_kill_switch_and_outbox's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'marketing');

set local role service_role;
select results_eq($$ select phone, marketing_opted_in_at is not null from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  $$ values ('+919000000202'::text, true) $$, 'the consumer reads a member''s number and that they opted in to marketing');
select results_eq($$ select phone, marketing_opted_in_at from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') $$,
  $$ values ('+919000000203'::text, null::timestamptz) $$, 'and that one who did not, did not');
reset role;
update public.consent set withdrawn_at = now() where member_id = '00000000-0000-4000-8000-000000000202';
set local role service_role;
select is((select marketing_opted_in_at from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202')), null,
  'an opt-in withdrawn is no opt-in');
select is_empty($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000999') $$, 'no one for a member who is not there');
select is_empty($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000202') $$,
  'nor for a member asked for at another venue');
select is_empty($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301') $$,
  'nor ever a practice member');
reset role;

set local role anon;
select throws_ok($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$, '42501', null, 'a visitor reads no number');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$, '42501', null, 'nor does staff, through this');
reset role;

select ok(exists (select 1 from cron.job where command like '%run_outbox_consumer%whatsapp%'), 'pg_cron runs the WhatsApp consumer');

select * from finish();
rollback;
