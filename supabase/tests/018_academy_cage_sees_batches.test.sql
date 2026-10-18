-- Who sees a venue's Academy batches in the console (#8): Academy staff and the cage, at their own
-- venue only; a dealer does not. 103 Aditya (admin), 104 Sana (cashier), 106 Pema (dealer).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.academy_batch (venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-000000000001', 'Closed club batch', current_date + 5, current_date + 6, 3, false),
  ('00000000-0000-4000-8000-000000000002', 'Closed practice batch', current_date + 5, current_date + 6, 3, false);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select ok((select count(*) from public.academy_batch where name = 'Closed club batch') = 1,
  'a cashier sees the club''s batches, closed ones too, to know what a payment is for');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select ok((select count(*) from public.academy_batch where name like 'Closed%') = 2, 'an admin sees them at each venue where they work');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select is((select count(*)::int from public.academy_batch where name like 'Closed%'), 0, 'a dealer sees none');
reset role;

select * from finish();
rollback;
