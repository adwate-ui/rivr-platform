-- The website reads the club's rules in force (#617): public_club_rules shows only the rules a visitor may read, each as in
-- force now (not one still to come), by table type with its name. It shows the cab while a tier has cab requests, never
-- the practice venue's rules, and League prizes in words, which league.prizes holds to their shape.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table club as
select '00000000-0000-4000-8000-000000000001'::uuid as venue_id,
       (select code from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' order by big_blind_paise limit 1) as code,
       (select name from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' order by big_blind_paise limit 1) as name,
       (select slug from public.venue where id = '00000000-0000-4000-8000-000000000002') as practice_slug;
grant select on club to anon;

insert into public.setting (venue_id, key, subject, value, effective_from)
select venue_id, 'points.per_hour', code, '{"points": 7}'::jsonb, now() - interval '1 second' from club
union all select venue_id, 'points.per_hour', code, '{"points": 99}'::jsonb, now() + interval '1 day' from club
union all select venue_id, 'league.prizes', '', '{"month": "Top three win a seat in the season final"}'::jsonb, now() - interval '1 second' from club
union all select venue_id, 'rakeback.rate', code, '{"basis_points": 1000, "cap_paise": 500000, "expires_days": 7}'::jsonb, now() - interval '1 second' from club
union all select '00000000-0000-4000-8000-000000000002', 'points.rewards_rake_share', '', '{"basis_points": 900}'::jsonb, now() - interval '1 second';

select columns_are('public', 'public_club_rules', array['venue_slug', 'key', 'subject', 'subject_name', 'subject_order', 'value'],
  'public_club_rules shows the venue, the rule, what it applies to and its value, nothing more');

set local role anon;
select is((select value from public.public_club_rules r, club c where r.key = 'points.per_hour' and r.subject = c.code),
  '{"points": 7}'::jsonb, 'a rule shows as in force now, not as it will be tomorrow');
select is((select subject_name from public.public_club_rules r, club c where r.key = 'points.per_hour' and r.subject = c.code),
  (select name from club), 'a table type''s rule carries the table type''s name');
select is((select value from public.public_club_rules r, club c where r.key = 'rakeback.rate' and r.subject = c.code), '{"basis_points": 1000}'::jsonb,
  'rakeback shows its rate alone, not its cap or how long its bonus lasts');
select is((select value ->> 'month' from public.public_club_rules where key = 'league.prizes'), 'Top three win a seat in the season final',
  'the League''s prizes show in words');
select is((select count(*) from public.public_club_rules where key not in ('points.per_hour', 'rakeback.rate', 'accommodation.hours_per_night',
  'points.rewards_rake_share', 'jackpot.payout', 'high_hand.payouts', 'league.prizes', 'cab.minimum_visits')), 0::bigint,
  'no other rule shows, such as the rake or the cage''s limits');
select is((select count(*) from public.public_club_rules where venue_slug = (select practice_slug from club)), 0::bigint,
  'the practice venue''s rules never show');
reset role;

insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select c.venue_id, t.id, 'cab.requests', t.id = (select id from public.tier where venue_id = c.venue_id order by id limit 1), now() - interval '1 second'
from public.tier t, club c where t.venue_id = c.venue_id;
create temporary table cab_rule as select jsonb_build_object('visits', private.cab_minimum_visits(venue_id)) as value from club;
grant select on cab_rule to anon;
set local role anon;
select is((select value from public.public_club_rules where key = 'cab.minimum_visits'), (select value from cab_rule),
  'the cab shows at the visits the app offers it at, while one tier has cab requests');
reset role;

insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select c.venue_id, t.id, 'cab.requests', false, now() - interval '1 millisecond' from public.tier t, club c where t.venue_id = c.venue_id;
set local role anon;
select is((select count(*) from public.public_club_rules where key = 'cab.minimum_visits'), 0::bigint, 'and not once no tier has them');
reset role;

select throws_ok(
  $$ insert into public.setting (venue_id, key, subject, value, effective_from)
     values ('00000000-0000-4000-8000-000000000001', 'league.prizes', '', '{"month": "A seat", "week": "A seat"}', now() + interval '2 days') $$,
  null, null, 'league.prizes holds only this month''s and this season''s prizes');

select * from finish();
rollback;
