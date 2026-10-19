-- The link-in-bio page (#39) at /links, for every social profile's one link: join the waitlist,
-- tonight's games with how many wait, the Academy and how to find the club. Out of the navigation.

insert into public.site_page (id, venue_id, slug, title, description, nav_position, is_published) values
  ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-000000000001', 'links', 'RIVR Poker Club',
   'Join the waitlist, tonight''s games, RIVR Academy and how to find us.', null, true)
on conflict (id) do nothing;

insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005c1', 1, 'hero',
   '{"heading": "RIVR Poker Club", "text": "A members'' poker club on the upper floor of Glaza, Gurugram."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005c1', 2, 'links', $${
    "links": [
      {"label": "Join the waitlist", "to": "waitlist"},
      {"label": "Book RIVR Academy", "to": "academy"},
      {"label": "Join RIVR", "to": "sign-up"}
    ]
  }$$),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005c1', 3, 'games', '{"heading": "Tonight''s games"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005c1', 4, 'map', $${
    "heading": "Find us",
    "address": "Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram",
    "hours": "Open 14:00 to 08:00.",
    "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"
  }$$)
on conflict (page_id, position) do nothing;
