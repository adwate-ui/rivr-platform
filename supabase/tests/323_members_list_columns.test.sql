-- More on the Members list (the owner, 8 Nov). Vikram (101, super admin) reads members' full numbers; Aditya (103, an
-- admin) reads only their last four digits. Both read each member's KYC status, total minutes played (every seat
-- session, as private.minutes_played counts it), city and member-since day.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A member with a started check is let in by their selfie (the desk checks them), and one says where they live.
create temporary table at_desk as
select k.member_id from public.kyc_record k join public.member m on m.id = k.member_id
where m.venue_id = '00000000-0000-4000-8000-000000000001' and k.status = 'started' order by m.member_number limit 1;
update public.kyc_record set at_club_from = now() where member_id = (select member_id from at_desk);
-- Member 211 played two closed sessions, of 90 and 45 minutes, and says they live in Gurugram.
create temporary table played (id uuid, minutes integer, seat integer);
insert into played values (gen_random_uuid(), 90, 4), (gen_random_uuid(), 45, 5);
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select p.id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       now() - make_interval(mins => p.minutes + 2), now() - interval '30 seconds', 'door'
from played p;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', p.id,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), p.seat,
       now() - make_interval(mins => p.minutes + 1), now() - make_interval(mins => p.minutes + 1), now() - interval '1 minute', 'left', 0
from played p;
insert into public.member_preference (member_id, venue_id, city)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Gurugram')
on conflict (member_id) do update set city = excluded.city;
-- What each club member has played, counted here as the list should count it.
create temporary table expected as
select m.id, m.phone, m.created_at, k.status as kyc, k.at_club_from,
       coalesce((select sum(private.minutes_played(s, now())) from public.seat_session s where s.member_id = m.id and s.venue_id = m.venue_id), 0)::bigint as minutes
from public.member m left join public.kyc_record k on k.member_id = m.id
where m.venue_id = '00000000-0000-4000-8000-000000000001';
grant select on at_desk, expected to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where l.phone is distinct from e.phone $$, 'a super admin reads each full number');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') where phone is not null $$,
  'an admin reads no full number');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where l.phone_last4 is distinct from right(e.phone, 4) $$, 'but each number''s last four digits');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where l.minutes_played <> e.minutes $$, 'each member''s total minutes played, over every seat session');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where l.member_since <> e.created_at $$, 'and the day they joined');
select is((select kyc_status from public.members_of_tier('00000000-0000-4000-8000-000000000001') where member_id = (select member_id from at_desk)),
  'at_desk', 'a member let in by their selfie waits for the desk''s check');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where e.kyc = 'verified' and l.kyc_status <> 'verified' $$, 'a verified member reads verified');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') l join expected e on e.id = l.member_id
                   where (e.kyc is null or e.kyc = 'needs_pan') and l.kyc_status <> 'not_done' $$, 'no check, or one unfinished, is not done');
select results_eq($$ select minutes_played, city from public.members_of_tier('00000000-0000-4000-8000-000000000001')
                     where member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values (135::bigint, 'Gurugram'::text) $$, 'member 211: 90 and 45 minutes played, 135 in all, and the city they gave');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001') $$, 'a dealer, who reads no members, lists none');
reset role;

select * from finish();
rollback;
