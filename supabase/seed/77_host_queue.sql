-- The Host queue flow's lapsed regular (#165): Ritika Bhalla came four times and not for a month, so the day's sweep has
-- queued her. Only the queued item is seeded: seeds call no business functions and add no visits or consents, which
-- other tests count. The flow grants her marketing consent itself. pgTAP 193 covers the sweep.
insert into public.host_queue_item (venue_id, member_id, last_visit_at, visits)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000642', now() - interval '30 days', 4
where not exists (select 1 from public.host_queue_item h where h.member_id = '00000000-0000-4000-8000-000000000642');
