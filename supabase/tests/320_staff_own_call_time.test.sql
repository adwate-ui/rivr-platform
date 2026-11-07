-- Staff who sign up as members (the owner, 8 Nov) never cut their own call time nor let themselves leave before it: the
-- same login is their staff and their member record. 103 Aditya, an admin with call_time.override, signs up, is checked,
-- and sits at Table 5; 101 Vikram, a super admin, still does both for him.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716), as 246's.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Aditya signs up on his own login, and the desk checks him.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids select 'aditya', public.sign_up('Aditya Malhotra', '{}');
reset role;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', id, 'verified', 'digilocker', '1990-01-01', 'ABCPA1033A',
       '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg', now() from ids where name = 'aditya';
select ok((select user_id = '00000000-0000-4000-8000-000000000103' from public.member where id = (select id from ids where name = 'aditya')),
  'his member record is on his staff login');

-- Seating himself with less than the stake's call time is cutting it: refused, and he is not seated.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 8,
                    p_member_number => (select member_number from public.member where id = (select id from ids where name = 'aditya')),
                    p_call_minutes => 0) $$, 'RVOWN', null, 'he seats himself with no call time: refused');
select lives_ok($$ select public.seat_member((select id from public.game_table where name = 'Table 5' and venue_id = '00000000-0000-4000-8000-000000000001'), 8,
                   p_member_number => (select member_number from public.member where id = (select id from ids where name = 'aditya'))) $$,
  'he seats himself with the stake''s own');
insert into ids select 'session', s.id from public.seat_session s where s.member_id = (select id from ids where name = 'aditya') and s.ended_at is null;
select throws_ok($$ select private.set_seat_call_time((select id from ids where name = 'session'), 0) $$, 'RVOWN', null,
  'nor cuts his own call time afterwards');
select lives_ok($$ select private.set_seat_call_time((select id from ids where name = 'session'), 1440) $$,
  'adding time to his own seat, up to a day, is no cut');
select throws_ok($$ select private.let_leave_early('00000000-0000-4000-8000-000000000001', (select id from ids where name = 'aditya'), 'Feeling unwell') $$,
  'RVOWN', null, 'nor lets himself leave before his call time');

-- Another member of staff does both for him.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select private.set_seat_call_time((select id from ids where name = 'session'), 0) $$, 'a super admin cuts his call time');
reset role;

select * from finish();
rollback;
