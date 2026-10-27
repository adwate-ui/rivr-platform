-- AML alerts, audit rows and settings are for staff who review AML (#492, decision 0237; questions #484 and #493 P8).
-- Priya (109, an investor with owner_view) sees the club's other alerts, audit rows, outbox events and settings, but
-- nothing about AML: not on the owner dashboard, in the alerts, the audit log (the alert's own row, the register's,
-- an AML setting's), the outbox or the settings. Sana (104, a cashier) does not read the AML settings. Kunal (134, a
-- super admin) sees them all.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- With no one signed in, as the seed and migrations write: two AML alerts and one other, AML audit rows and one other,
-- and the structuring rule.
select private.raise_alert('00000000-0000-4000-8000-000000000001', 'aml.structuring', '{"kind": "structuring_visit"}');
select private.raise_alert('00000000-0000-4000-8000-000000000001', 'aml.settings_changed', '{"key": "aml.structuring"}');
select private.raise_alert('00000000-0000-4000-8000-000000000001', 'outbox.failures', '{}');
select private.audit('00000000-0000-4000-8000-000000000001', 'aml.flag', 'sar_entry', gen_random_uuid()::text, null, '{"kind": "structuring_visit"}');
select private.audit('00000000-0000-4000-8000-000000000001', 'insert', 'sar_entry_transaction', gen_random_uuid()::text, null, '{}');
select private.audit('00000000-0000-4000-8000-000000000001', 'test.other', 'game_table', gen_random_uuid()::text, null, '{}');
insert into public.setting (venue_id, key, subject, value, effective_from)
values ('00000000-0000-4000-8000-000000000001', 'aml.structuring', '', '{"count": 4, "window_days": 7, "margin_basis_points": 1000}', now() + interval '1 day');

-- The investor.
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select count(*)::integer from public.alert where kind like 'aml.%'), 0, 'an investor reads no AML alert');
select ok(exists (select 1 from public.alert where kind = 'outbox.failures'), 'but the club''s other alerts');
select ok(not exists (select 1 from jsonb_array_elements(public.owner_snapshot('00000000-0000-4000-8000-000000000001') -> 'alerts') a
                      where a ->> 'kind' like 'aml.%'), 'none on the owner dashboard either');
select ok(exists (select 1 from jsonb_array_elements(public.owner_snapshot('00000000-0000-4000-8000-000000000001') -> 'alerts') a
                  where a ->> 'kind' = 'outbox.failures'), 'where the others show');
select is((select count(*)::integer from public.audit_log
           where action like 'aml.%' or entity in ('sar_entry', 'sar_entry_transaction')), 0, 'no aml audit row, nor one about the register');
select is((select count(*)::integer from public.audit_log where entity = 'alert' and coalesce(after, before) ->> 'kind' like 'aml.%'), 0,
  'nor the audit row of an AML alert');
select is((select count(*)::integer from public.audit_log where entity = 'setting' and coalesce(after, before) ->> 'key' like 'aml.%'), 0,
  'nor of an AML setting');
select ok(exists (select 1 from public.audit_log where action = 'test.other'), 'but the other audit rows');
select ok(exists (select 1 from public.audit_log where entity = 'alert' and after ->> 'kind' = 'outbox.failures'), 'and the other alerts'' rows');
select is((select count(*)::integer from public.outbox_event where event_type = 'alert.raised' and payload ->> 'kind' like 'aml.%'), 0,
  'no outbox event raising an AML alert');
select is((select count(*)::integer from public.outbox_delivery d
           where d.event_id in (select e.id from public.outbox_event e where e.payload ->> 'kind' like 'aml.%')), 0, 'nor its deliveries');
select ok(exists (select 1 from public.outbox_event where event_type = 'alert.raised' and payload ->> 'kind' = 'outbox.failures'),
  'but the other alerts'' events');
select is((select count(*)::integer from public.setting where key like 'aml.%'), 0, 'and no AML setting');

-- A cashier does not read the AML settings either.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.setting where key like 'aml.%'), 0, 'a cashier reads no AML setting');

-- A super admin, who reviews AML.
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select is((select count(*)::integer from public.alert where kind like 'aml.%' and raised_at = now()), 2, 'a super admin reads the AML alerts');
select is((select count(*)::integer from jsonb_array_elements(public.owner_snapshot('00000000-0000-4000-8000-000000000001') -> 'alerts') a
           where a ->> 'kind' like 'aml.%'), 2, 'and sees them on the owner dashboard');
select is((select count(*)::integer from public.audit_log
           where (action like 'aml.%' or entity in ('sar_entry', 'sar_entry_transaction')) and created_at = now()), 2, 'and the AML audit rows');
select ok(exists (select 1 from public.audit_log where entity = 'alert' and after ->> 'kind' = 'aml.structuring'), 'and the AML alert''s row');
select is((select count(*)::integer from public.outbox_event where event_type = 'alert.raised' and payload ->> 'kind' like 'aml.%'
           and occurred_at = now()), 2, 'and the outbox events');
select ok(exists (select 1 from public.setting where key = 'aml.structuring'), 'and the AML settings');

select * from finish();
rollback;
