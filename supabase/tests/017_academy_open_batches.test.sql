-- The batches a member can book (#8): their venue's open batches that have not started, with the seats
-- left and the fee. 201 Arjun, 202 Kabir (members of the club), 301 Asha (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.academy_batch (id, venue_id, name, starts_on, ends_on, seats, is_open) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Open', current_date + 5, current_date + 6, 3, true),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'Closed', current_date + 5, current_date + 6, 3, false),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'Started', current_date - 1, current_date + 1, 3, true);
insert into public.academy_booking (venue_id, batch_id, member_id, kind, seats, amount) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000202', 'individual', 1, 200000);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select results_eq(
  $$ select name, seats_left, fee from public.academy_open_batches() where name in ('Open', 'Closed', 'Started') $$,
  $$ values ('Open'::text, 2, 200000::bigint) $$,
  'a member sees open batches that have not started, with the seats others took counted and the fee');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000301", "role": "authenticated"}';
select is_empty($$ select * from public.academy_open_batches() where name = 'Open' $$, 'a member of another venue does not');
reset role;

select * from finish();
rollback;
