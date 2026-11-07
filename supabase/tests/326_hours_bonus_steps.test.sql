-- Play-time bonus paid as each step is reached (the owner, 8 Nov). The seeded four-hour bonus goes live as 500 bonus
-- chips after two hours, then 1,000 after four, once a visit. Mihir (213), seated 4 h 10 min and still at the table, is
-- paid both steps by the minute's sweep, once however often it runs. Kunal (216), seated 3 h 20 min but away for the last
-- 70, has reached only two hours. Every 90 minutes, once a visit, pays the 90-minute step alone. Vihaan (212), seated
-- 2 h 5 min, is paid his two-hour step when his visit closes at the cage, between sweeps.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table bonus as
select v.id as version_id, p.id as promotion_id from public.promotion p join public.promotion_version v on v.promotion_id = p.id
where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'hours_bonus';
update public.promotion_version set status = 'live', limits = '{"perMember": "per_visit"}',
  reward = '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 120, "chips": 500}, {"afterMinutes": 240, "chips": 1000}]}'
where id = (select version_id from bonus);
select private.sync_promotion((select promotion_id from bonus));
select is((select count(*)::integer from bonus), 1, 'the seed has the four-hour bonus in versions');

-- Each player's open visit and seat at a table of the club.
create function pg_temp.seat(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_minutes integer, p_away_minutes integer)
returns void language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, now() - make_interval(mins => p_minutes + 5));
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_since)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, g.id, p_seat, now() - make_interval(mins => p_minutes),
         now() - make_interval(mins => p_minutes), case when p_away_minutes > 0 then now() - make_interval(mins => p_away_minutes) end
  from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = p_table;
$$;
select pg_temp.seat('00000000-0000-4000-8000-0000000b2601', '00000000-0000-4000-8000-000000000213', 'Table 2', 9, 250, 0);
select pg_temp.seat('00000000-0000-4000-8000-0000000b2602', '00000000-0000-4000-8000-000000000216', 'Table 3', 9, 200, 70);

create function pg_temp.steps_of(p_member uuid) returns table (chips bigint, source_key text, period_key text, trigger text) language sql as $$
  select g.chips, g.source_key, g.period_key, g.trigger from public.promotion_grant g
  where g.promotion_id = (select promotion_id from bonus) and g.member_id = p_member order by g.chips;
$$;

select lives_ok($$ select private.sweep_hours_bonus() $$, 'the minute''s sweep runs');
select results_eq($$ select * from pg_temp.steps_of('00000000-0000-4000-8000-000000000213') $$,
  $$ values (500::bigint, 'hours_step:00000000-0000-4000-8000-0000000b2601:120'::text, 'visit:00000000-0000-4000-8000-0000000b2601@120'::text, 'hours_step'::text),
            (1000::bigint, 'hours_step:00000000-0000-4000-8000-0000000b2601:240'::text, 'visit:00000000-0000-4000-8000-0000000b2601@240'::text, 'hours_step'::text) $$,
  'Mihir, still seated after 4 h 10 min, is paid both steps, each in a period of its own');
select is((select sum(b.amount_paise) from public.bonus_grant b where b.member_id = '00000000-0000-4000-8000-000000000213'
           and b.idempotency_key in (select 'promotion:' || g.id from public.promotion_grant g where g.promotion_id = (select promotion_id from bonus))),
  150000::numeric, 'as 1,500 bonus chips on his balance');
select results_eq($$ select chips from pg_temp.steps_of('00000000-0000-4000-8000-000000000216') $$, $$ values (500::bigint) $$,
  'Kunal, away for the last 70 of his 200 minutes, has reached two hours and no more');
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the next minute''s sweep');
select is((select count(*)::integer from public.promotion_grant where promotion_id = (select promotion_id from bonus)), 3,
  'pays no step twice');

-- Two promotions with the same step each pay it: a second one-step bonus at two hours, live beside the first.
create temp table second as select gen_random_uuid() as promotion_id;
insert into public.promotion (id, venue_id, name, status, starts_at)
select promotion_id, '00000000-0000-4000-8000-000000000001', 'Two-hour bonus', 'draft', now() - interval '1 day' from second;
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', s.promotion_id, 1, 'live', 'Two-hour bonus', '{"kind": "hours_bonus", "chips": 300, "afterMinutes": 120}',
       v.eligibility, v.schedule, '{"perMember": "per_visit"}', v.channels
from second s, public.promotion_version v where v.id = (select version_id from bonus);
select private.sync_promotion((select promotion_id from second));
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep with a second promotion at two hours');
select results_eq($$ select g.chips from public.promotion_grant g where g.promotion_id = (select promotion_id from second) order by g.member_id $$,
  $$ values (300::bigint), (300::bigint) $$, 'Mihir and Kunal, already paid the first promotion''s two-hour step, are paid the second''s too');
select throws_ok($$ insert into public.promotion_grant
                    select (jsonb_populate_record(null::public.promotion_grant,
                              to_jsonb(g) || jsonb_build_object('id', gen_random_uuid(), 'period_key', g.period_key || '#2'))).*
                    from public.promotion_grant g where g.promotion_id = (select promotion_id from second) limit 1 $$,
  '23505', null, 'a step paid twice by one promotion, as a sweep and a close at once would, is refused by the database');
update public.promotion_version set status = 'ended' where promotion_id = (select promotion_id from second);

-- Every 90 minutes, once a visit: only the first step.
update public.promotion_version set reward = '{"kind": "hours_bonus", "mode": "every", "everyMinutes": 90, "chips": 250, "timesPerVisit": 1}'
where id = (select version_id from bonus);
select pg_temp.seat('00000000-0000-4000-8000-0000000b2603', '00000000-0000-4000-8000-000000000290', 'Table 4', 9, 200, 0);
select lives_ok($$ select private.sweep_hours_bonus() $$, 'the sweep, every 90 minutes once a visit');
select results_eq($$ select chips, source_key from pg_temp.steps_of('00000000-0000-4000-8000-000000000290') $$,
  $$ values (250::bigint, 'hours_step:00000000-0000-4000-8000-0000000b2603:90'::text) $$, 'Kavya''s 200 minutes are paid one step, its cap');

-- Between sweeps, the close pays a step reached by then.
update public.promotion_version set reward = '{"kind": "hours_bonus", "chips": 500, "afterMinutes": 120}' where id = (select version_id from bonus);
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000b2604', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '3 hours');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-0000000b2604', g.id, 8,
       now() - interval '126 minutes', now() - interval '126 minutes', now() - interval '1 minute', 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
select is(private.close_visit('00000000-0000-4000-8000-000000000212', now(), 'cash_out'), '00000000-0000-4000-8000-0000000b2604'::uuid,
  'Vihaan''s visit closes at the cage');
select results_eq($$ select chips, trigger from pg_temp.steps_of('00000000-0000-4000-8000-000000000212') $$,
  $$ values (500::bigint, 'hours_step'::text) $$, 'and his two hours are paid at the close');

select * from finish();
rollback;
