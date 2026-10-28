-- The Winner card flow's card (#155): Kavya Rao won the Weeknight Turbo, and the nightly job has drawn her card. The seed
-- holds no file in Storage (a listed object with no file breaks the backup); the flow uploads the image as the job would.
insert into public.winner_card (id, venue_id, member_id, kind, source_id, details, prize_paise, won_at, image_path)
values ('00000000-0000-4000-8000-0000000009c1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000639', 'tournament',
        '00000000-0000-4000-8000-0000000007a2', '{"event_name": "Weeknight Turbo"}', 12000000, now() - interval '1 day',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000009c1.png')
on conflict do nothing;
