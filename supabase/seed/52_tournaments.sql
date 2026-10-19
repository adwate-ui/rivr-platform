-- The tournament calendar (#35): RIVR Sunday on opening day, from the design prompt (₹10,000
-- buy-in, ₹5,00,000 guaranteed), and a weeknight turbo. The practice venue's never reaches the
-- website. Lane B's seed (#54) adds the clock and entries.

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '2026-11-15 16:00:00+05:30',
   1000000, 50000000, true),
  ('00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-000000000001', 'Tuesday Turbo', '2026-11-17 20:00:00+05:30',
   300000, null, true),
  ('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-000000000002', 'Practice Sit and Go', '2026-11-14 15:00:00+05:30',
   100000, null, true)
on conflict (id) do nothing;

-- The front page shows tonight's games and the calendar, live.
insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 3, 'games', '{"heading": "Games and stakes"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a1', 4, 'calendar', '{"heading": "Tournaments"}')
on conflict (page_id, position) do nothing;
