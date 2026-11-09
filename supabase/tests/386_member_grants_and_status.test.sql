-- A member's promotions and account status on the Members screen (8 Nov audit, I-73, I-74). 103 Aditya reads members, 106 Pema
-- is a dealer and does not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- I-73: as many as are asked for, not a silent 200.
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-000000000b91', '00000000-0000-4000-8000-000000000001', 'Regular Ravi', '+919000000851'),
  ('00000000-0000-4000-8000-000000000b92', '00000000-0000-4000-8000-000000000001', 'Frozen Farah', '+919000000852'),
  ('00000000-0000-4000-8000-000000000b93', '00000000-0000-4000-8000-000000000001', 'Break Bina', '+919000000853'),
  ('00000000-0000-4000-8000-000000000b94', '00000000-0000-4000-8000-000000000001', 'Past Break Pia', '+919000000854'),
  ('00000000-0000-4000-8000-000000000b95', '00000000-0000-4000-8000-000000000001', 'Both Bela', '+919000000855'),
  ('00000000-0000-4000-8000-000000000b96', '00000000-0000-4000-8000-000000000001', 'Active Asha', '+919000000856');

insert into public.promotion_grant (venue_id, member_id, promotion_id, promotion_rule_id, promotion_version_id, trigger, effect, cost_paise, points, source_key, club_day, created_at)
select g.venue_id, '00000000-0000-4000-8000-000000000b91', g.promotion_id, g.promotion_rule_id, g.promotion_version_id, g.trigger, g.effect, 0, 10, 'test:' || n, current_date - n, now() - make_interval(days => n)
from public.promotion_grant g, generate_series(1, 230) n
where g.id = (select id from public.promotion_grant where venue_id = '00000000-0000-4000-8000-000000000001' limit 1);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91')), 20, 'twenty at first');
select is((select count(*)::integer from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91', 220)), 220, 'more when asked, past the old 200');
select is((select count(*)::integer from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91', 5000)), 230, 'and all of them, for a nightly regular');
reset role;
select ok(not has_function_privilege('anon', 'public.member_promotion_grants(uuid, integer)', 'execute'), 'nobody signed out reads them');

-- I-74.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', m, 'Test', (select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Aditya Malhotra')
from unnest(array['00000000-0000-4000-8000-000000000b92', '00000000-0000-4000-8000-000000000b95']::uuid[]) m;
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b93', now() - interval '1 day', now() + interval '30 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b94', now() - interval '40 days', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000b95', now() - interval '1 day', now() + interval '30 days');
update public.member set erased_at = now(), full_name = 'Erased member', phone = null, user_id = null where id = '00000000-0000-4000-8000-000000000b91';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select member_id::text, status, until is not null from public.member_account_statuses('00000000-0000-4000-8000-000000000001') where member_id::text like '00000000-0000-4000-8000-000000000b9_' order by 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000b91'::text, 'erased'::text, false),
            ('00000000-0000-4000-8000-000000000b93', 'on_break', true),
            ('00000000-0000-4000-8000-000000000b95', 'on_break', true) $$,
  'staff who do not engage controls see no freeze: a frozen member is as they otherwise stand (#493 P5); none for a break that ended or an active member');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select member_id::text, status, until is not null from public.member_account_statuses('00000000-0000-4000-8000-000000000001') where member_id::text like '00000000-0000-4000-8000-000000000b9_' order by 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000b91'::text, 'erased'::text, false),
            ('00000000-0000-4000-8000-000000000b92', 'frozen', false),
            ('00000000-0000-4000-8000-000000000b93', 'on_break', true),
            ('00000000-0000-4000-8000-000000000b95', 'frozen', false) $$,
  'a super admin sees the freeze, frozen first for one who is both');

reset role;
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211', 'Practice Admin', 'Admin', 'admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select 1 from public.member_account_statuses('00000000-0000-4000-8000-000000000001') $$, 'An investor reads no statuses');
select is_empty($$ select 1 from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91') $$, 'An investor reads no promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select 1 from public.member_account_statuses('00000000-0000-4000-8000-000000000001') $$, 'Marketing reads no statuses');
select is_empty($$ select 1 from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91') $$, 'Marketing reads no promotions');
select pg_temp.as_person('00000000-0000-4000-8000-0000000d0790');
select is_empty($$ select 1 from public.member_account_statuses('00000000-0000-4000-8000-000000000001') $$, 'The service staff reads no statuses');
select is_empty($$ select 1 from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91') $$, 'The service staff reads no promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.member_account_statuses('00000000-0000-4000-8000-000000000001') $$, 'Another venue''s admin reads no statuses');
select is_empty($$ select 1 from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91') $$, 'Another venue''s admin reads no promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.member_promotion_grants('00000000-0000-4000-8000-000000000b91') $$, 'Another member reads no promotions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_account_statuses('00000000-0000-4000-8000-000000000001') $$, 'a dealer reads none');
reset role;
select ok(not has_function_privilege('anon', 'public.member_account_statuses(uuid)', 'execute'), 'nor anybody signed out');

select * from finish();
rollback;
