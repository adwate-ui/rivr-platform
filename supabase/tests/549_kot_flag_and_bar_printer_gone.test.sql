-- Nothing prints KOTs since the cage agent went (decision 0651), so the console's flag on a KOT the bar printer did not get
-- is gone from tonight's orders, a page of a club day's orders and the list behind it, and the silent-consumer check no
-- longer expects the bar printer to take what it took before (#1019). Test event types, so the seed's events stay out.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(pg_get_function_result('public.fnb_orders_tonight(uuid)'::regprocedure) !~ 'kot_print_failed'
          and pg_get_function_result('private.fnb_orders_tonight(uuid)'::regprocedure) !~ 'kot_print_failed',
  'tonight''s orders carry no flag for the bar printer');
select ok(pg_get_function_result('public.fnb_orders_page(uuid, jsonb)'::regprocedure) !~ 'kot_print_failed'
          and pg_get_function_result('private.fnb_orders_page(uuid, jsonb)'::regprocedure) !~ 'kot_print_failed'
          and pg_get_functiondef('private.list_spec(text)'::regprocedure) !~ 'kot_print_failed|bar_printer',
  'nor does a page of a club day''s orders, nor the list it reads');
select ok(has_function_privilege('authenticated', 'public.fnb_orders_tonight(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.fnb_orders_page(uuid, jsonb)', 'execute')
          and not has_function_privilege('anon', 'public.fnb_orders_tonight(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.fnb_orders_page(uuid, jsonb)', 'execute'),
  'staff still read them, and nobody signed out does');

delete from public.alert;
delete from public.outbox_delivery;
-- The bar printer and feedback each took test.kot events at the club two days ago; one made twenty minutes ago is
-- taken by neither.
insert into public.outbox_event (venue_id, event_type, idempotency_key, occurred_at) values
  ('00000000-0000-4000-8000-000000000001', 'test.kot', 'kot-taken', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 'test.kot', 'kot-late', now() - interval '20 minutes');
insert into public.outbox_delivery (venue_id, event_id, consumer, status, attempts, delivered_at)
select e.venue_id, e.id, c.consumer, 'delivered', 1, now() - interval '2 days'
from public.outbox_event e cross join (values ('bar_printer'), ('feedback')) c (consumer)
where e.idempotency_key = 'kot-taken';
select is(private.check_silent_consumers(), 1, 'an event its consumers have not taken twenty minutes on raises an alert');
select results_eq($$ select detail from public.alert where kind = 'outbox.silent' $$,
  $$ values ('{"consumers": ["feedback"]}'::jsonb) $$, 'naming feedback, not the bar printer that went');

-- The bar printer alone stays quiet.
delete from public.alert;
delete from public.outbox_delivery where consumer = 'feedback';
select is(private.check_silent_consumers(), 0, 'events only the bar printer took raise nothing');

select * from finish();
rollback;
