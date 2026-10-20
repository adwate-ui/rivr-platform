-- The messaging stop (#91; features "Kill switch", level 3): while it is engaged, WhatsApp sends and social
-- posts hold, and they go out once it is released. claim_outbox_deliveries holds every consumer that does not
-- say it reaches no one (its default); the WhatsApp consumer says it sends (isMessaging, @rivr/adapters), and
-- a social publisher holds by that default. 101 Vikram is a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.offered(p_consumer text, p_event_type text, p_is_messaging boolean default true) returns integer language sql as $$
  select count(*)::integer from public.claim_outbox_deliveries(p_consumer, array[p_event_type], p_is_messaging);
$$;

-- A WhatsApp message and a social post waiting to go out, at the club and at the practice venue.
select private.emit('00000000-0000-4000-8000-000000000001', 'test.whatsapp_message', '{}', 'stop-test-whatsapp');
select private.emit('00000000-0000-4000-8000-000000000001', 'test.social_post', '{}', 'stop-test-social');
select private.emit('00000000-0000-4000-8000-000000000002', 'test.whatsapp_message', '{}', 'stop-test-practice');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
create temporary table stop on commit drop as
select public.engage_control('00000000-0000-4000-8000-000000000001', 'messaging_stop', 'Wrong offer sent') as id;
reset role;
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 0, 'WhatsApp sends hold while the messaging stop is engaged');
select is((select count(*)::integer from public.claim_outbox_deliveries('social', array['test.social_post'])), 0,
  'and so do social posts, held by default');
select is(pg_temp.offered('tally', 'test.whatsapp_message', false), 1, 'a consumer that reaches no one carries on');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.release_control((select id from stop), 'Offer corrected'), 'released', 'the stop is released');
reset role;
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 1, 'the held WhatsApp message goes out after release, and never the practice venue''s');
select is((select count(*)::integer from public.claim_outbox_deliveries('social', array['test.social_post'])), 1, 'and the held post');
select is(pg_temp.offered('whatsapp', 'test.whatsapp_message'), 0, 'each once');

select * from finish();
rollback;
