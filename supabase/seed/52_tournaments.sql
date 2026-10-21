-- The tournament calendar (#35): RIVR Sunday on opening day, from the design prompt (₹10,000
-- buy-in, ₹5,00,000 guaranteed), and a weeknight turbo a week from each seeding (staging seeds on
-- every deploy), so the calendar always has a coming tournament. The practice venue's never reaches
-- the website. The clock and entries come with the tournament clock (#119).

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '2026-11-15 16:00:00+05:30',
   1000000, 50000000, true),
  ('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-000000000002', 'Practice Sit and Go', '2026-11-14 15:00:00+05:30',
   100000, null, true)
on conflict (id) do nothing;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-000000000001', 'Weeknight Turbo',
   ((now() at time zone 'Asia/Kolkata')::date + 7 + time '20:00') at time zone 'Asia/Kolkata', 300000, null, true)
on conflict (id) do update set starts_at = excluded.starts_at;

-- The front page shows tonight's games and this calendar, live: 40_site.sql places them (#441).
