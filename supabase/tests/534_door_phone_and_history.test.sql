-- The Door's phone number and History (#1073, the owner, 18 Nov): floor, admin and super admin see a member's mobile on
-- the Door; hosts and cashiers do not. History reads a member's hours since their last reset. 103 Aditya is an admin, 108
-- Karan a host, 104 a cashier made a floor manager here for the floor's case. 211 Ishaan plays.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Ishaan at the door today: checked in an hour ago.
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
with opened as (
  insert into public.visit (venue_id, member_id, opened_at)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '1 hour') returning id)
-- Forty minutes at Table 3, over ten minutes ago.
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', opened.id, t.id, 1,
       now() - interval '50 minutes', now() - interval '50 minutes', now() - interval '10 minutes', 'left', 0, 0
from opened join public.game_table t on t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 3';
create temp table his on commit drop as select m.phone from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
grant select on his to authenticated;

select ok(exists (select 1 from public.role_permission where role = 'floor' and permission = 'members.phone')
          and exists (select 1 from public.role_permission where role = 'admin' and permission = 'members.phone')
          and not exists (select 1 from public.role_permission where role in ('host', 'cashier') and permission = 'members.phone'),
  'floor and admin hold members.phone; hosts and cashiers do not');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select phone from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000211'), (select phone from his), 'an admin sees the mobile on the Door');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select phone is null from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000211'), true, 'a host sees the row without the mobile');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select phone is null from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000211'), true, 'and so does a cashier');
reset role;
update public.staff set role = 'floor' where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select phone from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000211'), (select phone from his), 'a floor manager does');

-- History: hours since the last reset, by the Members list's own Played expression.
reset role;
create temp table expected (minutes bigint) on commit drop;
do $$ begin
  execute format('insert into expected select (%s)::bigint from public.member m where m.id = %L',
                 private.members_column_sql('played'), '00000000-0000-4000-8000-000000000211');
end $$;
grant select on expected to authenticated;
select ok((select minutes from expected) > 0, 'Ishaan has time played to read');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is(public.member_hours_played('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211'), (select minutes from expected),
  'History reads hours played since the last reset, as the Members list does');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.member_hours_played((select id from public.venue where is_practice limit 1), '00000000-0000-4000-8000-000000000211'), null,
  'nothing for a member of another venue, even to a super admin of both');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is(public.member_hours_played('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211'), null,
  'and nothing for a member, who reads no members');
reset role;

select * from finish();
rollback;
