-- A builder promotion takes its budget (A2-04): an amount, a count, or both, written as the template path writes one;
-- none typed, no budget row; nothing or less is refused. 107 Ishita runs marketing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table body as select jsonb_build_object(
  'name', 'Late night points', 'runs', 'Every night, 00:00 to 04:00',
  'rule', jsonb_build_object('trigger', 'hours_played', 'effect', '{"kind": "points", "points": 50}'::jsonb)) as promotion;
grant select on body to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'both', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Both caps", "budget_paise": 5000000, "budget_count": 20}'::jsonb from body));
insert into ids select 'count', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Count cap", "budget_count": 40}'::jsonb from body));
insert into ids select 'none', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "No cap"}'::jsonb from body));
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Nothing", "budget_paise": 0}'::jsonb from body)) $$, '22023', 'A budget is more than nothing',
  'a budget of nothing is refused');
select results_eq($$ select budget_paise, budget_count from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001') p
                     where p.name = 'Both caps' $$,
  $$ values (5000000::bigint, 20) $$, 'and whoever approves it sees its budget');
reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$ select b.cap_paise, b.cap_count, b.period from public.promotion_budget b where b.promotion_id = (select id from ids where name = 'both') $$,
  $$ values (5000000::bigint, 20, 'promotion'::text) $$, 'an amount and a count, for the whole promotion');
select results_eq($$ select b.cap_paise, b.cap_count from public.promotion_budget b where b.promotion_id = (select id from ids where name = 'count') $$,
  $$ values (null::bigint, 40) $$, 'a count alone, which nothing could set before');
select is_empty($$ select 1 from public.promotion_budget b where b.promotion_id = (select id from ids where name = 'none') $$,
  'none typed, no budget, so no cap');

select * from finish();
rollback;
