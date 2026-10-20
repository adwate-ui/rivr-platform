-- Each venue's cage has a shift open, as it would during a night, so the flows and a demo can take buy-ins,
-- cash-outs, markers and payments: the cage refuses every money move while none is open (#376).
-- - The club's: opened by Rohit Chauhan, the Treasury flow's cashier, with ₹12,00,000 in the drawer and
--   ₹6,50,000 of chips in the cage (#24).
-- - The practice venue's: opened by Pooja Nair, the End of day flow's cashier, with ₹1,00,000 and ₹55,000 of
--   chips, which that flow closes (#45). The Cage shift flow, after it, finds the practice cage closed.
-- A venue that already has a shift open (staging, seeded again) keeps it.
with opening (venue_id, user_id, float_paise, key, quantities) as (
  values ('00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000140'::uuid, 120000000::bigint,
          '00000000-0000-4000-8000-0000000c5001'::uuid, array[400, 300, 200, 100, 40, 8]),
         ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000141'::uuid, 10000000::bigint,
          '00000000-0000-4000-8000-0000000c5002'::uuid, array[100, 100, 20, 10, 4, 0])
), shift as (
  insert into public.cage_shift (venue_id, float_paise, opened_by_staff_id, idempotency_key)
  select o.venue_id, o.float_paise, s.id, o.key
  from opening o
  join public.staff s on s.venue_id = o.venue_id and s.user_id = o.user_id
  where not exists (select 1 from public.cage_shift c where c.venue_id = o.venue_id and c.closed_at is null)
  on conflict (venue_id, idempotency_key) do nothing
  returning id, venue_id, opened_by_staff_id, idempotency_key
), opening_count as (
  insert into public.chip_inventory_count (venue_id, shift_id, counted_by_staff_id, idempotency_key)
  select venue_id, id, opened_by_staff_id, idempotency_key from shift
  returning id, venue_id, idempotency_key
)
insert into public.chip_inventory_line (count_id, venue_id, value_paise, quantity)
select c.id, c.venue_id, d.value_paise, q.quantity
from opening_count c
join opening o on o.key = c.idempotency_key
cross join lateral unnest(array[5000, 10000, 50000, 100000, 500000, 2500000]::bigint[], o.quantities) as q (value_paise, quantity)
join public.chip_denomination d on d.venue_id = c.venue_id and d.value_paise = q.value_paise and d.is_active;
