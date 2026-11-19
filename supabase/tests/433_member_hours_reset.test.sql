-- One member's counted hours reset (redesign RD-36): a super admin resets them with a reason; from then they count from
-- zero on the hours leaderboard, for a play-time Bonus and in the Members list's total; past visits stay on the record;
-- a step already paid is neither taken back nor paid again. 101 Vikram is a super admin, 103 Aditya an admin (the seed);
-- 211 Ishaan and 212 Vihaan play.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor and its promotions are set aside, so this test seats its own players and runs its own promotion.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;
update public.visit set closed_at = now(), close_reason = 'door' where closed_at is null;
update public.promotion_version set status = 'ended' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
-- A member's minutes on tonight's leaderboard, and in the Members list (as a super admin reads it).
create function pg_temp.board_minutes(p_member_id uuid) returns integer language sql as $$
  select coalesce((select l.played_minutes from private.hours_leaderboard('00000000-0000-4000-8000-000000000001', 'all', 1000, null, now()) l
                   where l.member_id = p_member_id), 0);
$$;
-- A play-time Bonus given tonight, waiting for a super admin or approved (decision 0670).
create function pg_temp.bonus(p_member_id uuid) returns bigint language sql as $$
  select coalesce(sum(g.cost_paise), 0)::bigint from public.promotion_grant g
  where g.member_id = p_member_id and g.status <> 'refused' and g.created_at >= now();
$$;

-- Ishaan sat three hours yesterday (a closed visit), and has sat two hours tonight, at Table 3; Vihaan two hours tonight.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000433a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '28 hours', now() - interval '24 hours', 'door'),
  ('00000000-0000-4000-8000-0000000433a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '130 minutes', null, null),
  ('00000000-0000-4000-8000-0000000433a3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '130 minutes', null, null);
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes) values
  ('00000000-0000-4000-8000-0000000433b1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-0000000433a1',
   pg_temp.t('Table 3'), 1, now() - interval '27 hours', now() - interval '27 hours', now() - interval '24 hours', 'left', 0),
  ('00000000-0000-4000-8000-0000000433b2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-0000000433a2',
   pg_temp.t('Table 3'), 1, now() - interval '120 minutes', now() - interval '120 minutes', null, null, 0),
  ('00000000-0000-4000-8000-0000000433b3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-0000000433a3',
   pg_temp.t('Table 3'), 2, now() - interval '120 minutes', now() - interval '120 minutes', null, null, 0);

select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000211'), 300, 'before a reset every hour counts: five hours over two nights');
select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000212'), 120, 'and two for the other player');

-- Who may reset, and with what.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.reset_member_hours('00000000-0000-4000-8000-000000000211', 'A new season', gen_random_uuid()) $$, '42501', null, 'an admin does not reset hours');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.reset_member_hours('00000000-0000-4000-8000-000000000211', 'A new season', gen_random_uuid()) $$, '42501', null, 'nor a member their own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reset_member_hours('00000000-0000-4000-8000-000000000211', ' x ', gen_random_uuid()) $$, '22023', null, 'a super admin gives a reason');
select throws_ok($$ select public.reset_member_hours('00000000-0000-4000-8000-000000000211', 'A new season', null) $$, '22023', null, 'and a request id');
select throws_ok($$ select public.reset_member_hours(gen_random_uuid(), 'A new season', gen_random_uuid()) $$, '42501', null, 'and resets a member who is there');
-- Never their own: a super admin who is also a member, by the same mobile number (the security review of the pull request).
reset role;
update public.member set phone = (select s.phone from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where id = '00000000-0000-4000-8000-000000000213';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reset_member_hours('00000000-0000-4000-8000-000000000213', 'A new season', gen_random_uuid()) $$, 'RVOWN', null, 'a super admin never resets the hours of their own record');
select is((select hours_counted_from from public.member where id = '00000000-0000-4000-8000-000000000213'), null, 'and nothing changed');
reset role;
select is((select hours_counted_from from public.member where id = '00000000-0000-4000-8000-000000000211'), null, 'none of those reset anything');

-- A play-time Bonus live tonight: 500 after one hour, 1,000 after three, at set times. Ishaan's first step is reached.
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Hours 433') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Hours 433',
       '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text, 'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.name = 'Hours 433';

-- The reset, by a super admin: the step reached is paid first, then the count starts again.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.reset_member_hours('00000000-0000-4000-8000-000000000211', '  A new season  ', '00000000-0000-4000-8000-0000000433c1'), null, 'a super admin resets Ishaan''s hours');
reset role;
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000211'), 50000::bigint, 'the step he had reached, 500 after an hour, is paid as the hours are reset');
select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000211'), 0, 'his hours on the leaderboard start from zero');
select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000212'), 120, 'the other player''s are untouched');
select results_eq($$ select action, reason, (select s.full_name from public.staff s where s.user_id = a.actor_user_id and s.venue_id = a.venue_id)
                     from public.audit_log a where a.action = 'member.hours_reset' and a.entity_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('member.hours_reset'::text, 'A new season'::text, 'Vikram Rao'::text) $$, 'the audit log says who reset them and why');
-- The same request again, as a double submit or a retry after a lost reply sends it: answered, and nothing written twice.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.reset_member_hours('00000000-0000-4000-8000-000000000211', '  A new season  ', '00000000-0000-4000-8000-0000000433c1'), null, 'the same request again is answered');
reset role;
select is((select count(*)::integer from public.audit_log a where a.action = 'member.hours_reset' and a.entity_id = '00000000-0000-4000-8000-000000000211'), 1,
  'and writes no second line to the Activity');

-- Past visits stay on the record, by date, with their time.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select minutes_played from public.member_visits('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') order by opened_at $$,
  $$ values (180), (120) $$, 'his visits stay on his record with the time played at each');
select is((select minutes_played from public.members_of_tier('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000211'),
  0::bigint, 'but the Members list''s total starts from zero');
select is((select minutes_played from public.members_of_tier('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000212'),
  120::bigint, 'and the other player''s is whole');
reset role;

-- Time goes on: the reset was 90 minutes ago, so 90 minutes count, of a visit now three and a half hours long.
update public.member set hours_counted_from = now() - interval '90 minutes' where id = '00000000-0000-4000-8000-000000000211';
update public.seat_session set started_at = now() - interval '210 minutes', seated_here_at = now() - interval '210 minutes' where id = '00000000-0000-4000-8000-0000000433b2';
update public.visit set opened_at = now() - interval '220 minutes' where id = '00000000-0000-4000-8000-0000000433a2';
select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000211'), 90, 'ninety minutes after the reset, ninety minutes count');
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000433a2', now());
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000211'), 50000::bigint,
  'the first step, reached again after the reset, is not paid again; nor the second, for the hours before the reset no longer count towards it');

-- The visit closes four hours after the reset: the second step is reached on the new count and paid once.
update public.member set hours_counted_from = now() - interval '240 minutes' where id = '00000000-0000-4000-8000-000000000211';
update public.seat_session set started_at = now() - interval '300 minutes', seated_here_at = now() - interval '300 minutes' where id = '00000000-0000-4000-8000-0000000433b2';
update public.visit set opened_at = now() - interval '310 minutes' where id = '00000000-0000-4000-8000-0000000433a2';
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000433a2', now());
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000211'), 150000::bigint, 'three hours on the new count reach the second step: 1,000 more, and the first is still paid once');

-- A second reset moves the moment; the Bonus paid stays paid.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.reset_member_hours('00000000-0000-4000-8000-000000000211', 'Reset by mistake, again', gen_random_uuid()), null, 'hours can be reset again');
reset role;
select is(pg_temp.board_minutes('00000000-0000-4000-8000-000000000211'), 0, 'and start from zero again');
select is(pg_temp.bonus('00000000-0000-4000-8000-000000000211'), 150000::bigint, 'a play-time Bonus already paid is not taken back');
select is((select count(*)::integer from public.audit_log a where a.action = 'member.hours_reset' and a.entity_id = '00000000-0000-4000-8000-000000000211'), 2,
  'each reset is in the audit log');

-- The member's own export has the moment; no one signed out resets anything.
select ok(exists (select 1 from private.member_export_columns() c where c.table_name = 'member' and c.column_name = 'hours_counted_from'),
  'the moment is part of the member''s own data');
select is(has_function_privilege('anon', 'public.reset_member_hours(uuid, text, uuid)', 'execute'), false, 'no one signed out resets hours');
select is(has_function_privilege('authenticated', 'private.hours_counted_from(uuid)', 'execute'), false, 'and the moment is read through the rules, not on its own');

select * from finish();
rollback;
