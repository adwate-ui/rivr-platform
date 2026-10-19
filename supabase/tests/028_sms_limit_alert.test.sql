-- The alert when sign-in codes are refused for the project's hourly limit (#182): one for the club,
-- at most every 15 minutes, raised only with the service role.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.alert where kind = 'auth.sms_rate_limit';
set local role service_role;
select public.raise_sms_limit_alert();
select public.raise_sms_limit_alert();
reset role;
select results_eq($$ select venue_id::text, kind from public.alert where kind = 'auth.sms_rate_limit' $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::text, 'auth.sms_rate_limit'::text) $$,
  'one alert for the club, however often it is asked within 15 minutes');

update public.alert set raised_at = now() - interval '16 minutes' where kind = 'auth.sms_rate_limit';
set local role service_role;
select public.raise_sms_limit_alert();
reset role;
select is((select count(*)::integer from public.alert where kind = 'auth.sms_rate_limit'), 2, 'and another once 15 minutes have passed');

set local role authenticated;
select throws_ok($$ select public.raise_sms_limit_alert() $$, '42501', null, 'a signed-in person cannot raise it');
set local role anon;
select throws_ok($$ select public.raise_sms_limit_alert() $$, '42501', null, 'nor can someone signed out, except through the function');
reset role;

select * from finish();
rollback;
