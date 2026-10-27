-- A Google review request after the third visit (#159). Yash (214) has two closed visits and rated the second 2 of 5:
-- a review is asked whatever the feedback. It is a marketing message (decision 0249), so a close asks only when one
-- may go to him: a link is set, he opted in, marketing sends are on, and nothing was sent to him tonight. Held back,
-- it is asked at a later close; once asked, never again. 103 is an admin; erasure deletes the request.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- Yash comes in and leaves now.
create function pg_temp.visit() returns void language sql as $$
  insert into public.visit (venue_id, member_id, opened_at)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '3 hours');
  update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is null;
$$;
create function pg_temp.asked() returns integer language sql as $$
  select count(*)::integer from public.review_request where member_id = '00000000-0000-4000-8000-000000000214';
$$;

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - d.ago, now() - d.ago + interval '4 hours', 'door'
from (values (interval '20 days'), (interval '10 days')) as d (ago);
insert into public.feedback (venue_id, member_id, visit_id, score)
select venue_id, member_id, id, 2 from public.visit
where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is not null order by opened_at desc limit 1;
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000214' and closed_at is not null), 2,
  'Yash has two visits behind him, the last rated 2 of 5');
-- A known start: nothing marketing sent to him yet tonight, and opted in to marketing.
delete from public.outbox_event
where payload ->> 'member_id' = '00000000-0000-4000-8000-000000000214' and event_type in ('promotion.offered', 'review.requested');
insert into public.consent (venue_id, member_id, purpose) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'marketing');

select pg_temp.visit();
select is(pg_temp.asked(), 0, 'without a review link, his third visit asks nothing');

select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'reviews.google_url', '', '{"url": "https://rivr-reviews.example/r"}', now(), 'Test') $$,
  null, null, 'the link must be one of Google''s review addresses');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'reviews.google_url', '', '{"url": "https://g.page/r/rivr-gurugram/review"}', now() - interval '3 seconds', 'Test');

insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'marketing_sends', 'Test');
select pg_temp.visit();
select is(pg_temp.asked(), 0, 'nothing is asked while marketing sends are switched off');
update public.control_state set released_at = now(), release_reason = 'Test',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001')
where feature = 'marketing_sends' and released_at is null;

update public.consent set withdrawn_at = now() where member_id = '00000000-0000-4000-8000-000000000214' and purpose = 'marketing';
select pg_temp.visit();
select is(pg_temp.asked(), 0, 'nor of a member who has not opted in to marketing');
insert into public.consent (venue_id, member_id, purpose) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'marketing');

select private.emit('00000000-0000-4000-8000-000000000001', 'promotion.offered',
                    jsonb_build_object('promotion_id', gen_random_uuid(), 'member_id', '00000000-0000-4000-8000-000000000214', 'title', 'Test',
                                       'detail', 'Test', 'runs', 'Tonight'),
                    'test-offer');
select pg_temp.visit();
select is(pg_temp.asked(), 0, 'nor on a club day he was already offered a promotion: one marketing send a day');
delete from public.outbox_event where idempotency_key = 'test-offer';

select pg_temp.visit();
select is(pg_temp.asked(), 1, 'held back, it is asked at a later close, whatever his feedback');
select results_eq(
  $$ select payload ->> 'member_id', payload ->> 'url' from public.outbox_event where event_type = 'review.requested' $$,
  $$ values ('00000000-0000-4000-8000-000000000214'::text, 'https://g.page/r/rivr-gurugram/review'::text) $$,
  'review.requested carries the venue''s link, for the WhatsApp consumer');
select is((select count(*)::integer from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000214'), 0, 'and no reward');
select is(private.may_send_marketing('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214'), false,
  'it is his marketing send for the day, so no promotion is offered to him tonight');

select pg_temp.visit();
select is((select count(*)::integer from public.outbox_event where event_type = 'review.requested'), 1, 'a later visit asks nothing more');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.review_request), 1, 'staff who read members see the request');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is((select count(*)::integer from public.review_request), 0, 'a member reads none');
reset role;

select private.delete_member_records(m) from public.member m where m.id = '00000000-0000-4000-8000-000000000214';
select is(pg_temp.asked(), 0, 'erasing him deletes the request');

select * from finish();
rollback;
