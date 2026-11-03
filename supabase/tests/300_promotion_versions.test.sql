-- Promotions in versions (console v3 phase 7; decisions 0437 and 0461). 107 Ishita (marketing) drafts, simulates and
-- submits; 101 Vikram and 134 Kavya are super admins, who approve or reject, never their own; 104 Sana is a cashier and
-- 211 Ishaan a member. Editing the live promotion drafts version 2 while version 1 keeps giving; once version 2 is
-- approved, version 1 ends, and a member's once-a-day limit holds across both.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;
create temporary table today on commit drop as select private.club_day_of(now()) as day;
grant select on today to authenticated;
-- A draft: a percent of a buy-in up to 1,000 chips, at every stake, every day from a start day, once a club day each,
-- 5,000 chips in all, on the app and the TVs.
create function pg_temp.draft(p_name text, p_percent integer, p_starts date) returns jsonb language sql as $$
  select jsonb_build_object('terms', jsonb_build_object(
    'name', p_name, 'reward', jsonb_build_object('kind', 'buyin_bonus', 'mode', 'percent', 'percent', p_percent, 'capChips', 1000),
    'eligibility', '{"stakes": "all", "tiers": "all", "audience": "everyone"}'::jsonb,
    'schedule', jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', p_starts::text,
                                   'timezone', 'Asia/Kolkata'),
    'limits', '{"perMember": "per_day", "budgetChips": 5000}'::jsonb,
    'channels', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}'::jsonb, 'rulesText', '["Once a club day."]'::jsonb),
    'detail', p_percent || '% buy-in bonus, up to 1,000', 'runs', 'All stakes · every day');
$$;
-- The simulation the browser stores, on the version's own terms.
create function pg_temp.simulate(p_version uuid) returns void language sql as $$
  select public.record_promotion_simulation(v.id,
    '{"events": 3, "membersQualified": 2, "timesGiven": 2, "points": 0, "chips": 2000, "spins": 0, "perks": 0, "isBudgetReached": false}',
    jsonb_build_object('reward', v.reward, 'eligibility', v.eligibility, 'schedule', v.schedule, 'limits', v.limits))
  from public.promotion_version v where v.id = p_version;
$$;
grant execute on function pg_temp.draft(text, integer, date), pg_temp.simulate(uuid) to authenticated;
-- A buy-in of 10,000 in cash at Table 3, weighed by the engine: the grants given.
create function pg_temp.buy_in(p_member text, p_key text) returns integer language sql as $$
  select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
    jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000' || p_member, 'key', 'buy_in:' || p_key, 'amount_paise', 1000000, 'method', 'cash',
                       'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3')));
$$;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name; $$;
grant execute on function pg_temp.id(text) to authenticated;

-- The seed's live promotions back to drafts (decision 0461): only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

-- Drafting: staff who manage promotions, with terms the model holds; a retry with the request id is the same draft.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Ten percent', 10, (select day from today))) $$,
  '42501', null, 'a cashier drafts no promotion');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Ten percent', 0, (select day from today))) $$,
  '23514', null, 'terms the model does not hold are refused');
insert into ids select 'v1', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Ten percent', 10, (select day from today)) || '{"request_id": "00000000-0000-4000-8000-00000000f300"}');
select is(public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Ten percent', 10, (select day from today)) || '{"request_id": "00000000-0000-4000-8000-00000000f300"}'), pg_temp.id('v1'),
  'a retry with the request id returns the same draft');
insert into ids select 'promo', promotion_id from public.promotion_version where id = pg_temp.id('v1');
select results_eq($$ select version, status, name, detail from public.promotion_version where id = pg_temp.id('v1') $$,
  $$ values (1, 'draft'::text, 'Ten percent'::text, '10% buy-in bonus, up to 1,000'::text) $$, 'marketing saves a first version as a draft');
select results_eq($$ select status, name from public.promotion where id = pg_temp.id('promo') $$, $$ values ('draft'::text, 'Ten percent'::text) $$,
  'and the promotion copies it');

-- Submitting needs a simulation on its very terms.
select throws_ok($$ select public.submit_promotion_version(pg_temp.id('v1')) $$, 'RVSIM', null, 'a draft is not submitted unsimulated');
select lives_ok($$ select pg_temp.simulate(pg_temp.id('v1')) $$, 'marketing simulates it on last week');
select lives_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001',
  pg_temp.draft('Twelve percent', 12, (select day from today)), pg_temp.id('promo')) $$, 'then changes it');
select is((select simulation from public.promotion_version where id = pg_temp.id('v1')), null, 'which clears the simulation');
select throws_ok($$ select public.submit_promotion_version(pg_temp.id('v1')) $$, 'RVSIM', null, 'so it is not submitted');
select lives_ok($$ select pg_temp.simulate(pg_temp.id('v1')) $$, 'simulated again');
select lives_ok($$ select public.submit_promotion_version(pg_temp.id('v1')) $$, 'it is submitted');
select throws_ok($$ select public.submit_promotion_version(pg_temp.id('v1')) $$, 'RVDEC', null, 'once');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001',
  pg_temp.draft('Thirteen percent', 13, (select day from today)), pg_temp.id('promo')) $$, 'RVDEC', null, 'and a waiting version is not changed');
reset role;
select results_eq($$ select p.status, s.user_id::text from public.promotion p join public.staff s on s.id = p.requested_by_staff_id
                     where p.id = pg_temp.id('promo') $$,
  $$ values ('pending'::text, '00000000-0000-4000-8000-000000000107'::text) $$, 'it waits for a super admin, submitted by Ishita');

-- Approval: promotions.approve, then it runs from its start day, with its budget for the wheel and the reports.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.approve_promotion_version(pg_temp.id('v1')) $$, '42501', null, 'marketing approves nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_version(pg_temp.id('v1')) $$, 'a super admin approves it');
reset role;
select results_eq($$ select v.status, p.status, p.current_version, b.cap_paise, b.cap_count from public.promotion_version v
                     join public.promotion p on p.id = v.promotion_id left join public.promotion_budget b on b.promotion_id = p.id
                     where v.id = pg_temp.id('v1') $$,
  $$ values ('live'::text, 'live'::text, 1, 500000::bigint, null::integer) $$, 'it is live from today, and its 5,000 chips are its budget');

-- It gives: 12% of 10,000 held to the 1,000 cap, credited as bonus, once a club day.
select is(pg_temp.buy_in('211', 'v300-1'), 1, 'Ishaan''s buy-in is given');
select results_eq($$ select chips, cost_paise, period_key, promotion_version_id from public.promotion_grant where source_key = 'buy_in:v300-1' $$,
  $$ select 1000::bigint, 100000::bigint, 'day:' || (select day from today), pg_temp.id('v1') $$, '1,000 chips, the cap below 12%, keyed by the club day');
select is((select amount_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211' and reason = 'Twelve percent'), 100000::bigint,
  'credited as bonus at once');
select is(pg_temp.buy_in('211', 'v300-2'), 0, 'and once a club day');

-- Editing the live promotion drafts version 2; version 1 runs until version 2 is approved.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'v2', public.save_promotion_draft('00000000-0000-4000-8000-000000000001',
  pg_temp.draft('Twenty percent', 20, (select day from today)), pg_temp.id('promo'));
reset role;
select results_eq($$ select version, status from public.promotion_version where promotion_id = pg_temp.id('promo') order by version $$,
  $$ values (1, 'live'::text), (2, 'draft') $$, 'an edit of a live promotion is a new draft');
select is(pg_temp.buy_in('212', 'v300-3'), 1, 'and version 1 still gives');
select is((select promotion_version_id from public.promotion_grant where source_key = 'buy_in:v300-3'), pg_temp.id('v1'), 'as version 1');
select is((select name from public.promotion where id = pg_temp.id('promo')), 'Twelve percent', 'whose words the card still shows');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select pg_temp.simulate(pg_temp.id('v2')) $$, 'version 2 is simulated');
select lives_ok($$ select public.submit_promotion_version(pg_temp.id('v2')) $$, 'and submitted');

-- Rejected with a reason, submitted again, approved by another.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.reject_promotion_version(pg_temp.id('v2'), 'No') $$, '22023', null, 'a rejection says why');
select lives_ok($$ select public.reject_promotion_version(pg_temp.id('v2'), 'Twenty percent is too much this month') $$, 'Vikram rejects it');
reset role;
select results_eq($$ select status, rejected_reason from public.promotion_version where id = pg_temp.id('v2') $$,
  $$ values ('draft'::text, 'Twenty percent is too much this month'::text) $$, 'back to draft with the reason');
select is((select status from public.promotion_version where id = pg_temp.id('v1')), 'live', 'while version 1 runs on');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.submit_promotion_version(pg_temp.id('v2')) $$, 'submitted again, its simulation still on its terms');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select lives_ok($$ select public.approve_promotion_version(pg_temp.id('v2')) $$, 'Kavya approves it');
reset role;
select results_eq($$ select version, status from public.promotion_version where promotion_id = pg_temp.id('promo') order by version $$,
  $$ values (1, 'ended'::text), (2, 'live') $$, 'version 2 runs and version 1 ends');
select results_eq($$ select name, current_version from public.promotion where id = pg_temp.id('promo') $$, $$ values ('Twenty percent'::text, 2) $$,
  'the promotion carries version 2');
select is(pg_temp.buy_in('211', 'v300-4'), 0, 'Ishaan had his today under version 1: the limit holds across versions');
select is(pg_temp.buy_in('216', 'v300-5'), 1, 'Kunal has his under version 2');

-- Four eyes among super admins: never one's own; a version for tomorrow is scheduled and gives nothing yet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'own', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Vikram''s idea', 30, (select day + 1 from today)));
select pg_temp.simulate(pg_temp.id('own'));
select public.submit_promotion_version(pg_temp.id('own'));
select throws_ok($$ select public.approve_promotion_version(pg_temp.id('own')) $$, 'RVTWO', null, 'a super admin never approves their own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select lives_ok($$ select public.approve_promotion_version(pg_temp.id('own')) $$, 'another super admin does');
reset role;
select is((select status from public.promotion_version where id = pg_temp.id('own')), 'scheduled', 'starting tomorrow, it is scheduled');
select is(pg_temp.buy_in('217', 'v300-6'), 1, 'Neel''s buy-in is given by version 2 alone');
select is((select count(*)::integer from public.promotion_grant g join public.promotion_version v on v.id = g.promotion_version_id
           where v.id = pg_temp.id('own')), 0, 'the scheduled one gives nothing yet');

-- Pause, resume, end; an ended promotion is not changed.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.set_promotion_version_live(pg_temp.id('v2'), false) $$, 'marketing pauses it');
select throws_ok($$ select public.set_promotion_version_live(pg_temp.id('v2'), false) $$, '22023', null, 'once');
reset role;
select is(pg_temp.buy_in('213', 'v300-7'), 0, 'paused, it gives nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.set_promotion_version_live(pg_temp.id('v2'), true) $$, 'and resumes it');
select lives_ok($$ select public.end_promotion_version(pg_temp.id('v2')) $$, 'then ends it');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001',
  pg_temp.draft('Again', 10, (select day from today)), pg_temp.id('promo')) $$, '22023', null, 'an ended promotion is not changed');
reset role;
select is((select status from public.promotion where id = pg_temp.id('promo')), 'ended', 'the promotion says ended');

-- Who reads and writes versions: managers of the venue, through the functions alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.promotion_version $$, 'a member reads no versions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.promotion_version $$, 'nor does a cashier');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.promotion_version where promotion_id = pg_temp.id('promo')), 2, 'marketing reads its venue''s');
select throws_ok($$ update public.promotion_version set status = 'live' where id = pg_temp.id('v2') $$, '42501', null, 'but writes a version only through the functions');
-- 153 Imran is an admin at Gurugram alone, not at the practice venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000153');
select ok((select count(*) > 0 from public.promotion_version where venue_id = '00000000-0000-4000-8000-000000000001'), 'an admin reads his venue''s versions');
select is_empty($$ select * from public.promotion_version where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'and none of another venue''s');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000002', pg_temp.draft('Elsewhere', 10, (select day from today))) $$,
  '42501', null, 'nor drafts at another venue');
reset role;
select throws_ok($$ update public.promotion set status = 'live' where id = pg_temp.id('promo') $$, 'RVVER', null,
  'a promotion in versions changes status only with its version');

-- Not while promotions are switched off.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.save_promotion_draft('00000000-0000-4000-8000-000000000001', pg_temp.draft('Off', 10, (select day from today))) $$,
  'RVKIL', null, 'nothing is drafted while promotions are switched off');
reset role;

select * from finish();
rollback;
