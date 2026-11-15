-- "Bonus chips" reads "Bonus" (redesign RD-12): the words the database holds for a screen say it nowhere, at the club
-- and at a venue made afterwards; a promotion's name an admin typed is left as typed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is_empty($$ select key from public.feature where name ilike '%bonus chip%' or description ilike '%bonus chip%' $$, 'no feature is named for bonus chips');
select is((select name from public.feature where key = 'rewards.bonus'), 'Bonus', 'the balance is named Bonus');
select is_empty($$ select key from public.setting_key where description ilike '%bonus chip%' $$, 'no setting is described in bonus chips');
select is_empty($$ select name from public.promotion where name ilike '%bonus chip%' or detail ilike '%bonus chip%' $$, 'no promotion says bonus chips');
select is_empty($$ select name from public.promotion_version where name ilike '%bonus chip%' or detail ilike '%bonus chip%' $$, 'nor a version of one');
select is_empty($$ select b.id from public.site_block b where b.content::text ilike '%bonus chip%' $$, 'no block of a website says bonus chips');

select is((select p.detail from public.promotion p where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'referral'),
  '1,000 Bonus to each side', 'the club''s referral promotion reads 1,000 Bonus to each side');
select is((select p.name from public.promotion p where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'hours_bonus'),
  'Four-hour bonus', 'and its play-time promotion is named in sentence case');

-- How many of a venue's website blocks say these words.
create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and strpos(b.content::text, p_words) > 0;
$$;
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', '1,000 Bonus for each side of a referral'), 1, 'the club''s front page says 1,000 Bonus for each side');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Your Bonus is forfeited.'), 1, 'its page on deleting an account says the Bonus is forfeited');

-- A venue made afterwards: its templates and its website come with the word. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000004a0', 'RIVR Word', 'bonus-word', false, 'RIVR test', 'Test', 'TBW');
select private.add_website('00000000-0000-4000-8000-0000000004a0');
select is_empty($$ select name from public.promotion where venue_id = '00000000-0000-4000-8000-0000000004a0' and (name ilike '%bonus chip%' or detail ilike '%bonus chip%') $$,
  'a new venue''s promotions say no bonus chips');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-0000000004a0' and b.content::text ilike '%bonus chip%'), 0, 'nor does its website');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000004a0', '1,000 Bonus for each side of a referral'), 1, 'which says 1,000 Bonus for each side');

-- A club's own words around the word keep their place: only "bonus chips" changes, and a second run changes nothing.
update public.site_block b
set content = replace(b.content::text, '"1,000 Bonus for each side of a referral"', '"1,000 bonus chips for each side, paid the same night"')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000004a0' and strpos(b.content::text, '1,000 Bonus for each side') > 0;
select private.website_says_bonus('00000000-0000-4000-8000-0000000004a0');
select private.website_says_bonus('00000000-0000-4000-8000-0000000004a0');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000004a0', '1,000 Bonus for each side, paid the same night'), 1, 'a line the club wrote keeps its own words around the word');

-- Only the system runs it.
select is(has_function_privilege('authenticated', 'private.website_says_bonus(uuid)', 'execute'), false, 'a signed-in person cannot run the change');

select * from finish();
rollback;
