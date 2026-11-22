-- A seated member sees the others at their table (the owner, 22 Nov): each one's seat, first name and call time, until when
-- once set, else not set, away or done. Never anyone at another table, nor a full name or number; no name for one who keeps
-- it off the TVs; nothing for a member who does not see call time. Ishaan (211), Vihaan (212), Mihir (213) and Yash (214)
-- sit at Table 5, Ritika (215) at Table 3; 103 Aditya is a floor manager.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create function pg_temp.seated(p_member text) returns uuid language sql as $$
  select id from public.seat_session where member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and ended_at is null;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text), pg_temp.seated(text) to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'call_time.view', true, 'test 599'),
       ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'call_time.view', false, 'test 599');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.t('Table 5'), 2, '9000000211', p_call_minutes => 180);
select public.seat_member(pg_temp.t('Table 5'), 3, '9000000212', p_call_minutes => 180);
select public.seat_member(pg_temp.t('Table 5'), 4, '9000000213', p_call_minutes => 180);
select public.seat_member(pg_temp.t('Table 5'), 5, '9000000214', p_call_minutes => 0);
select public.seat_member(pg_temp.t('Table 3'), 1, '9000000215', p_call_minutes => 180);
-- The floor sets Vihaan's to four hours from now and Mihir's to two; Mihir steps away.
select public.add_seat_call_time(pg_temp.seated('212'), now() + interval '4 hours', gen_random_uuid());
select public.add_seat_call_time(pg_temp.seated('213'), now() + interval '200 minutes', gen_random_uuid());
reset role;
update public.seat_session set away_since = now() where id = pg_temp.seated('213');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select seat, first_name, call_time, ends_at from public.my_tablemates() $$,
  $$ values (3, 'Vihaan'::text, 'until'::text, now() + interval '4 hours'), (4, 'Mihir', 'away', null::timestamptz), (5, 'Yash', 'not_set', null) $$,
  'Ishaan sees the others at his table: seat, first name, and until when once set, else away or not set');
select ok(not exists (select 1 from public.my_tablemates() where first_name like '% %' or seat = 2), 'never a full name, nor himself');
select is_empty($$ select 1 from public.my_tablemates() where first_name = 'Ritika' $$, 'nor anyone at another table');

-- Back at the table and played past it: done. A hidden name stays hidden.
reset role;
update public.seat_session set away_since = null, started_at = now() - interval '201 minutes' where id = pg_temp.seated('213');
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000001', false)
on conflict (member_id) do update set name_on_tvs = false;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select call_time from public.my_tablemates() where seat = 4), 'done', 'a call time run out is done');
select is((select first_name from public.my_tablemates() where seat = 3), null, 'a member who keeps their name off the TVs is only their seat');

-- Nothing for a member who does not see call time, or who is not seated.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is_empty($$ select * from public.my_tablemates() $$, 'a member without call time sees no one''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.my_tablemates() $$, 'a member not seated sees no one');
reset role;

select * from finish();
rollback;
