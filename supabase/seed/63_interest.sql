-- Interest lists, local and staging only (#113, decision 0184; production is never seeded): four members
-- waiting for a game with no open table tell the floor to open one, in both venues.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'waitlist.interest_to_open', '', '{"players": 4}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;
