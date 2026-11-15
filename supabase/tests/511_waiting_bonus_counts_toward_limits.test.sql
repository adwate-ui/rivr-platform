-- A waiting Bonus counts toward its promotion's limits and budget as one given, so the engine never gives it twice while
-- it waits; a refused one counts toward nothing, so the member's next may be given (decision 0670). An event already
-- weighed, refused or not, is not weighed again; nor is a play-time step refused in the visit. 101 Vikram is a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.m(p_member text) returns uuid language sql as $$ select ('00000000-0000-4000-8000-000000000' || p_member)::uuid $$;
create function pg_temp.live(p_name text, p_reward jsonb, p_limits jsonb) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', p_name, p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 2)::text,
                             'timezone', 'Asia/Kolkata'),
          p_limits, '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
create function pg_temp.check_in(p_member text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'check_in',
    jsonb_build_object('member_id', pg_temp.m(p_member), 'key', 'check_in:' || p_key));
$$;
-- A super admin's decision on the grants of one promotion and member: approved, or refused with a reason.
create function pg_temp.decide(p_promotion uuid, p_member text, p_decision text) returns integer language plpgsql as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_count integer;
begin
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}', true);
  select d.grants into v_count
  from private.decide_promotion_bonus('00000000-0000-4000-8000-000000000001',
    (select array_agg(g.id) from public.promotion_grant g where g.promotion_id = p_promotion and g.member_id = pg_temp.m(p_member) and g.status = 'waiting'),
    p_decision, case when p_decision = 'refused' then 'Test 511' end, gen_random_uuid()) d;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_count;
end;
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;

-- Once a member: a waiting one holds it; refused, the next check-in is given it.
insert into ids select 'once', pg_temp.live('Once 511', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}', '{"perMember": "once"}');
select is(pg_temp.check_in('211', 'once-1'), 1, 'Ishaan''s first check-in is given the Bonus, which waits');
select is(pg_temp.check_in('211', 'once-2'), 0, 'while it waits, his next is given nothing: it counts as given');
select is(pg_temp.decide((select id from ids where name = 'once'), '211', 'refused'), 1, 'refused');
select is(pg_temp.check_in('211', 'once-3'), 1, 'and a refused one counts toward nothing: his next check-in is given it');
select is(pg_temp.check_in('211', 'once-1'), 0, 'the refused check-in is never weighed again');
select is(pg_temp.decide((select id from ids where name = 'once'), '211', 'approved'), 1, 'the new one approved');
select is(pg_temp.check_in('211', 'once-4'), 0, 'and once given, never again');
select results_eq($$ select source_key, status from public.promotion_grant where promotion_id = (select id from ids where name = 'once') order by created_at, source_key $$,
  $$ values ('check_in:once-1'::text, 'refused'::text), ('check_in:once-3', 'given') $$, 'one refused, one given');

-- A budget of 1,000 chips, 500 a check-in: two waiting fill it; a refusal makes room for a third. Once 511 has ended.
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'once');
insert into ids select 'budget', pg_temp.live('Budget 511', '{"kind": "bonus_chips", "chips": 500, "on": "visit"}', '{"perMember": "none", "budgetChips": 1000}');
select is(pg_temp.check_in('212', 'budget-1') + pg_temp.check_in('213', 'budget-2'), 2, 'two check-ins are given 500 each, both waiting');
select is(pg_temp.check_in('214', 'budget-3'), 0, 'the budget is spent by what waits: a third is given nothing');
select is((private.promotion_tally((select id from ids where name = 'budget'), null, null, null, private.club_day_of(now()),
           '{"budgetChips": 1000}') ->> 'chipsGiven')::bigint, 1000::bigint, 'the tally counts the waiting 1,000');
select is(pg_temp.decide((select id from ids where name = 'budget'), '212', 'refused'), 1, 'Vihaan''s refused');
select is((private.promotion_tally((select id from ids where name = 'budget'), null, null, null, private.club_day_of(now()),
           '{"budgetChips": 1000}') ->> 'chipsGiven')::bigint, 500::bigint, 'the tally no longer counts it');
select is(pg_temp.check_in('214', 'budget-4'), 1, 'so Yash''s next check-in is given the 500 it left');
select is(pg_temp.check_in('215', 'budget-5'), 0, 'and then the budget is spent again');

-- A play-time step refused is settled for the visit: the sweep never gives it again. Budget 511 has ended.
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'budget');
insert into ids select 'hours', pg_temp.live('Hours 511',
  '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}', '{"perMember": "none"}');
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000511a1', '00000000-0000-4000-8000-000000000001', pg_temp.m('216'), now() - interval '75 minutes');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', pg_temp.m('216'), '00000000-0000-4000-8000-0000000511a1', g.id, 3,
       now() - interval '70 minutes', now() - interval '70 minutes', 0
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000511a1', now());
select is(pg_temp.decide((select id from ids where name = 'hours'), '216', 'refused'), 1, 'Kunal''s step after an hour, refused');
select private.weigh_hours_steps('00000000-0000-4000-8000-0000000511a1', now());
select is((select count(*)::integer from public.promotion_grant where promotion_id = (select id from ids where name = 'hours')), 1,
  'the next sweep gives that step no second time');

select * from finish();
rollback;
