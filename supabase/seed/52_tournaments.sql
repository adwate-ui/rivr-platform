-- The tournament calendar (#35; interest only since the redesign of 15 Nov 2026, issue 969): RIVR Sunday on opening
-- day, a weeknight turbo a week from each seeding (staging seeds on every deploy), so there is always one to come, and
-- Diwali Deepstack, a past one with its notification sent and its entries typed. The practice venue's never reaches the
-- website.
insert into public.tournament (id, venue_id, name, starts_at, game, is_published) values
  ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '2026-11-15 16:00:00+05:30',
   'No-Limit Hold’em', true),
  ('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-000000000002', 'Practice Sit and Go', '2026-11-14 15:00:00+05:30',
   'No-Limit Hold’em', true),
  ('00000000-0000-4000-8000-0000000007a4', '00000000-0000-4000-8000-000000000001', 'Diwali Deepstack', '2026-11-05 18:00:00+05:30',
   'No-Limit Hold’em', true)
on conflict (id) do nothing;

insert into public.tournament (id, venue_id, name, starts_at, game, is_published) values
  ('00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-000000000001', 'Weeknight Turbo',
   ((now() at time zone 'Asia/Kolkata')::date + 7 + time '20:00') at time zone 'Asia/Kolkata', 'No-Limit Hold’em', true)
on conflict (id) do update set starts_at = excluded.starts_at;

-- Ajay Dhillon, the Tournaments flow's own member, asked to be told of Diwali Deepstack, so it is in his Sessions; Leela
-- Pillai, the flow's admin, sent its notification, and 61 entered.
insert into public.tournament_interest (venue_id, tournament_id, member_id, created_at)
select m.venue_id, '00000000-0000-4000-8000-0000000007a4', m.id, '2026-11-03 12:00:00+05:30'
from public.member m
where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.phone = '+919000000408'
on conflict (tournament_id, member_id) do nothing;

update public.tournament t
set notified_at = '2026-11-04 12:00:00+05:30', notified_count = 1, notified_by_staff_id = s.id, entries = 61
from public.staff s
where t.id = '00000000-0000-4000-8000-0000000007a4' and t.notified_at is null
  and s.venue_id = t.venue_id and s.phone = '+919000000116';

-- The front page shows tonight's games and this calendar, live: the website places them (private.add_website, #441).
