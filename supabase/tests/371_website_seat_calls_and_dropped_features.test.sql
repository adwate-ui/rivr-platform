-- The website without what the club no longer does (8 Nov audit, I-10): no open seats, a seat requested and called on
-- WhatsApp, no hand logging, no Academy; the 20-minute hold of house rule 5 stays; a club's own words stay; running it
-- again changes nothing; and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks, on one page or on all (null), say these words.
create function pg_temp.saying(p_venue_id uuid, p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and (p_slug is null or p.slug = p_slug) and strpos(b.content::text, p_words) > 0;
$$;
-- The titles of a page's tier cards, in order.
create function pg_temp.tiers(p_venue_id uuid, p_slug text) returns text[] language sql as $$
  select array_agg(c.card ->> 'title' order by c.n) from public.site_block b join public.site_page p on p.id = b.page_id,
    jsonb_array_elements(b.content -> 'cards') with ordinality as c (card, n)
  where p.venue_id = p_venue_id and p.slug = p_slug and b.content ->> 'heading' in ('Earned at the table. Not bought.', 'Earned at the table.');
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'home', 'Request a seat before you leave home. When one opens, the floor calls you on WhatsApp.'), 1,
  'the front page''s app band says a seat is requested and called on WhatsApp');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'open seats, join'), 0, 'and promises no open seats');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, '"label": "Join the waitlist"'), 0, 'no link says Join the waitlist');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, '{"to": "waitlist", "label": "Open the app"}'), 2, 'the band''s and the links page''s say Open the app');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'membership', 'Request a seat from the app. The floor calls you on WhatsApp when one opens.'), 1,
  'Membership says the same');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'questions', 'the floor calls you on WhatsApp when a seat opens'), 1, 'as Questions does');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', null, 'log every hand'), 0, 'no dealer logs every hand');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'about', 'Trained dealers at every table, a cage'), 1, 'the About story keeps its dealers');
select is(pg_temp.tiers('00000000-0000-4000-8000-000000000001', 'home'), array['Member', 'Founders'' Circle', 'Black card'], 'the front page''s tiers have no Academy graduate');
select is(pg_temp.tiers('00000000-0000-4000-8000-000000000001', 'membership'), array['Member', 'Founders'' Circle', 'Black card'], 'nor do Membership''s');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', s.slug, 'Academy'), 0, format('the %s page names no Academy', s.slug))
from (values ('home'), ('questions'), ('membership'), ('privacy')) as s (slug);
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'questions', 'Can I learn to play here?'), 1, 'Questions still answers whether a new player can learn');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'house-rules', 'A seat is held for 20 minutes once it is called.'), 1, 'house rule 5 keeps its 20-minute hold');
select is((select description from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and slug = 'links'),
  'Request a seat, tonight''s games and how to find us.', 'the links page is described without the Academy');

-- Running it again changes nothing.
create temp table site_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_seat_calls_and_dropped_features('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from site_before $$, 'running it again leaves the website as it is');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c2', 'RIVR Call', 'seat-call', false, 'RIVR test', 'Test', 'TSC');
select private.add_website('00000000-0000-4000-8000-0000000000c2');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', 'home', 'the floor calls you on WhatsApp'), 1, 'a new club''s app band says the call');
select is(pg_temp.tiers('00000000-0000-4000-8000-0000000000c2', 'membership'), array['Member', 'Founders'' Circle', 'Black card'],
  'and its tiers have no Academy graduate');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', null, 'DigiLocker'), 0, 'with the desk''s identity check before it');

-- A club's own words stay: a tier card it rewrote and an app band it wrote.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c3', 'RIVR Own Tiers', 'own-tiers', false, 'RIVR test', 'Test', 'TOT');
select private.add_website_with_identity_at_the_desk('00000000-0000-4000-8000-0000000000c3');
update public.site_block b
set content = replace(b.content::text, '"For members who finish RIVR Academy: a bonus on their first buy-in after they graduate."',
                      '"For our Academy''s graduates."')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'home';
update public.site_block b
set content = replace(b.content::text, 'get called to your seat."', 'get called to your seat, our way."')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'home';
select private.website_seat_calls_and_dropped_features('00000000-0000-4000-8000-0000000000c3');
select is(pg_temp.tiers('00000000-0000-4000-8000-0000000000c3', 'home'), array['Member', 'Academy graduate', 'Founders'' Circle', 'Black card'],
  'a tier card the club rewrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'home', 'get called to your seat, our way.'), 1, 'and an app band it wrote');
select is(pg_temp.tiers('00000000-0000-4000-8000-0000000000c3', 'membership'), array['Member', 'Founders'' Circle', 'Black card'],
  'while the cards as shipped go');

select * from finish();
rollback;
