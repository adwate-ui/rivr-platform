-- Activity's Who and About carry the member's id (owner, 19 Nov: the console's names open the member's account), none
-- for staff or an erased member, and everything the page read before stays; the reads keep their grants.
-- 101 Vikram is a super admin at the club, 201 Arjun and 203 members there, 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Activity: a member acting on their own record, staff acting on a member, and a decision on several members.
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, after)
select '00000000-0000-4000-8000-000000000001', timestamptz '2020-03-01 21:00:00+05:30', m.user_id, 'update', 'member', m.id::text, '{}'::jsonb
from public.member m where m.id = '00000000-0000-4000-8000-000000000201';
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, after) values
  ('00000000-0000-4000-8000-000000000001', timestamptz '2020-03-01 21:01:00+05:30', '00000000-0000-4000-8000-000000000101', 'update', 'member',
   '00000000-0000-4000-8000-000000000203', '{}'),
  ('00000000-0000-4000-8000-000000000001', timestamptz '2020-03-01 21:02:00+05:30', '00000000-0000-4000-8000-000000000101', 'bonus.approve',
   'promotion_bonus_decision', 'd-several', '{"grants": 3, "chips": 1500}');

create function pg_temp.line(p_minute integer) returns table (who text, who_member_id uuid, about text, about_member_id uuid, is_total_at_least boolean)
language sql as $$
  select p.who, p.who_member_id, p.about, p.about_member_id, p.is_total_at_least
  from public.activity_page('00000000-0000-4000-8000-000000000001', date '2020-03-01', date '2020-03-01', null, null, 1, 50) p
  where p.occurred_at = timestamptz '2020-03-01 21:00:00+05:30' + make_interval(mins => p_minute);
$$;
grant execute on function pg_temp.line(integer) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select who_member_id from pg_temp.line(0)), '00000000-0000-4000-8000-000000000201'::uuid, 'a member who acted is named by their id');
select is((select about_member_id from pg_temp.line(0)), '00000000-0000-4000-8000-000000000201'::uuid, 'and so is the member it was about');
select is((select who_member_id from pg_temp.line(1)), null::uuid, 'staff who acted are not a member');
select is((select about_member_id from pg_temp.line(1)), '00000000-0000-4000-8000-000000000203'::uuid, 'the member staff acted on is named by their id');
select is((select about from pg_temp.line(2)), '3', 'a decision on several members still says how many');
select is((select about_member_id from pg_temp.line(2)), null::uuid, 'and names no member');
select is((select is_total_at_least from pg_temp.line(2)), false, 'the page still says whether its count stopped short');
reset role;

update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null, known_as = null
where id = '00000000-0000-4000-8000-000000000203';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select about_member_id from pg_temp.line(1)), null::uuid, 'an erased member is named by no id');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*) from pg_temp.line(0)), 0::bigint, 'a dealer still reads no line of Activity');
reset role;

-- The reads keep their grants: signed-in staff only.
select ok(not has_function_privilege('anon', 'public.activity_page(uuid, date, date, text, text, integer, integer)', 'execute'), 'anon cannot read Activity');
select ok(not has_function_privilege('anon', 'public.fnb_orders_page(uuid, jsonb)', 'execute'), 'anon cannot read the orders');
select ok(not has_function_privilege('anon', 'public.top_ups_tonight(uuid)', 'execute'), 'anon cannot read tonight''s top-ups');
select ok(not has_function_privilege('anon', 'public.top_up_history(uuid, date, integer, integer)', 'execute'), 'anon cannot read past top-ups');
select ok(has_function_privilege('authenticated', 'public.top_up_history(uuid, date, integer, integer)', 'execute'), 'staff can read past top-ups');
select ok(has_function_privilege('authenticated', 'public.fnb_orders_page(uuid, jsonb)', 'execute'), 'staff can read the orders');

select * from finish();
rollback;
