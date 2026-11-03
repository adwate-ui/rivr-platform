-- No audience of women (owner, 3 Nov; decision 0497): the typed terms refuse it, no version names it, and the member
-- facts the engine and the replay weigh carry no gender.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.terms_for(p_audience text) returns boolean language sql as $$
  select private.is_promotion_terms(
    '{"kind": "bonus_chips", "chips": 500, "on": "visit"}',
    jsonb_build_object('stakes', 'all', 'tiers', 'all', 'audience', p_audience),
    '{"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}',
    '{"perMember": "per_day"}',
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;

select ok(pg_temp.terms_for('everyone') and pg_temp.terms_for('new_30d') and pg_temp.terms_for('lapsed'), 'everyone, new members and lapsed regulars are audiences');
select ok(not pg_temp.terms_for('women'), 'women is no audience');
select is_empty($$ select 1 from public.promotion_version where eligibility ->> 'audience' = 'women' $$, 'and no version names it');

select ok(not private.promo_is_eligible(
  '{"reward": {"kind": "bonus_chips", "chips": 500, "on": "visit"}, "eligibility": {"stakes": "all", "tiers": "all", "audience": "women"}, "schedule": {"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}}',
  '{"tierId": null, "daysSinceJoined": 200, "daysSinceLastVisit": 7, "isWoman": true}',
  '{"at": "2026-11-17T21:00:00+05:30", "stake": null, "tableId": null}'),
  'terms that still said women would match nobody, whatever a member carried');

select is((select count(*)::integer from public.member m where (private.promotion_member_facts(m.id)) ? 'isWoman'), 0,
  'the engine knows no member''s gender');
select is((select count(*)::integer from public.member m where (private.replay_member_facts(m.id, now())) ? 'isWoman'), 0,
  'nor does last week''s replay');

select * from finish();
rollback;
