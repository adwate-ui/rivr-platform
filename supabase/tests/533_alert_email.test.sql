-- Alerts by email too (#1066, the owner, 17 Nov): a super admin (101 Vikram) turns email alerts on with up to five
-- addresses; a change raises the settings alert; the alert-email consumer finds the addresses for an alert raised within
-- the day, never while off, never for the practice venue; investors' Activity leaves the addresses out.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- What the super admin may set.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ update public.venue_config set alert_email_on = true where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'email alerts on need an address');
select throws_ok($$ update public.venue_config set alert_emails = array['a@x.in', 'b@x.in', 'c@x.in', 'd@x.in', 'e@x.in', 'f@x.in']
                    where venue_id = '00000000-0000-4000-8000-000000000001' $$, '23514', null, 'five addresses at most');
select throws_ok($$ update public.venue_config set alert_emails = array['not an address'] where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'each one an address');
select throws_ok($$ update public.venue_config set alert_emails = array[E'a@x.in\nb@x.in\nc@x.in\nd@x.in\ne@x.in\nf@x.in']
                    where venue_id = '00000000-0000-4000-8000-000000000001' $$, '23514', null, 'each its own entry, so five stay five');
select throws_ok($$ update public.venue_config set alert_emails = array['a@x.in', null] where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'and none empty');
select lives_ok($$ update public.venue_config set alert_email_on = true, alert_emails = array['owner@rivr.example', 'gm@rivr.example']
                   where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'the super admin turns email alerts on with two addresses');
select results_eq($$ select alert_email_on, alert_emails from public.venue_config_detail where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values (true, array['owner@rivr.example', 'gm@rivr.example']) $$, 'and reads them back in Settings');
reset role;

-- The change raises the usual settings alert, naming both fields.
select is((select a.detail -> 'fields' from public.alert a where a.kind = 'venue.config_changed' and a.venue_id = '00000000-0000-4000-8000-000000000001'
           order by a.raised_at desc limit 1), '["alert_email_on", "alert_emails"]'::jsonb, 'changing them raises the settings alert');

-- The consumer's addresses: for an alert raised within the day, and none for an older one.
insert into public.alert (id, venue_id, kind, detail, raised_at) values
  ('00000000-0000-4000-8000-0000000533a1', '00000000-0000-4000-8000-000000000001', 'eod.variance', '{}', now()),
  ('00000000-0000-4000-8000-0000000533a2', '00000000-0000-4000-8000-000000000001', 'eod.variance', '{}', now() - interval '2 days');
set local role service_role;
select results_eq($$ select alert_emails from public.alert_email_recipients('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000533a1') $$,
  $$ values (array['owner@rivr.example', 'gm@rivr.example']) $$, 'the consumer finds the addresses for an alert raised today');
select is_empty($$ select * from public.alert_email_recipients('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000533a2') $$,
  'and none for an alert raised two days ago');
reset role;

-- Off, it finds none; nor does the practice venue ever.
update public.venue_config set alert_email_on = false where venue_id = '00000000-0000-4000-8000-000000000001';
create temp table practice on commit drop as select id from public.venue where is_practice limit 1;
grant select on practice to service_role;
update public.venue_config set alert_email_on = true, alert_emails = array['practice@rivr.example'] where venue_id = (select id from practice);
insert into public.alert (id, venue_id, kind, detail, raised_at)
select '00000000-0000-4000-8000-0000000533a3', id, 'eod.variance', '{}', now() from practice;
set local role service_role;
select is_empty($$ select * from public.alert_email_recipients('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000533a1') $$,
  'with email alerts off, the consumer finds none');
select is_empty($$ select * from public.alert_email_recipients((select id from practice), '00000000-0000-4000-8000-0000000533a3') $$,
  'and never for the practice venue');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.alert_email_recipients('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000533a1') $$,
  '42501', null, 'a person never calls it');
reset role;

-- Investors' Activity leaves the addresses out.
select ok(private.is_shareable_audit_row('setting', null, '{"key": "bonus.expiry_days"}'::jsonb)
          and not private.is_shareable_audit_row('setting', null, jsonb_build_object('alert_emails', array['owner@rivr.example'])),
  'the addresses are personal data');

select * from finish();
rollback;
