-- Cage and admin computers (#384, decision 0110): at a venue with cage and admin networks, the cage's money
-- permissions work only from an enrolled cage computer and the admin permissions only from an enrolled
-- admin console, each from an address on the networks; a revoked computer stops at once; with no
-- networks, and at the practice venue, nothing is enforced. 104 is a cashier, 101 the owner (super
-- admin), 103 Aditya an admin, 106 Pema a dealer, 141 Pooja a cashier at the practice venue.
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
grant execute on function pg_temp.at(text, text, text), pg_temp.may(text, text) to authenticated;

-- The club's cage computer and the office's admin console, as a device manager enrols them.
insert into public.device (id, venue_id, kind, name, token_hash) values
  ('00000000-0000-4000-8000-0000000c3841', '00000000-0000-4000-8000-000000000001', 'cage', 'Cage 1', pg_temp.hash('cage-token')),
  ('00000000-0000-4000-8000-0000000c3842', '00000000-0000-4000-8000-000000000001', 'console', 'Office', pg_temp.hash('office-token'));

select pg_temp.at('00000000-0000-4000-8000-000000000104', null, null);
select ok(pg_temp.may('cage.transact'), 'with no cage and admin networks, a cashier takes money from any computer');

-- Set as the SQL editor would (no one signed in), the way the owner can always clear them too.
select set_config('request.jwt.claims', '', true);
update public.venue_config set staff_ip_allowlist = '{203.0.113.0/24}' where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.at('00000000-0000-4000-8000-000000000104', null, null);
select ok(not pg_temp.may('cage.transact'), 'once the club has networks, a cashier at a computer not enrolled is refused');
select ok(pg_temp.may('members.read'), 'though what needs no computer still works');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'not-a-token');
select ok(not pg_temp.may('cage.transact'), 'a token nobody enrolled is refused');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'cage-token');
select ok(pg_temp.may('cage.transact'), 'at the enrolled cage computer on the club''s network, the cashier takes money');
select ok(pg_temp.may('withdrawals.approve') and pg_temp.may('markers.issue'), 'and approves withdrawals and issues markers');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '198.51.100.9', 'cage-token');
select ok(not pg_temp.may('cage.transact'), 'from an address outside the networks, the cage computer is refused');
select set_config('request.headers', '{"cf-connecting-ip": "198.51.100.9", "x-forwarded-for": "203.0.113.9", "x-rivr-computer": "cage-token"}', true);
select ok(not pg_temp.may('cage.transact'), 'and a forged X-Forwarded-For is not believed over Cloudflare''s address');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'office-token');
select ok(not pg_temp.may('cage.transact'), 'the admin console is not the cage');

select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
select ok(pg_temp.may('venue.configure') and pg_temp.may('settings.manage') and pg_temp.may('staff.manage') and pg_temp.may('devices.manage')
          and pg_temp.may('tiers.manage') and pg_temp.may('control.engage') and pg_temp.may('exports.full') and pg_temp.may('purge.run'),
  'the owner, at the enrolled admin console, uses every admin permission');
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'cage-token');
select ok(not pg_temp.may('venue.configure') and not pg_temp.may('devices.manage'), 'but not from the cage computer');
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', null);
select ok(not pg_temp.may('settings.manage'), 'nor from a computer not enrolled');
select results_eq($$ select kind::text, name, is_enforced, is_on_staff_network from public.this_computer('00000000-0000-4000-8000-000000000001') $$,
  $$ values (null::text, null::text, true, true) $$, 'this computer: not enrolled, at a venue that enforces, on its network');

-- Policies hold the rule too: a device manager at a computer not enrolled adds nothing.
set local role authenticated;
select throws_ok($$ select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2') $$,
  '42501', null, 'a device manager at a computer not enrolled adds no computer');
select throws_ok($$ insert into public.device (venue_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2') $$,
  '42501', null, 'nor any device');
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
select results_eq($$ select kind::text, name, is_enforced, is_on_staff_network from public.this_computer('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('console'::text, 'Office'::text, true, true) $$, 'this computer: the office''s admin console');
select ok(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'admin'), 'from it, the owner gives the admin role');
select pg_temp.at('00000000-0000-4000-8000-000000000103', '203.0.113.9', 'office-token');
select ok(private.can_grant_role('00000000-0000-4000-8000-000000000001', 'admin'),
  'and so does an admin, though the admin role holds cage permissions no admin console uses');

-- The admin console adds the second cage, with a code; staff claim it on that computer.
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
create temporary table issued as select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2');
select ok((select code ~ '^[0-9]{6}$' and expires_at > now() from issued), 'from the admin console, the owner adds the second cage and gets its code');
select pg_temp.at('00000000-0000-4000-8000-000000000106', '203.0.113.9', 'office-token');
select throws_ok($$ select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 3') $$,
  '42501', null, 'a dealer adds no computer, even at the admin console');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '198.51.100.9', null);
select throws_ok(format('select public.claim_computer(%L, %L, %L)', '00000000-0000-4000-8000-000000000001', (select code from issued), pg_temp.hash('cage-2-token')),
  '42501', null, 'off the club''s networks, the code is not claimed');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', null);
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', '000000', pg_temp.hash('cage-2-token')), null::uuid, 'a wrong code claims nothing');
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', (select code from issued), pg_temp.hash('cage-2-token')),
  (select device_id from issued), 'on the club''s network the cashier claims the code on the new computer');
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'cage-2-token');
select ok(pg_temp.may('cage.transact'), 'which is the cage from then on');
select is(public.claim_computer('00000000-0000-4000-8000-000000000001', (select code from issued), pg_temp.hash('another-token')), null::uuid,
  'a code is claimed once');
select throws_ok($$ select public.claim_computer('00000000-0000-4000-8000-000000000001', '111111', null) from generate_series(1, 4) $$,
  'RVMAX', null, 'five wrong codes stop the cashier for ten minutes');

-- Networks are saved only from an enrolled admin console on one of them.
select pg_temp.at('00000000-0000-4000-8000-000000000101', '198.51.100.9', 'office-token');
select is_empty($$ update public.venue_config set staff_ip_allowlist = '{198.51.100.0/24}' where venue_id = '00000000-0000-4000-8000-000000000001' returning venue_id $$,
  'off the networks, the owner changes none of the venue''s configuration');
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
select throws_ok($$ update public.venue_config set staff_ip_allowlist = '{198.51.100.0/24}' where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'RVNET', null, 'and on them, none that would leave the console outside them');
select lives_ok($$ update public.venue_config set staff_ip_allowlist = '{203.0.113.0/24, 192.0.2.0/24}' where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'networks the console stays on are saved');
reset role;
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 3', 'abc') $$,
  '23514', null, 'a token is stored only as its SHA-256 hash');
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                   values ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet', repeat('b', 64)) $$,
  '23514', null, 'and only for a cage or admin computer');

-- A revoked computer stops at once.
update public.device set revoked_at = now(), revoked_reason = 'Stolen' where id = '00000000-0000-4000-8000-0000000c3841';
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'cage-token');
select ok(not pg_temp.may('cage.transact'), 'a revoked cage computer is refused at once');

-- The practice venue enforces nothing, even with networks.
select set_config('request.jwt.claims', '', true);
update public.venue_config set staff_ip_allowlist = '{203.0.113.0/24}' where venue_id = '00000000-0000-4000-8000-000000000002';
select pg_temp.at('00000000-0000-4000-8000-000000000141', null, null);
select ok(pg_temp.may('cage.transact', '00000000-0000-4000-8000-000000000002'), 'at the practice venue, a cashier trains from any computer');

select * from finish();
rollback;
