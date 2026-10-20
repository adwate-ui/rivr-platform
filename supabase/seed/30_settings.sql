-- Rules in force from the start. Call time: two hours in the Private Room (features, "Call time").
-- Lane B adds the table types and the other tables' call time with its table seed.

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'call_time.minutes', 'private_room', '{"minutes": 120}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

-- Academy fees: ₹2,000 a seat, ₹1,500 a head for a company (scope-v1 module 15).
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'academy.price', '', '{"individual_paise": 200000, "corporate_per_head_paise": 150000}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;

-- The club's UPI, where Academy fees are paid (fictional, for local and staging).
update public.venue_config set upi_vpa = 'rivr.gurugram@icici', upi_payee_name = 'RIVR'
where venue_id = '00000000-0000-4000-8000-000000000001' and upi_vpa is null;
update public.venue_config set upi_vpa = 'rivr.practice@icici', upi_payee_name = 'RIVR practice'
where venue_id = '00000000-0000-4000-8000-000000000002' and upi_vpa is null;

-- An Academy batch a month out, so there is always one to book.
insert into public.academy_batch (venue_id, name, starts_on, ends_on, seats)
select v.venue_id, 'Level 1', current_date + 30, current_date + 32, 12
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
where not exists (select 1 from public.academy_batch b where b.venue_id = v.venue_id);

-- Dual control (#20): a withdrawal of ₹1,00,000 or more needs a second approver (design prompt flow 9).
-- Local and staging; production's is the owner's.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'cage.second_approver_threshold', '', '{"threshold_paise": 10000000}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;