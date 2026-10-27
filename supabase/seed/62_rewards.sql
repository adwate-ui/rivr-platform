-- The rewards catalogue and the League, local and staging only (#145, #147; question #452 asks the owner
-- for the real League points; production is never seeded). One reward of each kind at the club and one
-- at the practice venue; League points of 100, 70 and 50 for the podium, 20 for the rest of the final
-- table and 5 for taking part, in both venues; and a six-month season at the club from this month.
insert into public.reward_item (id, venue_id, kind, name, detail, points, nights, stock)
values
  ('00000000-0000-4000-8000-000000145001', '00000000-0000-4000-8000-000000000001', 'tournament_seat', 'Sunday Main Event seat',
   'Registered to you at the cage', 12000, null, 18),
  ('00000000-0000-4000-8000-000000145002', '00000000-0000-4000-8000-000000000001', 'fnb_upgrade', 'Bar upgrade, one night',
   'At the Glaza bar', 2500, null, null),
  ('00000000-0000-4000-8000-000000145003', '00000000-0000-4000-8000-000000000001', 'merchandise', 'RIVR hoodie',
   'At the host desk', 4000, null, 42),
  ('00000000-0000-4000-8000-000000145004', '00000000-0000-4000-8000-000000000001', 'hotel_night', 'Partner hotel suite, one night',
   'The host confirms by text', null, 1, 6),
  ('00000000-0000-4000-8000-000000145005', '00000000-0000-4000-8000-000000000002', 'merchandise', 'Practice T-shirt',
   'At the practice desk', 100, null, null)
on conflict (id) do nothing;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'league.points', '', '{"first": 100, "second": 70, "third": 50, "final_table": 20, "entry": 5}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

insert into public.league_season (id, venue_id, name, first_month, last_month)
values ('00000000-0000-4000-8000-000000147001', '00000000-0000-4000-8000-000000000001', 'Season one',
        private.league_month(now()), (private.league_month(now()) + interval '5 months')::date)
on conflict (id) do nothing;
