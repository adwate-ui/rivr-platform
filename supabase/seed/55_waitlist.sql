-- The design prompt's waitlist for 100/200: Kabir Sethi, Naina Kapoor, then Rohan Bhatia, joined
-- 15, 9 and 0 minutes before the seed ran. 50/100 is empty (#38).

insert into public.waitlist_entry (venue_id, member_id, table_type_id, joined_at, idempotency_key)
select tt.venue_id, w.member_id, tt.id, now() - w.ago, w.member_id
from (values
  ('00000000-0000-4000-8000-000000000202'::uuid, interval '15 minutes'),
  ('00000000-0000-4000-8000-000000000203'::uuid, interval '9 minutes'),
  ('00000000-0000-4000-8000-000000000204'::uuid, interval '0 minutes')
) as w (member_id, ago)
join public.table_type tt on tt.code = 'nlh_100_200' and tt.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict (venue_id, idempotency_key) do nothing;

-- Ishaan Verma, Vihaan Kapoor (a black card), Mihir Shah, Yash Gupta and Ritika Das have finished the
-- identity check, so the Waitlist, Self-exclusion, Seat events and Call time flows and a demo can put
-- them on a list or a seat.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'verified', 'digilocker',
   '1994-08-21', 'ABCPV2111K',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'verified', 'digilocker',
   '1988-02-14', 'ABCPK2122L',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000212/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'verified', 'digilocker',
   '1991-11-03', 'ABCPS2133M',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000213/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'verified', 'digilocker',
   '1996-05-30', 'ABCPG2144N',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000214/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'verified', 'digilocker',
   '1995-07-19', 'ABCPD2155P',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000215/selfie.jpg', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'verified', 'digilocker',
   '1987-03-08', 'ABCPM2166Q',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000216/selfie.jpg', now())
on conflict do nothing;

-- Waitlist priority (#40): the black card first on the list for its qualifying stake, then Founders'
-- Circle on every list, then join time.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select t.venue_id, 'waitlist.priority_weights', t.id::text, w.value, '-infinity', 'Seed'
from public.tier t
join (values ('Black card', '{"weight": 2, "only_at_qualifying_stake": true}'::jsonb),
             ('Founders'' Circle', '{"weight": 1, "only_at_qualifying_stake": false}'::jsonb)) as w (name, value) on w.name = t.name
on conflict (venue_id, key, subject, effective_from) do nothing;

-- The 20-minute hold for a called seat and a step-away (#63).
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'waitlist.hold_minutes', '', '{"minutes": 20}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;
