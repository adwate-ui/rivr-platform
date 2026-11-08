-- The website's identity check as the club runs it (8 Nov audit, I-09): a selfie in the app and the desk's check of the
-- Aadhaar and PAN on the first visit, with no DigiLocker or Cashfree anywhere; the privacy notice lists what the desk
-- records; a club's own words stay; running it again changes nothing; and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks, on one page or on all (null), say these words.
create function pg_temp.saying(p_venue_id uuid, p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and (p_slug is null or p.slug = p_slug) and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'DigiLocker'), 0, 'no page of the club''s website names DigiLocker');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'Cashfree'), 0, 'nor Cashfree');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'membership',
  'A selfie in the app, then your Aadhaar and PAN at the front desk on your first visit.'), 1, 'Membership''s step 02 is the selfie, then the desk');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'membership', 'your Aadhaar and PAN for the front desk'), 1,
  'and its questions say what to bring');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'an ID check at the front desk before you take a seat'), 1,
  'the front page''s Members only card says the same');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'On your first visit, bring your Aadhaar and PAN'), 1,
  'and its question on becoming a member');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'questions', 'bring your Aadhaar and PAN to the front desk on your first visit'), 1,
  'as do Questions');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'about', 'bring your Aadhaar and PAN to the front desk on your first visit'), 1,
  'and About');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'a check of your Aadhaar and PAN at the front desk on your first visit'), 1,
  'and the terms');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'a photo the desk takes of you, your date of birth, your PAN and the last four digits of your Aadhaar.'), 1,
  'the privacy notice lists what the desk records');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'your address'), 0, 'and no address, which the desk does not take');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'each for the service it gives. WhatsApp, from Meta,'), 1,
  'its providers run on without a gap where Cashfree was');

-- Running it again changes nothing.
create temp table site_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_identity_at_the_desk('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from site_before $$, 'running it again leaves the website as it is');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c0', 'RIVR Desk', 'desk-check', false, 'RIVR test', 'Test', 'TDK');
select private.add_website('00000000-0000-4000-8000-0000000000c0');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c0', null, 'DigiLocker'), 0, 'a new club''s website names no DigiLocker');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c0', null, 'Cashfree'), 0, 'nor Cashfree');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c0', 'membership', 'A selfie in the app, then your Aadhaar and PAN'), 1,
  'and its Membership says the selfie, then the desk');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c0', 'journal', 'Is poker legal in Gurugram?'), 1, 'with the website it came with before');

-- A club's own words stay, even where they still name DigiLocker.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c1', 'RIVR Own Steps', 'own-steps', false, 'RIVR test', 'Test', 'TOS');
select private.add_website_with_journal_legal_card('00000000-0000-4000-8000-0000000000c1');
update public.site_block b
set content = replace(b.content::text, '"With DigiLocker and a selfie. You must be 18 or over."', '"With DigiLocker, a selfie and a smile."')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c1' and p.slug = 'membership';
select private.website_identity_at_the_desk('00000000-0000-4000-8000-0000000000c1');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c1', 'membership', 'With DigiLocker, a selfie and a smile.'), 1, 'a step the club wrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c1', 'terms', 'DigiLocker'), 0, 'while the lines as shipped change');

select is((select count(*)::integer from public.site_page p join public.venue v on v.id = p.venue_id where v.is_practice and p.slug = 'membership'), 0,
  'and the practice venue has no Membership page to change');

select * from finish();
rollback;
