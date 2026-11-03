-- Templates for every scheme in the deck (#85). Every venue has them as drafts; six carry the engine's rule (the
-- four-hour bonus since decision 0164). Since decision 0491 those the typed model can say run in versions, with Founders'
-- Circle priority, the cab home, and Double and Triple points as points multipliers. The word-only cards are retired
-- (decision 0498): no venue gets one. 107 Ishita (marketing) submits one and 101, a super admin, approves it (#144); 104 Sana (cashier) may do neither.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.template(p_key text) returns uuid language sql as $$
  select id from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = p_key;
$$;
grant execute on function pg_temp.template(text) to authenticated;
create function pg_temp.version_of(p_key text) returns uuid language sql as $$
  select v.id from public.promotion_version v where v.promotion_id = pg_temp.template(p_key) and v.version = 1;
$$;
grant execute on function pg_temp.version_of(text) to authenticated;

-- As a venue starts them: the three the seed publishes (57_promotions.sql) back to drafts.
update public.promotion_version v set status = 'draft' from public.promotion p
where p.id = v.promotion_id and p.template_key in ('tuesday_bonus', 'referral') and v.status = 'live';
select private.sync_promotion(id) from public.promotion where template_key in ('tuesday_bonus', 'referral');

select results_eq(
  $$ select template_key, status, (select count(*)::integer from public.promotion_rule r where r.promotion_id = p.id)
     from public.promotion p where p.venue_id = '00000000-0000-4000-8000-000000000001' and template_key is not null order by template_key $$,
  $$ values ('cab'::text, 'draft'::text, 0), ('double_points', 'draft', 0), ('founders_priority', 'draft', 0),
            ('graduate_first_buy_in', 'draft', 1), ('graduate_freeroll', 'draft', 1), ('hours_bonus', 'draft', 1),
            ('referral', 'draft', 1), ('spin_wheel', 'draft', 1), ('triple_points', 'draft', 0), ('tuesday_bonus', 'draft', 1) $$,
  'the club has every scheme in the deck as a draft; the six the engine runs carry their rule');
select results_eq(
  $$ select p.template_key, r.trigger, r.conditions - 'tier_ids', r.effect, p.per_player_limit, p.per_player_period
     from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
     where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key is not null order by p.template_key $$,
  $$ values ('graduate_first_buy_in'::text, 'buy_in'::text, '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb, 1, 'promotion'::text),
            ('graduate_freeroll', 'graduation', '{}', '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}', 1, 'promotion'),
            ('hours_bonus', 'hours_played', '{"min_hours": 4}', '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}', 1, 'day'),
            ('referral', 'referral', '{}', '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}', null, null),
            ('spin_wheel', 'hours_played', '{"min_hours": 4}', '{"kind": "spin"}', 1, 'day'),
            ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}', '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}', null, null) $$,
  'graduate first buy-in ₹1,000 once each; the graduate freeroll once (#128); four hours ₹1,000 once a club day; referral ₹1,000; a spin after four hours once a club day (#150); Tuesday 20% among the first five at a table');
select results_eq(
  $$ select p.template_key, v.version, v.status, v.reward, v.limits
     from public.promotion p join public.promotion_version v on v.promotion_id = p.id
     where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key is not null order by p.template_key $$,
  $$ values ('cab'::text, 1, 'draft'::text, '{"kind": "cab_home", "fromVisitInMonth": 4}'::jsonb, '{"perMember": "none"}'::jsonb),
            ('double_points', 1, 'draft', '{"kind": "points_multiplier", "multiplier": 2}', '{"perMember": "per_visit"}'),
            ('founders_priority', 1, 'draft', '{"kind": "waitlist_priority"}', '{"perMember": "none"}'),
            ('graduate_first_buy_in', 1, 'draft', '{"kind": "bonus_chips", "chips": 1000, "on": "first_buyin"}', '{"perMember": "once"}'),
            ('graduate_freeroll', 1, 'draft', '{"kind": "tournament_entry", "tournamentId": "RIVR Sunday"}', '{"perMember": "once"}'),
            ('hours_bonus', 1, 'draft', '{"kind": "hours_bonus", "chips": 1000, "afterMinutes": 240}', '{"perMember": "per_day"}'),
            ('referral', 1, 'draft', '{"kind": "bonus_chips", "chips": 1000, "on": "referral"}', '{"perMember": "none"}'),
            ('spin_wheel', 1, 'draft', '{"kind": "free_spin", "spins": 1, "afterMinutes": 240}', '{"perMember": "per_day"}'),
            ('triple_points', 1, 'draft', '{"kind": "points_multiplier", "multiplier": 3}', '{"perMember": "per_visit"}'),
            ('tuesday_bonus', 1, 'draft', '{"kind": "buyin_bonus", "mode": "percent", "percent": 20, "firstNBuyinsPerTable": 5}', '{"perMember": "none"}') $$,
  'the templates the typed model can say are versions: double and triple points as multipliers (decision 0491)');
select is((select v.eligibility -> 'tiers' ->> 0 from public.promotion_version v where v.id = pg_temp.version_of('founders_priority')),
  (select id::text from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Founders'' Circle'),
  'Founders'' Circle priority is for that tier');
select is((select v.schedule ->> 'days' from public.promotion_version v where v.id = pg_temp.version_of('tuesday_bonus')), '[2]',
  'and the Tuesday bonus runs on Tuesdays');
select is((select r.conditions -> 'tier_ids' ->> 0 from public.promotion_rule r where r.promotion_id = pg_temp.template('graduate_first_buy_in')),
  (select id::text from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Academy graduate'),
  'the graduate bonus is for the venue''s Academy graduate tier');
select is_empty($$ select 1 from public.promotion where template_key in ('high_hands', 'bad_beat', 'rivr_rewards', 'ladies_night', 'league',
                                                                      'sunday_guarantee') $$,
  'no venue has a word-only card (decision 0498)');
select results_eq(
  $$ select p.venue_id::text, count(distinct p.id)::integer, count(r.id)::integer from public.promotion p left join public.promotion_rule r on r.promotion_id = p.id
     where p.template_key is not null group by p.venue_id order by p.venue_id $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::text, 10, 6), ('00000000-0000-4000-8000-000000000002', 10, 6) $$,
  'the practice venue has the same');

-- Adding them again adds nothing; a new venue gets them.
select lives_ok($$ select private.add_promotion_templates('00000000-0000-4000-8000-000000000001') $$, 'the templates are added again');
select is((select count(*)::integer from public.promotion_rule r join public.promotion p on p.id = r.promotion_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key is not null), 6, 'and nothing is doubled');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-templates', false, 'RIVR test', 'Test', 'TST');
select is((select count(*)::integer from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
           where p.venue_id = '00000000-0000-4000-8000-0000000000aa' and p.template_key is not null), 6,
  'a new venue starts with every template and its rules');
select is((select count(*)::integer from public.promotion_version v where v.venue_id = '00000000-0000-4000-8000-0000000000aa'), 10,
  'and their versions');

-- Submitting a template: promotion managers only, from its draft; a super admin approves it, and it is announced.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.submit_promotion_template(pg_temp.template('referral')) $$, '42501', null, 'a cashier submits no template');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.submit_promotion_template(pg_temp.template('referral')) $$, 'RVVER', null,
  'the referral runs in versions, so the old way is refused');
select lives_ok($$ select public.record_promotion_simulation(pg_temp.version_of('referral'),
  '{"events": 0, "membersQualified": 0, "timesGiven": 0, "points": 0, "chips": 0, "spins": 0, "perks": 0, "isBudgetReached": false}',
  (select jsonb_build_object('reward', v.reward, 'eligibility', v.eligibility, 'schedule', v.schedule, 'limits', v.limits)
   from public.promotion_version v where v.id = pg_temp.version_of('referral'))) $$, 'marketing simulates the referral template');
select lives_ok($$ select public.submit_promotion_version(pg_temp.version_of('referral')) $$, 'and submits it');
select throws_ok($$ select public.submit_promotion_version(pg_temp.version_of('referral')) $$, 'RVDEC', null, 'once');
reset role;
select is((select status from public.promotion where id = pg_temp.template('referral')), 'pending', 'the referral waits for a super admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_version(pg_temp.version_of('referral')) $$, 'who approves it');
reset role;
select is((select status from public.promotion where id = pg_temp.template('referral')), 'live', 'the referral runs');
select is((select payload ->> 'detail' from public.outbox_event where idempotency_key = 'promotion.published:' || pg_temp.version_of('referral')),
  '1,000 bonus chips to each side', 'and promotion.published carries its card');

-- Approved, a template runs: ₹1,000 bonus on a referral.
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'referral',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "referral:test-1"}')), 1, 'a referral gives Ishaan a promotion');
select is((select amount_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211' and reason = 'Referral'), 100000::bigint,
  'a ₹1,000 bonus');

-- A template still run the old way, as a venue may have one from before versions (decision 0491).
insert into public.promotion (venue_id, template_key, name, detail, runs)
values ('00000000-0000-4000-8000-000000000001', 'old_way_089', 'An old template', 'Words only', 'Every night');
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.submit_promotion_template(pg_temp.template('old_way_089')) $$, 'RVKIL', null, 'nothing is submitted while promotions are off');
reset role;

select * from finish();
rollback;
