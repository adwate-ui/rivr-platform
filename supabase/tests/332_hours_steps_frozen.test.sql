-- Play-time steps reached while promotions are stopped are never paid (the owner, 9 Nov). The seeded bonus pays 500 bonus
-- chips after two hours and 1,000 after four, once a visit. Promotions were stopped 15 minutes ago. Mihir (213) had played
-- 1 h 55 min then and has played 2 h 10 min now: the minute's sweep pays nothing and records his two-hour step as skipped.
-- Kunal (216) had played 2 h 5 min when they stopped: his two-hour step, reached before, is not skipped. Released, the
-- sweep pays Kunal his and never Mihir his, though a promotion that went live since pays its own two-hour step; at four
-- hours Mihir's second step, reached after the release, is paid. A promotion Mihir is not for records nothing. The
-- venue frozen and a member frozen skip steps the same way (Kavya, 290; Vihaan, 212). 103 (an admin who manages
-- promotions) reads the skipped steps; Mihir and another club's admin do not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table bonus as
select v.id as version_id, p.id as promotion_id from public.promotion p join public.promotion_version v on v.promotion_id = p.id
where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'hours_bonus';
update public.promotion_version set status = 'live', limits = '{"perMember": "per_visit"}',
  schedule = jsonb_set(schedule, '{startsOn}', to_jsonb(to_char(private.club_day_of(now()) - 1, 'YYYY-MM-DD'))),
  reward = '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 120, "chips": 500}, {"afterMinutes": 240, "chips": 1000}]}'
where id = (select version_id from bonus);
select private.sync_promotion((select promotion_id from bonus));

insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000b3321', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
        now() - interval '135 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000b3321', g.id, 9,
       now() - interval '130 minutes', now() - interval '130 minutes'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000b3322', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
        now() - interval '145 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000b3322', g.id, 9,
       now() - interval '140 minutes', now() - interval '140 minutes'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
grant select on bonus to authenticated;

create function pg_temp.paid(p_member uuid default '00000000-0000-4000-8000-000000000213') returns table (chips bigint) language sql as $$
  select g.chips from public.promotion_grant g where g.promotion_id = (select promotion_id from bonus)
    and g.member_id = p_member order by g.chips;
$$;

-- A one-step promotion at two hours, live from now on, for a tier Mihir is not in; another, for every tier, goes live later.
create temp table other_bonus (promotion_id uuid, tiers jsonb);
insert into other_bonus values
  (gen_random_uuid(), (select jsonb_build_array(t.id) from public.tier t
                       where t.venue_id = '00000000-0000-4000-8000-000000000001' and not t.is_retired
                         and t.id <> (select m.tier_id from public.member m where m.id = '00000000-0000-4000-8000-000000000213')
                       order by t.rank limit 1)),
  (gen_random_uuid(), '"all"');
insert into public.promotion (id, venue_id, name, status, starts_at)
select promotion_id, '00000000-0000-4000-8000-000000000001', 'Two-hour bonus ' || tiers::text, 'draft', now() - interval '1 day' from other_bonus;
create function pg_temp.go_live(p_tiers jsonb) returns void language sql as $$
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  select '00000000-0000-4000-8000-000000000001', o.promotion_id, 1, 'live', 'Two-hour bonus', '{"kind": "hours_bonus", "chips": 300, "afterMinutes": 120}',
         jsonb_set(v.eligibility, '{tiers}', p_tiers), v.schedule, '{"perMember": "per_visit"}', v.channels
  from other_bonus o, public.promotion_version v where o.tiers = p_tiers and v.id = (select version_id from bonus);
  select private.sync_promotion(o.promotion_id) from other_bonus o where o.tiers = p_tiers;
$$;
select pg_temp.go_live((select tiers from other_bonus where tiers <> '"all"'));

-- Promotions stopped (the kill switch's feature off) 15 minutes ago.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id, engaged_at)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'test 332', s.id, now() - interval '15 minutes'
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep while promotions are stopped');
select is_empty($$ select * from pg_temp.paid() $$, 'pays nothing');
select results_eq($$ select step_number from public.promotion_step_skip where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values (1) $$, 'and skips Mihir''s two-hour step, reached while stopped, for the bonus he is for alone');
select is_empty($$ select * from public.promotion_step_skip where member_id = '00000000-0000-4000-8000-000000000216' $$,
  'and not Kunal''s, reached before they stopped (money audit, 9 Nov)');
select lives_ok($$ select private.sweep_hours_bonus() $$, 'a second sweep while stopped');
select is((select count(*)::integer from public.promotion_step_skip where member_id = '00000000-0000-4000-8000-000000000213'), 1,
  'skips it once');

-- Released.
update public.control_state set released_at = now(), release_reason = 'test 332 over', released_by_staff_id = engaged_by_staff_id
where reason = 'test 332';
select pg_temp.go_live('"all"');
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep once released, with a second two-hour bonus live');
select is_empty($$ select * from pg_temp.paid() $$, 'never pays the step reached while stopped');
select is((select sum(g.chips)::bigint from public.promotion_grant g join other_bonus o on o.promotion_id = g.promotion_id
           where g.member_id = '00000000-0000-4000-8000-000000000213'), 300::bigint,
  'though the second bonus pays him its own two-hour step (money audit, 9 Nov)');
select results_eq($$ select * from pg_temp.paid('00000000-0000-4000-8000-000000000216') $$, $$ values (500::bigint) $$,
  'and pays Kunal his, reached before they stopped');

-- Four hours on: his second step, reached after the release, is paid.
update public.seat_session set started_at = now() - interval '250 minutes', seated_here_at = now() - interval '250 minutes'
where visit_id = '00000000-0000-4000-8000-0000000b3321';
update public.visit set opened_at = now() - interval '255 minutes' where id = '00000000-0000-4000-8000-0000000b3321';
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep at four hours');
select results_eq($$ select * from pg_temp.paid() $$, $$ values (1000::bigint) $$, 'pays the four-hour step alone');

-- A seat of 2 h 10 min now, 1 h 55 min 15 minutes ago.
create function pg_temp.seat(p_visit uuid, p_member uuid, p_table text, p_seat integer) returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at) values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, now() - interval '135 minutes');
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, g.id, p_seat, now() - interval '130 minutes', now() - interval '130 minutes'
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = p_table;
$$;
-- The skipped steps of the two bonuses for every tier, the seeded one and the second two-hour one.
create function pg_temp.skipped(p_member uuid) returns integer language sql as $$
  select count(*)::integer from public.promotion_step_skip k
  where k.member_id = p_member and k.step_number = 1
    and k.promotion_id in ((select promotion_id from bonus), (select promotion_id from other_bonus where tiers = '"all"'));
$$;

-- The venue frozen 15 minutes ago: Kavya's two-hour steps are skipped, and never paid once it is released.
select pg_temp.seat('00000000-0000-4000-8000-0000000b3323', '00000000-0000-4000-8000-000000000290', 'Table 4', 9);
insert into public.control_state (venue_id, level, reason, engaged_by_staff_id, engaged_at)
select '00000000-0000-4000-8000-000000000001', 'venue_freeze', 'test 332 freeze', s.id, now() - interval '15 minutes' from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep while the venue is frozen');
select is_empty($$ select * from pg_temp.paid('00000000-0000-4000-8000-000000000290') $$, 'pays Kavya nothing');
select is(pg_temp.skipped('00000000-0000-4000-8000-000000000290'), 2, 'and skips her two-hour step of each bonus, reached while frozen');
update public.control_state set released_at = now(), release_reason = 'test 332 freeze over', released_by_staff_id = engaged_by_staff_id,
  release_second_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where reason = 'test 332 freeze';
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep once the venue is released');
select is_empty($$ select * from pg_temp.paid('00000000-0000-4000-8000-000000000290') $$, 'never pays Kavya the step reached while frozen');

-- Vihaan frozen 15 minutes ago: his two-hour steps are skipped.
select pg_temp.seat('00000000-0000-4000-8000-0000000b3324', '00000000-0000-4000-8000-000000000212', 'Table 2', 8);
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id, engaged_at)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000212', 'test 332 member', s.id, now() - interval '15 minutes' from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep while Vihaan is frozen');
select is_empty($$ select * from pg_temp.paid('00000000-0000-4000-8000-000000000212') $$, 'pays Vihaan nothing');
select is(pg_temp.skipped('00000000-0000-4000-8000-000000000212'), 2, 'and skips his two-hour step of each bonus, reached while he was frozen');
update public.control_state set released_at = now(), release_reason = 'test 332 member over', released_by_staff_id = engaged_by_staff_id
where reason = 'test 332 member';

-- Another club and its admin, who manages promotions there.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000033ac', 'RIVR Elsewhere', 'test-steps', false, 'RIVR elsewhere', 'Test', 'TSK');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e332', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919990003321');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-0000000033ac', '00000000-0000-4000-8000-00000000e332', 'Other admin', 'Manager', 'admin', '+919990003321');
create temp table skips as select count(*)::integer as n from public.promotion_step_skip;
grant select on skips to authenticated;

-- Who reads the skipped steps.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.promotion_step_skip), (select n from skips), 'staff who manage promotions read every skipped step');
select ok((select n from skips) >= 5, 'Mihir''s, Kavya''s and Vihaan''s');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e332');
select is((select count(*)::integer from public.promotion_step_skip), 0, 'another club''s admin reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.promotion_step_skip), 0, 'the member reads none');
select throws_ok($$ insert into public.promotion_step_skip (venue_id, promotion_id, member_id, visit_id, step_number)
                    values ('00000000-0000-4000-8000-000000000001', (select promotion_id from bonus), '00000000-0000-4000-8000-000000000213',
                            '00000000-0000-4000-8000-0000000b3321', 2) $$, '42501', null, 'and no one writes one but the sweep');
reset role;

select * from finish();
rollback;
