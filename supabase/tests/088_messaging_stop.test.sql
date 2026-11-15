-- The messaging stop (#91; level 3 of the controls): while it is engaged, WhatsApp sends and push
-- messages hold, and they go out once it is released. No screen engages one since the Kill switch went, so the stop is
-- written here as the database itself. claim_outbox_deliveries holds every consumer that does not
-- say it reaches no one (its default); the WhatsApp consumer says it sends (isMessaging, @rivr/adapters), and
-- a consumer that says nothing, here push, holds by that default. 101 Vikram is a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.offered(p_consumer text, p_event_type text, p_is_messaging boolean default true) returns integer language sql as $$
  select count(*)::integer from public.claim_outbox_deliveries(p_consumer, array[p_event_type], p_is_messaging);
$$;

-- A WhatsApp message and a push message waiting to go out, at the club and at the practice venue.
select private.emit('00000000-0000-4000-8000-000000000001', 'test.whatsapp_message', '{}', 'stop-test-whatsapp');
select private.emit('00000000-0000-4000-8000-000000000001', 'test.push_message', '{}', 'stop-test-push');
select private.emit('00000000-0000-4000-8000-000000000002', 'test.whatsapp_message', '{}', 'stop-test-practice');

insert into public.control_state (venue_id, level, reason)
values ('00000000-0000-4000-8000-000000000001', 'messaging_stop', 'Wrong offer sent');
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 0, 'WhatsApp sends hold while the messaging stop is engaged');
select is((select count(*)::integer from public.claim_outbox_deliveries('push', array['test.push_message'])), 0,
  'and so do push messages, held by default');
select is(pg_temp.offered('reports', 'test.whatsapp_message', false), 1, 'a consumer that reaches no one carries on');

update public.control_state
set released_at = now(), release_reason = 'Offer corrected',
    released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101'
                            and venue_id = '00000000-0000-4000-8000-000000000001')
where venue_id = '00000000-0000-4000-8000-000000000001' and level = 'messaging_stop' and released_at is null;
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 1, 'the held WhatsApp message goes out after release, and never the practice venue''s');
select is((select count(*)::integer from public.claim_outbox_deliveries('push', array['test.push_message'])), 1, 'and the held push message');
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 0, 'each once');

select * from finish();
rollback;
