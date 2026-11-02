-- The website's launch text (W-01, W-05, W-06): the front page without its repeated bands, the full privacy notice and
-- terms, and the Academy's page; a club's own words stay; a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = p_slug and strpos(b.content::text, p_words) > 0;
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
select is((select max(b.position) - count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home'), 0, 'and the bands left close up, with no gaps');

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'What RIVR keeps'), 1, 'the privacy notice says what RIVR keeps');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'Data Protection Board of India'), 1, 'and where to complain');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'Each night''s backup is kept for 35 days'), 1, 'and keeps its backups note');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'publishes its full terms'), 0, 'the terms are no longer a promise');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'courts at Gurugram'), 1, 'they are the terms');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'academy', 'playing full hands with a coach'), 1, 'the Academy page says what Level 1 teaches');

-- A page the club wrote is left alone, and running it again changes nothing.
update public.site_block b set content = jsonb_build_object('heading', 'Our privacy', 'body', 'The club''s own notice.')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy' and b.position = 2;
select private.website_launch_text('00000000-0000-4000-8000-000000000001');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'privacy', 'The club''s own notice.'), 1, 'a notice the club wrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'academy', 'playing full hands with a coach'), 1, 'and the Academy page is not added twice');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000b0', 'RIVR Launch', 'launch-text', false, 'RIVR test', 'Test', 'TLT');
select private.add_website('00000000-0000-4000-8000-0000000000b0');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'home', 'Play. Connect. Belong.'), 0, 'a new club''s front page comes trimmed');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'terms', 'courts at Gurugram'), 1, 'with its terms');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'privacy', 'What RIVR keeps'), 1, 'its privacy notice');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'academy', 'Who can join'), 1, 'and its Academy page');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000b0', 'house-rules', 'held for 20 minutes'), 1, 'and still the 20-minute seat hold');

select * from finish();
rollback;
