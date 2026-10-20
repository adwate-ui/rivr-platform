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

update public.venue_config set staff_ip_allowlist = '{203.0.113.0/24}' where venue_id = '00000000-0000-4000-8000-000000000001';
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

-- Policies hold the rule too: a device manager at a computer not enrolled enrols nothing.
set local role authenticated;
select throws_ok($$ insert into public.device (venue_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2') $$,
  '42501', null, 'a device manager at a computer not enrolled enrols nothing');
select pg_temp.at('00000000-0000-4000-8000-000000000101', '203.0.113.9', 'office-token');
select results_eq($$ select kind::text, name, is_enforced, is_on_staff_network from public.this_computer('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('console'::text, 'Office'::text, true, true) $$, 'this computer: the office''s admin console');
select lives_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                   values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2', repeat('a', 64)) $$, 'from the admin console, enrols the second cage');
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash) values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 3', 'abc') $$,
  '23514', null, 'a token is stored only as its SHA-256 hash');
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                   values ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet', repeat('b', 64)) $$,
  '23514', null, 'and only for a cage or admin computer');
select pg_temp.at('00000000-0000-4000-8000-000000000106', '203.0.113.9', 'office-token');
select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                   values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 4', repeat('c', 64)) $$,
  '42501', null, 'a dealer enrols no computer, even at the admin console');
reset role;

-- A revoked computer stops at once.
update public.device set revoked_at = now(), revoked_reason = 'Stolen' where id = '00000000-0000-4000-8000-0000000c3841';
select pg_temp.at('00000000-0000-4000-8000-000000000104', '203.0.113.9', 'cage-token');
select ok(not pg_temp.may('cage.transact'), 'a revoked cage computer is refused at once');

-- The practice venue enforces nothing, even with networks.
update public.venue_config set staff_ip_allowlist = '{203.0.113.0/24}' where venue_id = '00000000-0000-4000-8000-000000000002';
select pg_temp.at('00000000-0000-4000-8000-000000000141', null, null);
select ok(pg_temp.may('cage.transact', '00000000-0000-4000-8000-000000000002'), 'at the practice venue, a cashier trains from any computer');

select * from finish();
rollback;
