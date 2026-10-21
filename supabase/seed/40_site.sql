-- The website's first pages (#9), until marketing edits them in the console (C-020). The club's home
-- and Academy pages are published; a careers page is a draft; the practice venue's page proves the
-- website never shows the practice venue.

insert into public.site_page (id, venue_id, slug, title, description, nav_position, is_published) values
  ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-000000000001', 'home', 'RIVR Poker Club',
   'A members'' poker club in Gurugram. Opens Sunday 15 November.', null, true),
  ('00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-000000000001', 'academy', 'RIVR Academy',
   'Learn poker in a small batch with a RIVR coach.', 1, true),
  ('00000000-0000-4000-8000-0000000005a3', '00000000-0000-4000-8000-000000000001', 'careers', 'Careers', null, 2, false),
  ('00000000-0000-4000-8000-0000000005a4', '00000000-0000-4000-8000-000000000002', 'home', 'RIVR Practice', null, null, true)
on conflict (id) do nothing;

insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a2', 1, 'hero',
   '{"heading": "RIVR Academy", "text": "Learn the game in a small batch with a RIVR coach. Level 1 starts with the first batch.", "action": {"label": "Book a seat", "to": "academy"}}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a3', 1, 'text',
   '{"body": "Dealers and floor staff: openings soon."}'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000005a4', 1, 'text',
   '{"body": "Training only."}')
on conflict (page_id, position) do nothing;

-- The front page in the Grand Poker Arena style (#441, decision 0118). Until the console edits the website
-- (C-020), the seed owns it: every run, staging's deploy included, puts these blocks back as they are here.
update public.site_page
set title = 'RIVR Poker Club',
    description = 'Bring your poker face. A members'' poker club at Glaza, M3M 65th Avenue, Gurugram. Opens Sunday 15 November.'
where id = '00000000-0000-4000-8000-0000000005a1';

delete from public.site_block where page_id = '00000000-0000-4000-8000-0000000005a1';
insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 1, 'hero',
   '{"eyebrow": "RIVR Poker Club · Gurugram", "heading": "Bring your poker face.", "text": "A members'' poker club at Glaza, M3M 65th Avenue. Dealers at every table, a cage that pays out the same night, and a floor you follow from your phone. Opens Sunday 15 November.", "action": {"label": "Join RIVR", "to": "sign-up"}, "video": {"src": "/media/hero-room.mp4", "poster": "/media/hero-room.webp"}, "note": "Concept visualisation"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 2, 'statement',
   '{"eyebrow": "The RIVR difference", "lines": ["Not luck.", "A game of skill."], "text": "Cash games and tournaments dealt by casino-trained dealers, with every hand logged at the table."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 3, 'gallery',
   '{"eyebrow": "Inside RIVR", "heading": "Built for the long session.", "intro": "Everything around the table is looked after, so the game is all you think about.", "items": [{"image": "/media/members.webp", "alt": "A host greets members at the club''s door", "title": "A private members'' club", "text": "Members and their guests only."}, {"image": "/media/dealers.webp", "alt": "A dealer in a waistcoat deals at a table", "title": "Casino-trained dealers", "text": "Fast, accurate, fair."}, {"image": "/media/cashier.webp", "alt": "A cashier counts chips at the cage", "title": "Instant, secure cashier", "text": "Clean counts, paid out the same night."}, {"image": "/media/private-room.webp", "alt": "A private table under a single lamp", "title": "Private high-stakes room", "text": "Discreet, for bigger action."}, {"image": "/media/chefs-menu.webp", "alt": "A plate served beside a table in play", "title": "Complimentary chef''s menu", "text": "Served at your seat."}, {"image": "/media/pick-up.webp", "alt": "A chauffeur holds a car door outside the club at night", "title": "Pick-up and drop", "text": "Chauffeured rides for regulars."}, {"image": "/media/built-for-her.webp", "alt": "Friends laughing together at a table in the club", "title": "Built for her, too", "text": "A room where everyone is at home at the table."}, {"image": "/media/room.webp", "alt": "The main room under its chandeliers", "title": "The main room", "text": "A dealer at every table, every night."}], "note": "Concept visualisation"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 4, 'feature',
   '{"eyebrow": "The RIVR app", "heading": "Done waiting for a seat?", "text": "See tonight''s tables and their open seats, join the waitlist before you leave home, and get called to your seat.", "points": ["Live tables", "The waitlist", "Your seat, held"], "action": {"label": "Join the waitlist", "to": "waitlist"}, "image": "/media/app-home.webp", "alt": "The RIVR app''s Home: tonight''s tables with their open seats, the bad-beat jackpot and the next tournament"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 5, 'games',
   '{"heading": "Pick your table."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 6, 'calendar',
   '{"heading": "Tournaments"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 7, 'statement',
   '{"eyebrow": "Opens Sunday 15 November", "lines": ["Hold your nerve."], "text": "Upper floor, Glaza, M3M 65th Avenue, Gurugram.", "action": {"label": "Join RIVR", "to": "sign-up"}, "image": "/media/chips.webp", "note": "Concept visualisation"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 8, 'map',
   '{"heading": "Find us", "address": "Upper floor, Glaza, M3M 65th Avenue, Gurugram", "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"}');
