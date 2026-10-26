-- The practice venue's page, which proves the website never shows the practice venue (#9). The club's
-- website comes with the venue (private.add_website; #406, #472, decision 0195), as it does in production.

insert into public.site_page (id, venue_id, slug, title, description, nav_position, is_published) values
  ('00000000-0000-4000-8000-0000000005a4', '00000000-0000-4000-8000-000000000002', 'home', 'RIVR Practice', null, null, true)
on conflict (id) do nothing;

insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000005a4', 1, 'text',
   '{"body": "Training only."}')
on conflict (page_id, position) do nothing;
