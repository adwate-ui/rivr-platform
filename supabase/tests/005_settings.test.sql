-- Effective-dated settings: the rule in force at a moment, schema-checked values, no backdating.
-- 103 Aditya (admin, settings.manage), 104 Sana (cashier).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed gives the Private Room three hours from the beginning of time; change it to 90 minutes from tomorrow.
insert into public.setting (venue_id, key, subject, value, effective_from)
values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'private_room', '{"minutes": 90}', now() + interval '1 day');

select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'private_room', now()),
  '{"minutes": 180}'::jsonb, 'today the rule in force is the old one');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'private_room', now() + interval '2 days'),
  '{"minutes": 90}'::jsonb, 'from tomorrow the new rule applies');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'table_5', now()),
  null, 'a table type with no rule has none');

select throws_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'private_room', '{"minutes": "two hours"}', now() + interval '3 days') $$,
  '23514', null, 'a value that does not match its schema is refused'
);
select throws_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'tier.default', 'private_room', '{"tier_id": "00000000-0000-4000-8000-000000000001"}', now()) $$,
  '23514', null, 'a venue-wide setting takes no subject'
);
select throws_ok($$ update public.setting set value = '{"minutes": 1}' $$, '42501', null, 'settings are never edited');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'private_room', '{"minutes": 60}', now() - interval '1 hour') $$,
  '23514', null, 'nobody signed in can backdate a rule'
);
select lives_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'table_1', '{"minutes": 60}', now() + interval '1 hour') $$,
  'an admin schedules a rule'
);
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'table_2', '{"minutes": 60}', now() + interval '1 hour') $$,
  '42501', null, 'a cashier cannot change rules'
);
reset role;

-- New members start in the venue's default tier.
insert into public.member (venue_id, full_name, phone)
values ('00000000-0000-4000-8000-000000000001', 'New Member', '+919000000777');
select is(
  (select t.name from public.member m join public.tier t on t.id = m.tier_id where m.phone = '+919000000777'),
  'Member', 'a new member starts in the default tier'
);
select is(
  (select count(*) from public.ledger_account a join public.member m on m.id = a.member_id where m.phone = '+919000000777')::int,
  4, 'a new member gets cash, bonus, points and receivable accounts'
);

select * from finish();
rollback;
