-- Money settings (#499; question #494 items 1 and 2; decision 0213). Aditya (103, an admin) changes none of the payout
-- keys or GST. Kunal (134, a super admin) raises the second-approver threshold and the credit approval threshold: each
-- raise takes effect a day later. A cut takes effect as he sets it. The seed is not delayed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.in_force(p_key text) returns jsonb language sql as $$
  select value from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = p_key and subject = ''
  order by effective_from desc limit 1;
$$;
grant execute on function pg_temp.in_force(text) to authenticated;
create temp table current as
  select k.key, pg_temp.in_force(k.key) as value from unnest(array['gst.config', 'high_hand.payouts', 'jackpot.payout']) k(key);
grant select on current to authenticated;

-- An admin changes none of them.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok(format($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                            values ('00000000-0000-4000-8000-000000000001', %L, '', (select value from current where key = %L), now(), 'Adjusted') $$, k, k),
                 '42501', null, format('an admin does not change %s', k))
from unnest(array['gst.config', 'high_hand.payouts', 'jackpot.payout']) k;

-- A super admin's raise waits a day; a cut does not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.second_approver_threshold', '', '{"threshold_paise": 20000000}', now(), 'Busy weekend');
select ok((select effective_from from public.setting where key = 'cage.second_approver_threshold' and value ->> 'threshold_paise' = '20000000')
          >= now() + interval '24 hours', 'a raise of the second-approver threshold takes effect a day later');
select ok(exists (select 1 from public.alert where kind = 'settings.control_changed' and detail ->> 'key' = 'cage.second_approver_threshold'),
  'and the owner hears of it before it lands');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.second_approver_threshold', '', '{"threshold_paise": 5000000}', now(), 'Tighter');
select is((select effective_from from public.setting where key = 'cage.second_approver_threshold' and value ->> 'threshold_paise' = '5000000'),
          now(), 'a cut takes effect as set');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'credit.config', '',
        '{"approval_threshold_paise": 20000000, "minimum_visits": 3, "exposure_cap_paise": 250000000}', now(), 'Higher approvals');
select ok((select effective_from from public.setting where key = 'credit.config' and value ->> 'approval_threshold_paise' = '20000000')
          >= now() + interval '24 hours', 'a raise of the credit approval threshold takes effect a day later');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'credit.config', '',
        '{"approval_threshold_paise": 10000000, "minimum_visits": 5, "exposure_cap_paise": 250000000}', now(), 'More visits');
select is((select effective_from from public.setting where key = 'credit.config' and (value ->> 'minimum_visits') = '5'),
          now(), 'a credit change that does not raise the threshold takes effect as set');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'gst.config', '', (select value from current where key = 'gst.config'), now(), 'Confirmed') $$,
  'a super admin changes GST, with a reason');
select ok(exists (select 1 from public.alert where kind = 'settings.control_changed' and detail ->> 'key' = 'gst.config'), 'and the owner hears');

-- The seed and migrations, with no one signed in, are not delayed.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'cage.second_approver_threshold', '', '{"threshold_paise": 30000000}', now() + interval '1 hour', 'Seed');
select is((select effective_from from public.setting where key = 'cage.second_approver_threshold' and value ->> 'threshold_paise' = '30000000'),
          now() + interval '1 hour', 'the seed sets a raise as written');

select * from finish();
rollback;
