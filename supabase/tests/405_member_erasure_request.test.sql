-- Deleting an account from the app (#813, decision 0574). Tara (0811) asks from Profile and Vikram (101), a super admin,
-- erases her with the existing erasure. Dev (0812) is erased without asking. Neha (0813) asks while frozen, so her request
-- stays open. Uma (0814) asks at the practice venue. Aditya (103) is an admin, who erases no one.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.as_service() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.as_owner(), pg_temp.as_service() to authenticated, service_role;

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.phone, now(), now(), now()
from (values ('00000000-0000-4000-8000-0000000d0811', '919000000811'), ('00000000-0000-4000-8000-0000000d0813', '919000000813'),
             ('00000000-0000-4000-8000-0000000d0814', '919000000814')) as u (id, phone);
insert into public.member (id, venue_id, user_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000d0811', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0811', 'Tara Mehta', '+919000000811'),
  ('00000000-0000-4000-8000-0000000d0812', '00000000-0000-4000-8000-000000000001', null, 'Dev Khanna', '+919000000812'),
  ('00000000-0000-4000-8000-0000000d0813', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0813', 'Neha Sood', '+919000000813'),
  ('00000000-0000-4000-8000-0000000d0814', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0814', 'Uma Rao', '+919000000814');

-- ---------------------------------------------------------------------------------------------------
-- The table is reached only through the functions.
select has_table('public', 'member_erasure_request', 'the table is there');
select ok((select c.relrowsecurity from pg_class c where c.oid = 'public.member_erasure_request'::regclass), 'row-level security is on');
select hasnt_column('public', 'member_erasure_request', 'notice_phone', 'the request holds no number, so no export can carry one');
select ok(not has_table_privilege('authenticated', 'public.member_erasure_request', 'select'), 'a signed-in caller cannot read the table');
select ok(not has_table_privilege('anon', 'public.member_erasure_request', 'select'), 'nor can anyone signed out');
select ok(not has_function_privilege('anon', 'public.request_my_erasure()', 'execute'), 'and no one signed out can ask');
select is((select f.is_gateable from public.feature f where f.key = 'account.delete'), false, 'no tier loses the way to delete an account');

-- ---------------------------------------------------------------------------------------------------
-- Asking.
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0811');
select is_empty($$ select * from public.my_erasure_request() $$, 'nothing is asked yet');
select isnt(public.request_my_erasure(), null::timestamptz, 'Tara asks');
select isnt((select r.requested_at from public.my_erasure_request() r), null::timestamptz, 'and sees that she asked');
select lives_ok($$ select public.request_my_erasure() $$, 'asking again is no fault');
select pg_temp.as_owner();
select is((select count(*)::integer from public.member_erasure_request r where r.member_id = '00000000-0000-4000-8000-0000000d0811'), 1,
          'and leaves one request');

select pg_temp.as_person('00000000-0000-4000-8000-0000000d0899');
select throws_ok($$ select public.request_my_erasure() $$, '42501', null, 'someone who is not a member cannot ask');

select pg_temp.as_person('00000000-0000-4000-8000-0000000d0814');
select isnt(public.request_my_erasure(), null::timestamptz, 'Uma asks at the practice venue');

select pg_temp.as_owner();
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-0000000d0813', 'Suspected chip dumping');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0813');
select isnt(public.request_my_erasure(), null::timestamptz, 'a frozen member can still ask');

-- ---------------------------------------------------------------------------------------------------
-- Who sees the requests.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select set_eq($$ select full_name from public.member_erasure_requests('00000000-0000-4000-8000-000000000001') $$,
              array['Tara Mehta', 'Neha Sood'], 'a super admin sees the venue''s open requests, not the practice venue''s');
select is((select q.waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') q where q.queue = 'erasureRequests'), 2,
          'and counts them on the rail');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.member_erasure_requests('00000000-0000-4000-8000-000000000001') $$, 'an admin does not see them');
select is_empty($$ select * from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') q where q.queue = 'erasureRequests' $$,
                'nor counts them');

-- ---------------------------------------------------------------------------------------------------
-- The existing erasure completes a request, and keeps its checks.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0813', 'Neha Sood', 'Asked from the app') $$, 'RVERA', null,
                 'it is refused while something is open');
select pg_temp.as_owner();
select is((select r.completed_at from public.member_erasure_request r where r.member_id = '00000000-0000-4000-8000-0000000d0813'), null::timestamptz,
          'and the request stays open');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0811', 'Tara Mehta', 'Asked from the app') $$, 'Tara is erased');
select set_eq($$ select full_name from public.member_erasure_requests('00000000-0000-4000-8000-000000000001') $$, array['Neha Sood'], 'and leaves the list');
select pg_temp.as_owner();
select isnt((select r.completed_at from public.member_erasure_request r where r.member_id = '00000000-0000-4000-8000-0000000d0811'), null::timestamptz,
            'her request is complete');
select is((select m.phone from public.member m where m.id = '00000000-0000-4000-8000-0000000d0811'), null, 'her number leaves her record');
select is((select p.phone from private.erasure_notice_phone p where p.member_id = '00000000-0000-4000-8000-0000000d0811'), '+919000000811',
          'and is kept apart, for the one message');
select results_eq($$ select e.payload ->> 'notice', e.payload -> 'params' from public.outbox_event e
                     where e.event_type = 'member.notice' and e.payload ->> 'member_id' = '00000000-0000-4000-8000-0000000d0811' $$,
                  $$ values ('account_erased', '[]'::jsonb) $$, 'one notice says it is done, after the erasure cleared her queue');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0812', 'Dev Khanna', 'Asked at the desk') $$, 'Dev is erased without asking');
select pg_temp.as_owner();
select is_empty($$ select 1 from public.member_erasure_request r where r.member_id = '00000000-0000-4000-8000-0000000d0812' $$, 'he has no request');
select is_empty($$ select 1 from public.outbox_event e where e.event_type = 'member.notice' and e.payload ->> 'member_id' = '00000000-0000-4000-8000-0000000d0812' $$,
                'and no notice, so his number is not kept');
select is_empty($$ select 1 from private.erasure_notice_phone p where p.member_id = '00000000-0000-4000-8000-0000000d0812' $$, 'nor is it anywhere else');
-- A restore, or the practice reset's seed, can bring back a request its erasure had closed.
insert into public.member_erasure_request (venue_id, member_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0812');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select set_eq($$ select full_name from public.member_erasure_requests('00000000-0000-4000-8000-000000000001') $$, array['Neha Sood'],
              'a request that came back for someone already erased is not listed');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------------------------------
-- The kept number serves that one message.
select pg_temp.as_service();
select is(public.erased_member_notice_phone('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0811'), '+919000000811',
          'the WhatsApp consumer can read the kept number');
select is(public.erased_member_notice_phone('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0811'), null, 'for its own venue only');
select is((select r.phone from public.message_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0811') r), null,
          'every other message still finds no number');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.erased_member_notice_phone('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0811') $$, '42501', null,
                 'staff cannot read it');
select pg_temp.as_owner();
insert into private.erasure_notice_phone (member_id, venue_id, phone)
values ('00000000-0000-4000-8000-0000000d0814', '00000000-0000-4000-8000-000000000002', '+919000000814');
select pg_temp.as_service();
select is(public.erased_member_notice_phone('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0814'), null,
          'and the practice venue never gives one');

-- ---------------------------------------------------------------------------------------------------
-- Forgotten within 48 hours: the job runs hourly and clears a number kept for a day.
select pg_temp.as_owner();
update private.erasure_notice_phone set kept_at = now() - interval '25 hours' where member_id = '00000000-0000-4000-8000-0000000d0811';
select private.forget_erasure_notice_phones();
select is((select p.phone from private.erasure_notice_phone p where p.member_id = '00000000-0000-4000-8000-0000000d0811'), null, 'a day on, the number is gone');
select isnt((select p.phone from private.erasure_notice_phone p where p.member_id = '00000000-0000-4000-8000-0000000d0814'), null, 'a newer one stays');
select ok(exists (select 1 from cron.job j where j.jobname = 'erasure-notice-phones-forget' and j.schedule = '25 * * * *'), 'the job runs hourly');

-- ---------------------------------------------------------------------------------------------------
-- Someone without the app reads how to ask.
select ok(exists (select 1 from public.site_page p
                  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'delete-account' and p.is_published), 'the website has the page');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'delete-account' and b.content ->> 'body' like '%within 7 days%'), 1,
          'and it says when');

-- ---------------------------------------------------------------------------------------------------
-- A frozen venue takes no new request. Last, as nothing lifts the freeze.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0813');
select throws_ok($$ select public.request_my_erasure() $$, 'RVFRZ', null, 'a frozen venue takes no new request');
select pg_temp.as_owner();

select * from finish();
rollback;
