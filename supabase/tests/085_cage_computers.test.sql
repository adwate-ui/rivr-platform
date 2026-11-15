-- Cage and admin computers (decision 0110): a device manager enrols a cage computer or an admin console with a code
-- that staff claim on that computer, once; its token is stored only as its hash. The cage and admin networks went on
-- 15 Nov, so no venue enforces its computers and a permission works from any of them. 104 is a cashier, 101 the owner
-- (super admin), 103 Aditya an admin, 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Signs a person in, on a computer: the address the request comes from and the token it sends, if any.
create function pg_temp.at(p_person text, p_address text, p_token text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true),
         set_config('request.headers', jsonb_strip_nulls(jsonb_build_object('x-forwarded-for', p_address, 'x-rivr-computer', p_token))::text, true);
$$;
create function pg_temp.may(p_permission text, p_venue text default '00000000-0000-4000-8000-000000000001') returns boolean language sql as $$
  select private.has_permission(p_venue::uuid, p_permission);
$$;
create function pg_temp.hash(p_token text) returns text language sql as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
grant execute on function pg_temp.at(text, text, text), pg_temp.may(text, text), pg_temp.hash(text) to authenticated;

-- The club's cage computer and the office's admin console, as a device manager enrols them.
insert into public.device (id, venue_id, kind, name, token_hash) values
  ('00000000-0000-4000-8000-0000000c3841', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage 1', pg_temp.hash('cage-token')),
  ('00000000-0000-4000-8000-0000000c3842', '00000000-0000-4000-8000-000000000001', 'console', 'Office', pg_temp.hash('office-token'));

select pg_temp.at('00000000-0000-4000-8000-000000000104', null, null);
select ok(pg_temp.may('cage.transact'), 'with no cage and admin networks, a cashier takes money from any computer');

-- A computer knows itself by its token.
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', null);
select results_eq($$ select kind::text, name from public.this_computer('00000000-0000-4000-8000-000000000001') $$,
  $$ values (null::text, null::text) $$, 'this computer: not enrolled');
set local role authenticated;
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
select results_eq($$ select kind::text, name from public.this_computer('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('console'::text, 'Office'::text) $$, 'this computer: the office''s admin console');
select ok(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'admin'), 'from it, the owner gives the admin role');
select pg_temp.at('00000000-0000-4000-8000-000000000103', '203.0.113.9', 'office-token');
select ok(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'host'),
  'and an admin gives the host role from it');
select ok(not private.can_grant_role('00000000-0000-4000-8000-000000000001', 'admin'),
  'but not the admin role, which moves money and approves a second time: a super admin''s to give (B3)');

-- The admin console adds the second cage, with a code; staff claim it on that computer.
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
create temporary table issued as select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2');
select ok((select code ~ '^[0-9]{6}$' and expires_at > now() from issued), 'from the admin console, the owner adds the second cage and gets its code');
select pg_temp.at('00000000-0000-4000-8000-000000000106', '203.0.113.9', 'office-token');
select throws_ok($$ select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 3') $$,
  '42501', null, 'a dealer adds no computer, even at the admin console');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', null);
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', '000000', pg_temp.hash('cage-2-token')), null::uuid, 'a wrong code claims nothing');
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', (select code from issued), pg_temp.hash('cage-2-token')),
  (select device_id from issued), 'the cashier claims the code on the new computer');
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', (select code from issued), pg_temp.hash('another-token')), null::uuid,
  'a code is claimed once');
select throws_ok($$ select public.claim_computer('00000000-0000-4000-8000-000000000001', '111111', null) from generate_series(1, 4) $$,
  'RVMAX', null, 'five wrong codes stop the cashier for ten minutes');

reset role;
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 3', 'abc') $$,
  '23514', null, 'a token is stored only as its SHA-256 hash');
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                   values ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet', repeat('b', 64)) $$,
  '23514', null, 'and only for a cage or admin computer');

select * from finish();
rollback;
