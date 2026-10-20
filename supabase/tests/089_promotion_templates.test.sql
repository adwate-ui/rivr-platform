-- Templates for every scheme in the deck (#85). Every venue has the eleven as drafts; three carry the
-- engine's rule, the rest are cards only. 107 Ishita (marketing) publishes; 104 Sana (cashier) may not.
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

-- As a venue starts them: the three the seed publishes (57_promotions.sql) back to drafts, the Tuesday
-- bonus on Tuesdays again.
update public.promotion set status = 'draft' where template_key in ('tuesday_bonus', 'high_hands', 'referral');
update public.promotion_rule r set conditions = r.conditions || '{"days": [2]}' from public.promotion p
where p.id = r.promotion_id and p.template_key = 'tuesday_bonus';

select results_eq(
  $$ select template_key, status, (select count(*)::integer from public.promotion_rule r where r.promotion_id = p.id)
     from public.promotion p where p.venue_id = '00000000-0000-4000-8000-000000000001' and template_key is not null order by template_key $$,
  $$ values ('bad_beat'::text, 'draft'::text, 0), ('cab', 'draft', 0), ('founders_priority', 'draft', 0), ('graduate_first_buy_in', 'draft', 1),
            ('high_hands', 'draft', 0), ('ladies_night', 'draft', 0), ('league', 'draft', 0), ('referral', 'draft', 1), ('rivr_rewards', 'draft', 0),
            ('sunday_guarantee', 'draft', 0), ('tuesday_bonus', 'draft', 1) $$,
  'the club has every scheme in the deck as a draft; the three the engine runs carry their rule');
select results_eq(
  $$ select p.template_key, r.trigger, r.conditions - 'tier_ids', r.effect, p.per_player_limit, p.per_player_period
     from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
     where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key is not null order by p.template_key $$,
  $$ values ('graduate_first_buy_in'::text, 'buy_in'::text, '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb, 1, 'promotion'::text),
            ('referral', 'referral', '{}', '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}', null, null),
            ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}', '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}', null, null) $$,
  'graduate first buy-in ₹1,000 once each; referral ₹1,000; Tuesday 20% among the first five at a table');
select is((select r.conditions -> 'tier_ids' ->> 0 from public.promotion_rule r where r.promotion_id = pg_temp.template('graduate_first_buy_in')),
  (select id::text from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Academy graduate'),
  'the graduate bonus is for the venue''s Academy graduate tier');
select results_eq($$ select name, detail, runs from public.promotion where id = pg_temp.template('high_hands') $$,
  $$ values ('High hands'::text, 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000'::text, 'Every night'::text) $$,
  'high hands are a card: the floor pays them in chips');
select results_eq(
  $$ select p.venue_id::text, count(distinct p.id)::integer, count(r.id)::integer from public.promotion p left join public.promotion_rule r on r.promotion_id = p.id
     where p.template_key is not null group by p.venue_id order by p.venue_id $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::text, 11, 3), ('00000000-0000-4000-8000-000000000002', 11, 3) $$,
  'the practice venue has the same');

-- Adding them again adds nothing; a new venue gets them.
select lives_ok($$ select private.add_promotion_templates('00000000-0000-4000-8000-000000000001') $$, 'the templates are added again');
select is((select count(*)::integer from public.promotion_rule r join public.promotion p on p.id = r.promotion_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key is not null), 3, 'and nothing is doubled');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-templates', false, 'RIVR test', 'Test', 'TST');
select is((select count(*)::integer from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
           where p.venue_id = '00000000-0000-4000-8000-0000000000aa' and p.template_key is not null), 3,
  'a new venue starts with every template and its rules');

-- Publishing a template: promotion managers only, from its draft, announced.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.publish_promotion_template(pg_temp.template('referral')) $$, '42501', null, 'a cashier publishes no template');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.publish_promotion_template(pg_temp.template('referral')) $$, 'marketing publishes the referral template');
select throws_ok($$ select public.publish_promotion_template(pg_temp.template('referral')) $$, '22023', null, 'once');
select lives_ok($$ select public.publish_promotion_template(pg_temp.template('high_hands')) $$, 'and the high-hands card');
reset role;
select is((select status from public.promotion where id = pg_temp.template('referral')), 'live', 'the referral runs');
select is((select payload ->> 'detail' from public.outbox_event where idempotency_key = 'promotion.published:' || pg_temp.template('referral')),
  '₹1,000 to each side', 'and promotion.published carries its card');

-- Published, a template runs: ₹1,000 bonus on a referral; a card alone gives nothing.
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'referral',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "referral:test-1"}')), 1, 'a referral gives Ishaan a promotion');
select is((select amount_paise from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211' and reason = 'Referral'), 100000::bigint,
  'a ₹1,000 bonus');
select is((select count(*)::integer from public.promotion_grant where promotion_id = pg_temp.template('high_hands')), 0, 'the high-hands card pays nothing');

insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.publish_promotion_template(pg_temp.template('league')) $$, 'RVKIL', null, 'nothing is published while promotions are off');
reset role;

select * from finish();
rollback;
