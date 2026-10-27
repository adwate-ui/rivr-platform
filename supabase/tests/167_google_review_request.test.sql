-- A Google review request after the third visit (#159). Yash (214) has two closed visits; his third, closing, asks
-- once, with the venue's link and no reward; a fourth asks nothing more. With no link set, nothing is asked.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - d.ago, now() - d.ago + interval '4 hours', 'door'
from (values (interval '20 days'), (interval '10 days')) as d (ago);
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is not null), 2,
  'Yash has two visits behind him');

-- No link yet: his third visit asks nothing.
insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '3 hours');
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is null;
select is((select count(*)::integer from public.review_request), 0, 'without a review link, nothing is asked');
reset role;

-- With a link, as if his third visit closed now.
delete from public.visit where member_id = '00000000-0000-4000-8000-000000000214' and opened_at > now() - interval '4 hours';
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'reviews.google_url', '', '{"url": "https://g.page/r/rivr-gurugram/review"}', now() - interval '3 seconds', 'Test');
insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '3 hours');
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is null;
select is((select count(*)::integer from public.review_request where member_id = '00000000-0000-4000-8000-000000000214'), 1, 'his third visit asks for a review');
select results_eq(
  $$ select payload ->> 'member_id', payload ->> 'url' from public.outbox_event where event_type = 'review.requested' $$,
  $$ values ('00000000-0000-4000-8000-000000000214'::text, 'https://g.page/r/rivr-gurugram/review'::text) $$,
  'review.requested carries the venue''s link, for the WhatsApp consumer');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000214'), 0, 'and no reward');

insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '2 hours');
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is null;
select is((select count(*)::integer from public.outbox_event where event_type = 'review.requested'), 1, 'a fourth visit asks nothing more');

select * from finish();
rollback;
