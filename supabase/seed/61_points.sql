-- Points, local and staging only (#89; question #395 asks the owner for the real rates; production is
-- never seeded): 5 points an hour at 50/100, 10 at 100/200, 20 in the Private Room, and RIVR Rewards at
-- 5% of a member's rake, in both venues.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'points.per_hour', r.code, jsonb_build_object('points', r.points), '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
cross join (values ('nlh_50_100', 5), ('nlh_100_200', 10), ('private_room', 20)) as r (code, points)
on conflict (venue_id, key, subject, effective_from) do nothing;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'points.rewards_rake_share', '', '{"basis_points": 500}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;
