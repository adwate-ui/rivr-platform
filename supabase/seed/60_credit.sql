-- Credit lines (#73), local and staging only: limits above ₹1,00,000 wait for a super admin, three
-- visits before any limit, and ₹25,00,000 of open markers across the room at most. Production's are the
-- owner's. Kunal Mehra and Neel Bose have been in three times this month, so the Credit and Markers
-- flows can give them limits.

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'credit.config', '', '{"approval_threshold_paise": 10000000, "minimum_visits": 3, "exposure_cap_paise": 250000000}',
       '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', p.member_id, now() - d.ago, now() - d.ago + interval '5 hours', 'door'
from (values ('00000000-0000-4000-8000-000000000216'::uuid), ('00000000-0000-4000-8000-000000000217'::uuid)) as p (member_id)
cross join (values (interval '3 days'), (interval '10 days'), (interval '17 days')) as d (ago)
where not exists (select 1 from public.visit v where v.member_id = p.member_id);

-- Markers fall due 30 days after they are issued (#74), local and staging.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'markers.due_days', '', '{"days": 30}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

-- Arjun Mehta (design prompt): a ₹2,00,000 limit, and the open ₹50,000 marker of 20_balances.sql,
-- issued 14 days ago.
insert into public.credit_line (venue_id, member_id, limit_paise, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 20000000, 'Seed: black card at 100/200')
on conflict (venue_id, member_id) do nothing;

insert into public.marker (venue_id, member_id, amount_paise, outstanding_paise, issued_at, due_at, signature_svg, ledger_transaction_id,
                           idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 5000000, 5000000, now() - interval '14 days', now() + interval '16 days',
       'M10 40 C 30 10, 50 70, 70 40 S 110 10, 130 40', t.id, '00000000-0000-4000-8000-00000000a201'
from public.ledger_transaction t
where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.idempotency_key = 'seed:arjun:marker'
on conflict (venue_id, idempotency_key) do nothing;
