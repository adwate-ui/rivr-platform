-- The website's launch text (W-01, W-05, W-06): the front page without its repeated bands, the full privacy notice and
-- terms, and the Academy's page; a club's own words stay; running it again changes nothing; a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = p_slug and strpos(b.content::text, p_words) > 0;
$$;
create function pg_temp.gaps(p_venue_id uuid) returns integer language sql as $$
  select max(b.position) - count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'home';
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Play. Connect. Belong.'), 0, 'the front page no longer says Play. Connect. Belong.');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'The RIVR difference'), 0, 'nor the RIVR difference');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Looked after, every hour.'), 0, 'nor Hospitality');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'A game of skill, on the record.'), 0, 'nor the legal timeline');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home' and b.kind = 'marquee'), 0, 'nor the phrase strip');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Built for the long session.'), 1, 'and keeps its other bands');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room'
             and strpos(b.content::text, 'Ask the front desk for a cab home.') > 0), 1, 'the cab home moved to The room''s cards');
select is(pg_temp.gaps('00000000-0000-4000-8000-000000000001'), 0, 'and the bands left close up, with no gaps');

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'What RIVR keeps'), 1, 'the privacy notice says what RIVR keeps');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'RIVR tells Meta and Google'), 1, 'and who measures its adverts, with the offers yes');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'Data Protection Board of India'), 1, 'and where to complain');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'Each night''s backup is kept for 35 days'), 1, 'and keeps its backups note');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'publishes its full terms'), 0, 'the terms are no longer a promise');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'courts at Gurugram'), 1, 'they are the terms');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'academy', 'how a hand is run at a club table'), 1, 'the Academy page says what Level 1 teaches');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'academy', 'ask at the front desk'), 1, 'and how to join a batch, while the app does not book one');

-- Running it again changes nothing: the cab home is not added twice and no band moves; a notice the club wrote is kept.
create temp table home_before as
  select b.id, b.position, b.content from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home';
update public.site_block b set content = jsonb_build_object('heading', 'Our privacy', 'body', 'The club''s own notice.')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy' and b.position = 2;
select private.website_launch_text('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.position, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home' $$,
              $$ select id, position, content from home_before $$, 'running it again leaves the front page as it is');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Ask the front desk for a cab home.'), 1, 'with the cab home once');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'The club''s own notice.'), 1, 'a notice the club wrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'academy', 'how a hand is run at a club table'), 1, 'and the Academy page is not added twice');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000b0', 'RIVR Launch', 'launch-text', false, 'RIVR test', 'Test', 'TLT');
select private.add_website('00000000-0000-4000-8000-0000000000b0');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'home', 'Play. Connect. Belong.'), 0, 'a new club''s front page comes trimmed');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'terms', 'courts at Gurugram'), 1, 'with its terms');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'privacy', 'What RIVR keeps'), 1, 'its privacy notice');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'academy', 'Who can join'), 1, 'and its Academy page');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'house-rules', 'held for 20 minutes'), 1, 'and still the 20-minute seat hold');

-- A club's own words stay: a band it renamed, The room renamed (so the cab home has nowhere to go and Hospitality stays),
-- and terms and an Academy page it wrote.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000b1', 'RIVR Own Words', 'own-words', false, 'RIVR test', 'Test', 'TOW');
select private.add_website_with_seat_hold_rule('00000000-0000-4000-8000-0000000000b1');
update public.site_block b set content = jsonb_set(b.content, '{eyebrow}', to_jsonb(case b.content ->> 'eyebrow'
    when 'The RIVR difference' then 'What sets us apart' else 'Our room' end))
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000b1' and p.slug = 'home' and b.content ->> 'eyebrow' in ('The RIVR difference', 'The room');
update public.site_block b set content = jsonb_set(b.content, '{body}', '"The club''s own terms."')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000b1' and p.slug = 'terms' and b.position = 2;
update public.site_block b set content = jsonb_set(b.content, '{heading}', '"Learn with us"')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000b1' and p.slug = 'academy' and b.kind = 'hero';
select private.website_launch_text('00000000-0000-4000-8000-0000000000b1');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'home', 'What sets us apart'), 1, 'a band the club renamed stays');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'home', 'Looked after, every hour.'), 1, 'Hospitality stays while The room cannot take its cab home');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'home', 'Ask the front desk for a cab home.'), 1, 'so the cab home is on the page once');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'home', 'Play. Connect. Belong.'), 0, 'the bands still as shipped go');
select is(pg_temp.gaps('00000000-0000-4000-8000-0000000000b1'), 0, 'and the rest close up');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'terms', 'The club''s own terms.'), 1, 'terms the club wrote are kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'terms', 'courts at Gurugram'), 0, 'and not replaced');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b1', 'academy', 'Who can join'), 0, 'an Academy page the club changed is left alone');

select * from finish();
rollback;
