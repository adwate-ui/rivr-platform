-- Lane D builder's seed people (members 0000…0270 to 0299, staff 0170 to 0199). Self-contained, after
-- 10_people.sql; every statement is idempotent.
--
-- The practice venue's own Kabir Sethi, Naina Kapoor and Rohan Bhatia, so its 100/200 list waits as the
-- club's does (55_waitlist.sql, #54). Practice records never sign in: no login, numbers of their own.

insert into public.member (id, venue_id, full_name, phone)
values
  ('00000000-0000-4000-8000-000000000270', '00000000-0000-4000-8000-000000000002', 'Kabir Sethi', '+919000000270'),
  ('00000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000002', 'Naina Kapoor', '+919000000271'),
  ('00000000-0000-4000-8000-000000000272', '00000000-0000-4000-8000-000000000002', 'Rohan Bhatia', '+919000000272')
on conflict (id) do nothing;
