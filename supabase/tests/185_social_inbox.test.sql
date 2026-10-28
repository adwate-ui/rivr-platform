-- The social inbox (#156; decision 0268): the webhook's messages become leads for the club, never the practice venue;
-- a WhatsApp lead is linked to the member with that number (Yash, 214) at once, or when its sender signs up; staff who
-- publish marketing (107) read the leads, a cashier (104) none, and nobody another club's; erasure deletes them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-inbox', false, 'RIVR test', 'Test', 'TST');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.message(p_id text, p_channel text, p_thread text, p_text text, p_at text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'channel', p_channel, 'thread_id', p_thread, 'handle', p_thread, 'text', p_text, 'received_at', p_at);
$$;
grant execute on function pg_temp.message(text, text, text, text, text) to service_role;
create temporary table yash on commit drop as select phone from public.member where id = '00000000-0000-4000-8000-000000000214';
grant select on yash to service_role, authenticated;

-- Another club's lead.
insert into public.lead (venue_id, channel, thread_id, handle, first_message, last_message_at)
values ('00000000-0000-4000-8000-0000000000aa', 'instagram', 'aa-1', 'aa-1', 'Elsewhere', now());

select set_config('role', 'service_role', true);
select is(public.record_inbox_messages('00000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.message('t185-1', 'instagram', '1784', 'Is there a game tonight?', '2026-11-15T18:00:00Z'),
    pg_temp.message('t185-2', 'instagram', '1784', 'What are the stakes?', '2026-11-15T18:05:00Z'),
    pg_temp.message('t185-3', 'whatsapp', (select phone from yash), 'Hi, can I book a seat?', '2026-11-15T18:10:00Z'),
    pg_temp.message('t185-4', 'whatsapp', '+919999918501', 'How do I join?', '2026-11-15T18:20:00Z'))), 4,
  'the webhook''s four messages are recorded');
select is(public.record_inbox_messages('00000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.message('t185-2', 'instagram', '1784', 'What are the stakes?', '2026-11-15T18:05:00Z'))), 0,
  'a message Meta sends again is kept once');
select throws_ok($$ select public.record_inbox_messages('00000000-0000-4000-8000-000000000002',
                     jsonb_build_array(pg_temp.message('t185-9', 'instagram', '9', 'Hi', '2026-11-15T18:00:00Z'))) $$,
  '22023', null, 'never for the practice venue');
select set_config('role', 'postgres', true);

select results_eq(
  $$ select channel, first_message, member_id from public.lead where venue_id = '00000000-0000-4000-8000-000000000001' and thread_id in ('1784', (select phone from yash), '+919999918501')
     order by last_message_at $$,
  $$ values ('instagram'::text, 'Is there a game tonight?'::text, null::uuid), ('whatsapp', 'Hi, can I book a seat?', '00000000-0000-4000-8000-000000000214'::uuid),
            ('whatsapp', 'How do I join?', null) $$,
  'each conversation is a lead, with its first message; a WhatsApp one from a member''s number is linked to them');

-- The sender of the last one signs up.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e185', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919999918501');
insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select '00000000-0000-4000-8000-00000000e185', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e185', 'Neha Lead', '+919999918501',
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member');
select is((select member_id from public.lead where thread_id = '+919999918501'), '00000000-0000-4000-8000-00000000e185'::uuid,
  'a lead is linked to its sender when they sign up');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.lead $$, 'a cashier sees no leads');
select throws_ok($$ select * from public.venue_leads('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor reads them');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select results_eq(
  $$ select channel, messages, member_name from public.venue_leads('00000000-0000-4000-8000-000000000001') where handle in ('1784', '+919999918501') order by last_message_at $$,
  $$ values ('instagram'::text, 2, null::text), ('whatsapp', 1, 'Neha Lead') $$,
  'marketing reads the leads, how many messages, and the member each became');
select is_empty($$ select * from public.lead where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'and no other club''s');

-- Erasure deletes a member's leads and their messages.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select private.delete_member_records(m) from public.member m where m.id = '00000000-0000-4000-8000-00000000e185';
select is_empty($$ select * from public.lead where thread_id = '+919999918501' $$, 'an erased member''s leads are deleted');
select is_empty($$ select * from public.inbox_message where source_id = 't185-4' $$, 'and their messages');

select * from finish();
rollback;
