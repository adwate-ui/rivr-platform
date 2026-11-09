-- The website in words that stay true after the opening (8 Nov audit, I-93): no launch lines or placeholders; the terms keep
-- their date and the League its two cards (#710); every cards block keeps the two cards the website asks for; a club's own
-- words stay; running it again changes nothing; and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks, on one page or on all (null), say these words.
create function pg_temp.saying(p_venue_id uuid, p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and (p_slug is null or p.slug = p_slug) and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'Opens Sunday 15 November'), 0, 'nothing says the club opens on the 15th');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'opens on Sunday 15 November'), 0, 'in any words');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'from Sunday 15 November.'), 0, 'nor gives the hours from that day');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'terms', 'These terms apply from Sunday 15 November 2026.'), 1, 'the terms keep the day they apply from');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'before launch'), 0, 'no terms are promised before launch');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', '"14:00 to 08:00."'), 1, 'the front page gives the hours');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Open every night, 14:00 to 08:00'), 1, 'and its last band says them');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'RIVR began with one idea:'), 1, 'the story starts without the date');
select is((select count(*)::integer from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and description like '%15 November%'), 0, 'and no page''s description says it');

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'about', 'A full record'), 0, 'About has no empty card');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Smoking terrace'), 0, 'nor does The room');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', '"title": "Parking"'), 0, 'for parking either');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', '"title": "Getting here"'), 1, 'it leads to Visit instead');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug <> 'leaderboard' and strpos(b.content::text, 'Details to follow.') > 0), 0,
  'no page but the League says Details to follow');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'leaderboard', 'Details to follow.'), 1, 'and the League keeps its two cards, as the owner said (#710)');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and b.kind = 'cards' and jsonb_array_length(b.content -> 'cards') < 2), 0,
  'every cards block still has the two cards the website asks for');

-- The club made before.
create temp table site_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_evergreen_text('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from site_before $$, 'running it again leaves the website as it is');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c2', 'RIVR Evergreen', 'evergreen', false, 'RIVR test', 'Test', 'TEV');
select private.add_website('00000000-0000-4000-8000-0000000000c2');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', null, 'Opens Sunday 15 November'), 0, 'a new club''s website has no launch line');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', 'home', '"title": "Getting here"'), 1, 'and has The room''s card to Visit');

-- A club's own words stay: a hero it rewrote and a card it filled in.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c3', 'RIVR Own Words', 'own-words', false, 'RIVR test', 'Test', 'TOW');
select private.add_website_with_seat_calls_and_dropped_features('00000000-0000-4000-8000-0000000000c3');
update public.site_block b
set content = replace(b.content::text, 'from your phone. Opens Sunday 15 November."', 'from your phone. Opens Sunday 15 November, our way."')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'home';
update public.site_block b
set content = replace(b.content::text, '{"text": "Details to follow.", "title": "Parking"}', '{"text": "Valet at the door.", "title": "Parking"}')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'home';
select private.website_evergreen_text('00000000-0000-4000-8000-0000000000c3');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'home', 'Opens Sunday 15 November, our way.'), 1, 'a hero the club rewrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'home', 'Valet at the door.'), 1, 'and a card it filled in');

select * from finish();
rollback;
