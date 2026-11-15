-- The welcome message (the owner, 15 Nov night, decision 0661): member.signed_up names the member who joined, once, and what
-- the message needs is read with their number when it is sent: the first word of their name and their member number. The
-- WhatsApp consumer is offered the sign-up once, never one made before the welcome began (the migration marks those
-- delivered, as below), and never one of the practice venue, whose members are never read.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000005a1', 'authenticated', 'authenticated', '919000000961', now(), now(), now());

-- Signed in as a user whose session began with a code, as every session does (#187).
create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-0000000005a1');
select lives_ok($$ select public.sign_up('  Neha   Kapoor Rao ', '{}') $$, 'a new number signs up');
select lives_ok($$ select public.sign_up('Neha Kapoor Rao', '{}') $$, 'and asks again');
reset role;

select set_config('test.member', (select id::text from public.member where user_id = '00000000-0000-4000-8000-0000000005a1'), false);
select set_config('test.number', (select member_number::text from public.member where user_id = '00000000-0000-4000-8000-0000000005a1'), false);
select results_eq($$ select venue_id, payload ->> 'member_id' from public.outbox_event where event_type = 'member.signed_up' $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, current_setting('test.member')) $$,
  'member.signed_up names the member who joined, at the club, once');

-- As the consumer reads the member the event names, at its venue, with the service role.
set local role service_role;
select results_eq(
  $$ select phone, first_name, member_number from public.message_recipient('00000000-0000-4000-8000-000000000001', current_setting('test.member')::uuid) $$,
  $$ values ('+919000000961'::text, 'Neha'::text, current_setting('test.number')::bigint) $$,
  'the message reads their number, the first word of their name and their member number');
select is_empty($$ select * from public.message_recipient('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301') $$,
  'never a practice member''s');
reset role;

-- A sign-up made before the welcome began, marked delivered for WhatsApp as 20261121100000 marks every earlier one.
select private.emit('00000000-0000-4000-8000-000000000001', 'member.signed_up',
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000202'), 'member.signed_up:00000000-0000-4000-8000-000000000202');
insert into public.outbox_delivery (venue_id, event_id, consumer, status, delivered_at)
select e.venue_id, e.id, 'whatsapp', 'delivered', now() from public.outbox_event e
where e.idempotency_key = 'member.signed_up:00000000-0000-4000-8000-000000000202';
-- A sign-up event at the practice venue, which sign-up never makes, is never offered.
select private.emit('00000000-0000-4000-8000-000000000002', 'member.signed_up',
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000301'), 'member.signed_up:00000000-0000-4000-8000-000000000301');
select results_eq($$ select venue_id, payload ->> 'member_id' from public.claim_outbox_deliveries('whatsapp', array['member.signed_up']) $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid, current_setting('test.member')) $$,
  'the WhatsApp consumer is offered the club''s new sign-up, never one made before the welcome began, nor the practice venue''s');
select is_empty($$ select * from public.claim_outbox_deliveries('whatsapp', array['member.signed_up']) $$,
  'and only once: claimed, it is not offered again');

select * from finish();
rollback;
