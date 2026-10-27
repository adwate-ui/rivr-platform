-- The cage agent (#168, #123; decision 0260): staff who manage devices add it and read its code to it; the agent claims
-- the code, signed out through the cage-agent function (as the service role here), with the hash of its token; from
-- then on its token alone names it, until it is revoked. Wrong codes count by address. 101 Vikram is a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.hash(p_token text) returns text language sql as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
grant execute on function pg_temp.hash(text) to service_role, authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
create temporary table added on commit drop as select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'agent', 'Cage agent');
create temporary table cage on commit drop as select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage PC');
reset role;
grant select on added, cage to service_role, authenticated;
select is((select kind::text from public.device where id = (select device_id from added)), 'agent', 'staff who manage devices add the cage agent');

set local role service_role;
select results_eq($$ select refusal from public.claim_agent('000000', pg_temp.hash('agent-token'), '203.0.113.5') $$,
  $$ values ('wrong_code'::text) $$, 'a wrong code is refused');
select results_eq($$ select refusal from public.claim_agent((select code from cage), pg_temp.hash('agent-token'), '203.0.113.5') $$,
  $$ values ('wrong_code'::text) $$, 'and so is a cage computer''s code: it is no agent');
select results_eq(
  $$ select device_id, venue_id, refusal from public.claim_agent((select code from added), pg_temp.hash('agent-token'), '203.0.113.5') $$,
  $$ select device_id, '00000000-0000-4000-8000-000000000001'::uuid, null::text from added $$,
  'the agent claims its code with the hash of its token');
select results_eq($$ select device_id from public.agent_device(pg_temp.hash('agent-token')) $$, $$ select device_id from added $$,
  'its token names it from then on');
select is_empty($$ select * from public.agent_device(pg_temp.hash('another-token')) $$, 'and no other token does');
select results_eq($$ select refusal from public.claim_agent((select code from added), pg_temp.hash('agent-token-2'), '203.0.113.5') $$,
  $$ values ('wrong_code'::text) $$, 'a code is claimed once');
select results_eq($$ select refusal from public.claim_agent('111111', pg_temp.hash('x'), '203.0.113.5') $$,
  $$ values ('wrong_code'::text) $$, 'a fourth wrong code from the address');
select results_eq($$ select refusal from public.claim_agent('222222', pg_temp.hash('x'), '203.0.113.5') $$,
  $$ values ('wrong_code'::text) $$, 'a fifth');
select results_eq($$ select refusal from public.claim_agent((select code from added), pg_temp.hash('x'), '203.0.113.5') $$,
  $$ values ('too_many'::text) $$, 'then the address waits ten minutes');
select throws_ok($$ select * from public.claim_agent('333333', 'not-a-hash', '198.51.100.7') $$, '22023', null, 'a token''s hash is 64 hex digits');
reset role;

update public.device set revoked_at = now(), revoked_reason = 'Test' where id = (select device_id from added);
set local role service_role;
select is_empty($$ select * from public.agent_device(pg_temp.hash('agent-token')) $$, 'a revoked agent is no one');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.agent_device(pg_temp.hash('agent-token')) $$, '42501', null, 'staff signed in cannot look an agent up');
select throws_ok($$ select * from public.claim_agent('000000', pg_temp.hash('t'), '1') $$, '42501', null, 'nor claim a code: only the function does');
reset role;

select * from finish();
rollback;
