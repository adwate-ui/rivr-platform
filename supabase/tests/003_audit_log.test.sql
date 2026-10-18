-- The audit log records changes with the actor, never holds secrets, and nothing alters it.
-- 103 Aditya (admin), 104 Sana (cashier), 109 Nikhil (owner_view, audit.read).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Behind hosted Supabase, Cloudflare sets cf-connecting-ip; the client writes X-Forwarded-For.
set local request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1", "cf-connecting-ip": "198.51.100.7"}';
select is(private.request_ip(), '198.51.100.7'::inet, 'the audit log takes the address Cloudflare saw, not the one the client claims');
set local request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1"}';
select is(private.request_ip(), '203.0.113.9'::inet, 'the local stack has no Cloudflare and falls back to X-Forwarded-For');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
insert into public.staff (venue_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-000000000001', 'Audited Hire', 'Host', 'host');
reset role;

select is(
  (select actor_user_id from public.audit_log where entity = 'staff' and after ->> 'full_name' = 'Audited Hire'),
  '00000000-0000-4000-8000-000000000103'::uuid,
  'adding staff writes an audit row naming who did it'
);
select is(
  (select action from public.audit_log where entity = 'staff' and after ->> 'full_name' = 'Audited Hire'),
  'insert',
  'the audit row says what happened'
);

insert into public.staff_credential (staff_id, venue_id, pin_hash)
select id, venue_id, 'secret-hash' from public.staff where full_name = 'Audited Hire';
select ok(
  (select not (after ? 'pin_hash') from public.audit_log where entity = 'staff_credential' order by id desc limit 1),
  'PIN hashes never reach the audit log'
);

select throws_ok($$ update public.audit_log set reason = 'tampered' $$, '42501', null, 'the audit log cannot be edited, even by the owner');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'the audit log cannot be deleted, even by the owner');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'the audit log cannot be truncated');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000109", "role": "authenticated"}';
select ok((select count(*) from public.audit_log) > 0, 'an owner_view user reads the audit log');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is((select count(*) from public.audit_log)::int, 0, 'a cashier cannot read the audit log');
select throws_ok(
  $$ insert into public.audit_log (venue_id, action, entity) values ('00000000-0000-4000-8000-000000000001', 'forged', 'x') $$,
  '42501', null, 'no client writes the audit log directly'
);

select * from finish();
rollback;
