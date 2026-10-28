-- Glaza's statement (#109; decision 0265): Aditya (103, an admin who runs F&B) imports October's lines; each is matched
-- to a visit by table and time, a seat telling two players at the table apart. The statement comes from the month's
-- latest import: comps at cost, the alcohol margin split 50:50 and NewCo's payable. Sana (104, a cashier) does neither.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Yash (214) at Table 3, seat 5, and Kabir (202) at seat 6, from 20:00 to 01:00 IST on the night of 14 October.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000f1821', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214',
   '2026-10-14 19:30+05:30', '2026-10-15 02:00+05:30', 'door'),
  ('00000000-0000-4000-8000-0000000f1822', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
   '2026-10-14 19:30+05:30', '2026-10-15 02:00+05:30', 'door');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select v.venue_id, v.member_id, v.id, g.id, case when v.member_id = '00000000-0000-4000-8000-000000000214' then 5 else 6 end,
       '2026-10-14 20:00+05:30', '2026-10-14 20:00+05:30', '2026-10-15 01:00+05:30', 'left'
from public.visit v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 3'
where v.id in ('00000000-0000-4000-8000-0000000f1821', '00000000-0000-4000-8000-0000000f1822');

-- One line of Glaza's: time, table, seat, item, kind, quantity, unit cost and price in rupees, comp.
create function pg_temp.line(p_at text, p_table text, p_seat integer, p_item text, p_kind text, p_quantity integer, p_cost integer, p_price integer,
                             p_comp boolean) returns jsonb language sql as $$
  select jsonb_build_object('sold_at', p_at, 'table_name', p_table, 'seat', p_seat, 'item', p_item, 'kind', p_kind, 'quantity', p_quantity,
                            'unit_cost_paise', p_cost * 100, 'unit_price_paise', p_price * 100, 'is_comp', p_comp);
$$;
grant execute on function pg_temp.line(text, text, integer, text, text, integer, integer, integer, boolean) to authenticated;
create temporary table october on commit drop as select jsonb_build_array(
  pg_temp.line('2026-10-14T21:30:00+05:30', 'Table 3', 5, 'Masala chai', 'soft_drink', 2, 20, 60, true),
  pg_temp.line('2026-10-14T22:00:00+05:30', 'Table 3', null, 'Beer', 'alcohol', 3, 150, 400, false),
  pg_temp.line('2026-10-14T22:15:00+05:30', 'table 3', 6, 'Club sandwich', 'food', 1, 180, 450, true),
  pg_temp.line('2026-10-14T23:00:00+05:30', 'Bar counter', null, 'Whisky', 'alcohol', 1, 300, 900, false),
  pg_temp.line('2026-10-15T03:00:00+05:30', 'Table 3', 5, 'Whisky', 'alcohol', 1, 300, 900, true)) as lines;
grant select on october to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01', (select lines from october)) $$,
  '42501', null, 'a cashier imports nothing');
select throws_ok($$ select * from public.glaza_statement('00000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  '42501', null, 'and reads no statement');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.glaza_statement('00000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  'a month with no import has no statement');
select isnt(public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01', (select lines from october)), null,
  'Aditya imports October');
select results_eq(
  $$ select l.line_number, l.visit_id from public.glaza_import_line l order by l.line_number $$,
  $$ values (1, '00000000-0000-4000-8000-0000000f1821'::uuid), (2, null), (3, '00000000-0000-4000-8000-0000000f1822'), (4, null), (5, null) $$,
  'a line is matched to the visit of the one player at that table and seat then; two at the table with no seat, no table, or nobody seated is not');
-- Comps: 2 chai at ₹20, a sandwich at ₹180 and a whisky at ₹300 = ₹520. Alcohol sold: 3 beers at ₹400 and a whisky at
-- ₹900 = ₹2,100, costing ₹750: a margin of ₹1,350, RIVR's half ₹675, so Glaza owes RIVR ₹155.
select results_eq(
  $$ select lines, matched, food_comps_paise, soft_drink_comps_paise, alcohol_comps_paise, comps_paise, alcohol_sales_paise, alcohol_cost_paise,
            alcohol_margin_paise, rivr_share_paise, payable_paise
     from public.glaza_statement('00000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  $$ values (5, 2, 18000::bigint, 4000::bigint, 30000::bigint, 52000::bigint, 210000::bigint, 75000::bigint, 135000::bigint, 67500::bigint, -15500::bigint) $$,
  'the statement: comps at cost by kind, the alcohol margin split 50:50, and the payable, below nothing when Glaza owes RIVR');

select throws_ok($$ select public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01',
                     jsonb_build_array(pg_temp.line('2026-11-02T21:00:00+05:30', 'Table 3', null, 'Chai', 'soft_drink', 1, 20, 60, true))) $$,
  '22023', null, 'a line sold outside the club month is refused');
select throws_ok($$ select public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01',
                     jsonb_build_array(pg_temp.line('2026-10-14T21:00:00+05:30', 'Table 3', null, 'Chai', 'tea', 1, 20, 60, true))) $$,
  '22023', null, 'and so is a kind that is not food, soft drink or alcohol');
select throws_ok($$ select public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01', '[]') $$,
  '22023', null, 'and a file with no lines');

-- A corrected file: only the chai.
select isnt(public.import_glaza_lines('00000000-0000-4000-8000-000000000001', '2026-10-01', jsonb_build_array((select lines -> 0 from october))), null,
  'Aditya imports a corrected October');
select results_eq(
  $$ select lines, matched, comps_paise, alcohol_margin_paise, payable_paise from public.glaza_statement('00000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  $$ values (1, 1, 4000::bigint, 0::bigint, 4000::bigint) $$,
  'the statement reads the latest import');
select is((select count(*)::integer from public.glaza_import), 2, 'and both imports are kept');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.glaza_import_line), 0, 'a cashier sees none of Glaza''s lines');

select * from finish();
rollback;
