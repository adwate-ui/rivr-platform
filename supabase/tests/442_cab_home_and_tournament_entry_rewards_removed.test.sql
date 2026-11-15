-- The cab home and the tournament entry are no promotion's reward (redesign RD-23; the owner, 15 Nov, question 943): no
-- version holds one, no grant carries either perk, no venue has the Cab home template, and an old graduate's freeroll rule
-- stays on the old path. Waitlist priority, the one perk left, is given as before.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.terms_ok(p_reward jsonb) returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [1, 2, 3, 4, 5, 6, 7], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', '{"perMember": "per_day"}',
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;
select ok(not pg_temp.terms_ok('{"kind": "cab_home", "fromVisitInMonth": 4}'), 'a cab home is no reward');
select ok(not pg_temp.terms_ok('{"kind": "tournament_entry", "tournamentId": "RIVR Sunday"}'), 'nor a tournament entry');
select ok(pg_temp.terms_ok('{"kind": "waitlist_priority"}') and pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 500}')
          and pg_temp.terms_ok('{"kind": "hours_bonus", "chips": 500, "afterMinutes": 240}') and pg_temp.terms_ok('{"kind": "bonus_chips", "chips": 500, "on": "referral"}'),
  'waitlist priority, a seat bonus, a play-time bonus and bonus chips still are');

-- What a visit gives: waitlist priority, and nothing for a reward that went.
select results_eq($$ select g.o_perk, g.o_refusal from private.promo_grant('{"kind": "waitlist_priority"}', '{"kind": "visit", "visitInMonth": 1}') g $$,
  $$ values ('waitlist_priority'::text, null::text) $$, 'a visit gives waitlist priority');
select is((select o_refusal from private.promo_grant('{"kind": "cab_home", "fromVisitInMonth": 1}', '{"kind": "visit", "visitInMonth": 4}')), 'other_event',
  'and no cab home, whichever visit of the month it is');
select is((select o_refusal from private.promo_grant('{"kind": "tournament_entry", "tournamentId": "RIVR Sunday"}', '{"kind": "visit", "visitInMonth": 1}')),
  'other_event', 'nor a tournament entry');

-- A grant carries waitlist priority or no perk.
create function pg_temp.grant_with(p_perk text) returns void language sql as $$
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, trigger, effect, cost_paise, chips, perk, source_key, period_key, club_day)
  select v.venue_id, v.promotion_id, v.id, '00000000-0000-4000-8000-000000000211', 'check_in', v.reward, 0, 0, p_perk, 'check_in:442:' || coalesce(p_perk, 'none'),
         'event:check_in:442:' || coalesce(p_perk, 'none'), private.club_day_of(now())
  from public.promotion_version v join public.promotion p on p.id = v.promotion_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'founders_priority';
$$;
select throws_ok($$ select pg_temp.grant_with('cab_home') $$, '23514', null, 'no grant carries a cab home');
select throws_ok($$ select pg_temp.grant_with('tournament_entry') $$, '23514', null, 'nor a tournament entry');
select lives_ok($$ select pg_temp.grant_with('waitlist_priority') $$, 'one carries waitlist priority');

-- No venue has the Cab home template, a new venue gets none, and no version gives either reward.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ac', 'RIVR Test', 'test-442', false, 'RIVR test', 'Test', 'TSC');
select lives_ok($$ select private.add_promotion_templates(v.id) from public.venue v $$, 'the templates are added again');
select is_empty($$ select 1 from public.promotion where template_key = 'cab' or name = 'Cab home' $$, 'no venue has the Cab home template, a new one included');
select is_empty($$ select 1 from public.promotion_version where reward ->> 'kind' in ('cab_home', 'tournament_entry') $$, 'and no version gives either');
select results_eq($$ select template_key from public.promotion where venue_id = '00000000-0000-4000-8000-0000000000ac' order by 1 $$,
  $$ values ('founders_priority'::text), ('hours_bonus'), ('referral') $$, 'a new venue starts with the three templates that stay');

-- An old graduate's freeroll rule is no version: it stays on the old path, as any rule the model cannot say.
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Graduate freeroll 442') returning id)
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
select '00000000-0000-4000-8000-000000000001', p.id, 'graduation', '{}', '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}' from p;
select lives_ok($$ select private.version_promotions('00000000-0000-4000-8000-000000000001') $$, 'the old promotions are made versions again');
select is_empty($$ select 1 from public.promotion_version v join public.promotion p on p.id = v.promotion_id where p.name = 'Graduate freeroll 442' $$,
  'a graduate''s freeroll rule becomes no version');

-- Where a promotion shows is its version's channels and nothing else.
select results_eq($$ select private.promotion_shows_on(p.id, 'playerApp'), private.promotion_shows_on(p.id, 'whatsapp')
                     from public.promotion p where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'referral' $$,
  $$ select (v.channels ->> 'playerApp')::boolean, (v.channels ->> 'whatsapp')::boolean
     from public.promotion_version v join public.promotion p on p.id = v.promotion_id and v.version = p.current_version
     where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'referral' $$,
  'a promotion shows on the channels its version names');

select * from finish();
rollback;
