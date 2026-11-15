-- The buy-in trigger is gone from promotions (question 1009; the owner, 15 Nov): no version gives on a buy-in, no rule is
-- set off by one, neither engine weighs one, and no venue has the Tuesday buy-in bonus. What stays is proved where it
-- always was: Bonus on the seat (338), on hours played (334), on a referral and a sign-up (301, 319) and by hand (425).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.terms_ok(p_reward jsonb) returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', '{"perMember": "per_visit"}',
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;
select ok(not pg_temp.terms_ok('{"kind": "buyin_bonus", "mode": "percent", "percent": 20}'), 'a percent of the buy-in is no reward');
select ok(not pg_temp.terms_ok('{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}'), 'nor fixed chips on a buy-in');
select ok(not pg_temp.terms_ok('{"kind": "bonus_chips", "chips": 500, "on": "first_buyin"}'), 'nor bonus chips on a visit''s first buy-in');
select ok(pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 500}') and pg_temp.terms_ok('{"kind": "hours_bonus", "chips": 500, "afterMinutes": 240}')
          and pg_temp.terms_ok('{"kind": "bonus_chips", "chips": 500, "on": "referral"}') and pg_temp.terms_ok('{"kind": "bonus_chips", "chips": 500, "on": "signup"}'),
  'a seat bonus, a play-time bonus, and bonus chips on a referral or a sign-up still are');

-- Stored nowhere: a version's check refuses the reward, a rule's the trigger.
select throws_ok($$ insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
                    select v.venue_id, v.promotion_id, 2, 'ended', v.name, '{"kind": "buyin_bonus", "mode": "fixed", "chips": 500}', v.eligibility, v.schedule,
                           v.limits, v.channels
                    from public.promotion_version v join public.promotion p on p.id = v.promotion_id
                    where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'referral' $$,
  '23514', null, 'no version holds a buy-in bonus, ended or not');
select throws_ok($$ insert into public.promotion_rule (venue_id, promotion_id, position, trigger, effect)
                    select p.venue_id, p.id, 9, 'buy_in', '{"kind": "message", "text": "Hello"}' from public.promotion p
                    where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'referral' $$,
  '23514', null, 'no rule is set off by a buy-in');

-- Weighed by neither engine.
select throws_ok($$ select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "buy_in:440", "amount_paise": 1000000, "method": "cash"}') $$,
  '22023', null, 'the engine refuses a buy-in as it does any trigger it does not know');
select is_empty($$ select * from private.evaluate_promotion_versions('00000000-0000-4000-8000-000000000001', 'buy_in',
  '{"member_id": "00000000-0000-4000-8000-000000000211", "key": "buy_in:440"}') $$, 'and the versions give nothing for one');
select is((select o_refusal from private.promo_grant('{"kind": "seat_bonus", "chips": 500}',
            '{"kind": "buy_in", "key": "buy_in:440", "ownChips": 10000, "isFirstOfVisit": true}')), 'other_event', 'a reward gives nothing for a buy-in');
select results_eq($$ select private.promotion_event_kind(r.reward::jsonb) from (values
                       (1, '{"kind": "seat_bonus", "chips": 500}'), (2, '{"kind": "hours_bonus", "chips": 500, "afterMinutes": 240}'),
                       (3, '{"kind": "bonus_chips", "chips": 500, "on": "referral"}'), (4, '{"kind": "bonus_chips", "chips": 500, "on": "signup"}'),
                       (5, '{"kind": "bonus_chips", "chips": 500, "on": "visit"}'), (6, '{"kind": "waitlist_priority"}')) r (n, reward) order by r.n $$,
  $$ values ('seated'::text), ('hours_step'), ('referral'), ('signup'), ('visit'), ('visit') $$,
  'each reward that stays is given for its own event: a seat, a step of hours played, a referral, a sign-up, a visit');

-- No venue has the template, and adding the templates again brings none back.
select lives_ok($$ select private.add_promotion_templates(v.id) from public.venue v $$, 'the templates are added again');
select is_empty($$ select 1 from public.promotion where template_key = 'tuesday_bonus' or name = 'Buy-in bonus Tuesday' $$,
  'no venue has the Buy-in bonus Tuesday');
select is_empty($$ select 1 from public.promotion_version where reward ->> 'kind' = 'buyin_bonus' or reward ->> 'on' = 'first_buyin' $$,
  'and no version of any promotion gives on a buy-in');
select is_empty($$ select 1 from public.promotion_rule where trigger = 'buy_in' $$, 'nor does any rule');

select * from finish();
rollback;
