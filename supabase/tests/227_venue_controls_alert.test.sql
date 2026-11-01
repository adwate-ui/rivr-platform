-- A change to the venue's controls alerts the owner (audit of 28 Oct, A4-12): a person's change to the venue's networks,
-- UPI or bank details or alert number raises venue.config_changed, naming the fields; a changed alert number's alert goes
-- to the number before. The system's changes raise nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.changes() returns bigint language sql security definer as $$
  select count(*) from public.alert where venue_id = '00000000-0000-4000-8000-000000000001' and kind = 'venue.config_changed';
$$;
grant execute on function pg_temp.changes() to authenticated;
create function pg_temp.last_change() returns table (id uuid, fields jsonb) language sql security definer as $$
  select a.id, a.detail -> 'fields' from public.alert a where a.venue_id = '00000000-0000-4000-8000-000000000001'
    and a.kind = 'venue.config_changed' order by a.raised_at desc, a.id desc limit 1;
$$;
grant execute on function pg_temp.last_change() to authenticated;

-- The seed and migrations change the configuration as the system: no alert.
update public.venue_config set upi_vpa = 'rivr.system@icici' where venue_id = '00000000-0000-4000-8000-000000000001';
select is(pg_temp.changes(), 0::bigint, 'a change the system makes raises nothing');

-- The owner, a super admin, through the API.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
update public.venue_config set upi_vpa = 'rivr.changed@icici', bank_ifsc = 'ICIC0000999' where venue_id = '00000000-0000-4000-8000-000000000001';
select is((select fields from pg_temp.last_change()), '["upi_vpa", "bank_ifsc"]'::jsonb,
  'a new UPI address and IFSC raise venue.config_changed, naming them');
update public.venue_config set invoice_prefix = 'RVX' where venue_id = '00000000-0000-4000-8000-000000000001';
select is(pg_temp.changes(), 1::bigint, 'a change to anything else raises nothing');
update public.venue_config set alert_whatsapp = '+919811100011' where venue_id = '00000000-0000-4000-8000-000000000001';
update public.venue_config set alert_whatsapp = '+919811100099' where venue_id = '00000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);
create temporary table number_alert on commit drop as
select a.id from public.alert a join private.alert_previous_number p on p.alert_id = a.id and p.alert_whatsapp = '+919811100011';
select results_eq($$ select alert_whatsapp from public.alert_recipient('00000000-0000-4000-8000-000000000001', (select id from number_alert)) $$,
  $$ values ('+919811100011'::text) $$, 'the alert of a changed alert number goes to the number before the change');
select results_eq($$ select alert_whatsapp from public.alert_recipient('00000000-0000-4000-8000-000000000001',
                    (select a.id from public.alert a where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.kind = 'venue.config_changed'
                     and a.detail -> 'fields' = '["upi_vpa", "bank_ifsc"]'::jsonb)) $$,
  $$ values ('+919811100099'::text) $$, 'and every other alert to the number now set');

-- Neither number is anyone's to read in the alert or its audit row: an investor (owner_view) reads alerts and the audit log.
select is((select count(*)::integer from public.alert where detail ? 'previous_whatsapp' or detail::text like '%919811100011%'), 0,
  'the alert holds no phone number');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000109", "role": "authenticated"}', true);
select is((select count(*)::integer from public.alert a where a.detail::text like '%919811100011%'), 0, 'an investor reads no number in the alerts');
select is((select count(*)::integer from public.audit_log l where l.after::text like '%919811100011%' or l.before::text like '%919811100011%'), 0,
  'nor in the audit log');
select throws_ok($$ select * from private.alert_previous_number $$, '42501', null, 'and reads nothing of the numbers kept apart');
reset role;

select * from finish();
rollback;
