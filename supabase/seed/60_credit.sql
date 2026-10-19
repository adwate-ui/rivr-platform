-- Credit lines (#73), local and staging only: limits above ₹1,00,000 wait for a super admin, three
-- visits before any limit, and ₹25,00,000 of open markers across the room at most. Production's are the
-- owner's. Kunal Mehra has been in three times this month, so the Credit flow can give him a limit.

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'credit.config', '', '{"approval_threshold_paise": 10000000, "minimum_visits": 3, "exposure_cap_paise": 250000000}',
       '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - d.ago, now() - d.ago + interval '5 hours', 'door'
from (values (interval '3 days'), (interval '10 days'), (interval '17 days')) as d (ago)
where not exists (select 1 from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000216');
