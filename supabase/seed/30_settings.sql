-- Rules in force from the start. Call time: two hours in the Private Room (features, "Call time").
-- Lane B adds the table types and the other tables' call time with its table seed.

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'call_time.minutes', 'private_room', '{"minutes": 120}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;
