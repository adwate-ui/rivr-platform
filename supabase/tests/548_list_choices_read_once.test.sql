-- A list's filter choices read its source once (#1015).
-- 101 Vikram is a super admin at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The Door's five counted columns read tonight's players once between them.
set local track_functions = 'all';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select ok((select count(distinct column_key) from public.list_choices('door', '00000000-0000-4000-8000-000000000001')) >= 1, 'the Door''s choices are counted');
reset role;
select is(pg_stat_get_xact_function_calls('private.todays_players(uuid,date)'::regprocedure), 1::bigint, 'reading tonight''s players once');

select * from finish();
rollback;
