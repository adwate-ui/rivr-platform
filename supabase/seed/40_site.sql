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
-- (C-020), the seed owns it: every run, staging's deploy included, puts its title back as it is here.
update public.site_page
set title = 'RIVR Poker Club',
    description = 'Bring your poker face. A members'' poker club at Glaza, M3M 65th Avenue, Gurugram. Opens Sunday 15 November.'
where id = '00000000-0000-4000-8000-0000000005a1';

-- Its blocks, band by band, are 43_site_gpa.sql's (decision 0166).
