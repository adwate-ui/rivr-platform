-- Text promotions (#1064, the owner, 17 Nov): words on a card alone, never a grant. Marketing (107 Kavya) drafts one and
-- submits it with no simulation; a super admin (101 Vikram) approves it; it shows on members' Home and the TVs; it is
-- weighed for no event, so it gives nothing and never waits for Bonus approval.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.terms_ok(p_reward jsonb, p_limits jsonb default '{"perMember": "none"}') returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [1, 2, 3, 4, 5, 6, 7], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', p_limits,
    '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
$$;
create temp table made (name text primary key, id uuid) on commit drop;
create temp table today on commit drop as select private.club_day_of(now()) as day;
grant select, insert on made to authenticated;
grant select on today to authenticated;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The terms.
select ok(pg_temp.terms_ok('{"kind": "text", "words": "Ladies'' night: free mocktails"}'), 'words on a card are a promotion''s terms');
select ok(not pg_temp.terms_ok('{"kind": "text"}'), 'a text promotion has its words');
select ok(not pg_temp.terms_ok(jsonb_build_object('kind', 'text', 'words', repeat('x', 201))), 'of 200 characters at most');
select ok(not pg_temp.terms_ok('{"kind": "text", "words": " Free mocktails "}'), 'trimmed');
select ok(not pg_temp.terms_ok('{"kind": "text", "words": "Free mocktails", "chips": 500}'), 'and nothing else');
select ok(not pg_temp.terms_ok('{"kind": "text", "words": "Free mocktails"}', '{"perMember": "per_visit"}'), 'with no limits, as it gives nothing');
select ok(not pg_temp.terms_ok('{"kind": "text", "words": "Free mocktails"}', '{"perMember": "none", "budgetChips": 5000}'), 'not even a budget');
select is(private.promotion_event_kind('{"kind": "text", "words": "Free mocktails"}'), 'none', 'it is weighed for no event');

-- Drafted and submitted with no simulation, then approved: live from today.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into made select 'draft', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', jsonb_build_object(
  'terms', jsonb_build_object('name', 'Mocktail night', 'reward', '{"kind": "text", "words": "Free mocktails at every table"}'::jsonb,
    'eligibility', '{"stakes": "all", "tiers": "all", "audience": "everyone"}'::jsonb,
    'schedule', jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (select day from today)::text, 'timezone', 'Asia/Kolkata'),
    'limits', '{"perMember": "none"}'::jsonb, 'channels', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}'::jsonb, 'rulesText', '[]'::jsonb),
  'detail', 'Free mocktails at every table', 'runs', 'all stakes · every day'));
select lives_ok($$ select public.submit_promotion_version((select id from made where name = 'draft')) $$, 'it is submitted with no simulation');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_version((select id from made where name = 'draft')) $$, 'a super admin approves it');
reset role;
select is((select status from public.promotion_version where id = (select id from made where name = 'draft')), 'live', 'and it is live from today');

-- It shows where cards show.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select detail from public.my_promotion_cards() where title = 'Mocktail night'), 'Free mocktails at every table', 'a member''s Home shows its words');
reset role;
select is((select count(*)::int from private.promotion_cards('00000000-0000-4000-8000-000000000001') c
           where c.title = 'Mocktail night' and private.promotion_shows_on(c.promotion_id, 'tv')), 1, 'and so do the club''s TVs');

-- A draft of any other kind still needs its simulation.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into made select 'chips', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', jsonb_build_object(
  'terms', jsonb_build_object('name', 'Visit bonus', 'reward', '{"kind": "bonus_chips", "chips": 500, "on": "visit"}'::jsonb,
    'eligibility', '{"stakes": "all", "tiers": "all", "audience": "everyone"}'::jsonb,
    'schedule', jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (select day from today)::text, 'timezone', 'Asia/Kolkata'),
    'limits', '{"perMember": "per_visit"}'::jsonb, 'channels', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}'::jsonb, 'rulesText', '[]'::jsonb),
  'detail', '500 Bonus on a visit', 'runs', 'all stakes · every day'));
select throws_ok($$ select public.submit_promotion_version((select id from made where name = 'chips')) $$, 'RVSIM', null,
  'a Bonus promotion is still simulated before it is submitted');
reset role;

-- It gives nothing: a reward of words refuses every event, and a visit while it is live grants nothing of it, so nothing
-- of it waits for Bonus approval either.
select is((select o_refusal from private.promo_grant('{"kind": "text", "words": "Free mocktails at every table"}',
            '{"kind": "visit", "key": "visit:532", "visitInMonth": 1}')), 'other_event', 'words on a card refuse a visit');
select lives_ok($$ select private.evaluate_promotion_versions('00000000-0000-4000-8000-000000000001', 'visit',
                     '{"member_id": "00000000-0000-4000-8000-000000000201", "key": "visit:532"}') $$, 'a member''s visit is weighed while it is live');
select is((select count(*)::int from public.promotion_grant g join public.promotion_version v on v.promotion_id = g.promotion_id
           where v.id = (select id from made where name = 'draft')), 0, 'and no grant is made of it');

select * from finish();
rollback;
