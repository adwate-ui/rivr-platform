-- Session history follows its tier switch (#504). Kunal (216) plays a session, leaves, then sits again tonight. With
-- sessions.history he reads all of it; with it off in his tier, only what is open now: tonight's visit and seat.
-- 103 Aditya is the floor manager.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.seen() returns table (visits integer, seats integer)
language sql as $$
  select (select count(*)::integer from public.visit), (select count(*)::integer from public.seat_session);
$$;
grant execute on function pg_temp.seen() to authenticated;

-- Kunal's past session: seated, let go early, his seat ended and his visit closed at the door.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'Kunal sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'History test'), null, 'he may leave early');
select public.end_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null), 'left');
select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216');
-- Tonight he sits again.
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits again tonight');
reset role;
create temp table kunal_had as
  select (select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000216') as visits,
         (select count(*)::integer from public.seat_session where member_id = '00000000-0000-4000-8000-000000000216') as seats;
grant select on kunal_had to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select visits, seats from pg_temp.seen() $$,
  $$ select visits, seats from kunal_had $$, 'with session history, Kunal reads all of his: past and tonight');
reset role;

-- His tier turns session history off.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select distinct m.venue_id, m.tier_id, 'sessions.history', false, 'locked'::public.feature_display_mode from public.member m
where m.id = '00000000-0000-4000-8000-000000000216';

select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select visits, seats from pg_temp.seen() $$, $$ values (1, 1) $$,
  'without it, only tonight''s visit and seat: no past visit or seat');
select is((select closed_at from public.visit), null, 'the visit he reads is tonight''s, still open');
reset role;

select * from finish();
rollback;
