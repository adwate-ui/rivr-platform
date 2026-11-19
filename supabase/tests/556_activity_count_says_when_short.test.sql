-- The Activity count stops five thousand lines past the page and says when it stopped short (#1015).
-- 101 Vikram is a super admin at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Six thousand lines on one club day long ago, so nothing else falls on it.
insert into public.audit_log (venue_id, occurred_at, action, entity, entity_id)
select '00000000-0000-4000-8000-000000000001', timestamptz '2020-01-01 12:00:00+05:30' + make_interval(secs => n), 'setting.change', 'setting', n::text
from generate_series(1, 6000) n;

create function pg_temp.count_of(p_page integer, p_page_size integer) returns text language sql as $$
  select max(p.total)::text || case when bool_or(p.is_total_at_least) then '+' else '' end
  from public.activity_page('00000000-0000-4000-8000-000000000001', date '2020-01-01', date '2020-01-01', null, null, p_page, p_page_size) p;
$$;
grant execute on function pg_temp.count_of(integer, integer) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(pg_temp.count_of(1, 50), '5050+', 'the first page counts five thousand lines past itself, and says there are more');
select is(pg_temp.count_of(2, 50), '5100+', 'the next page counts fifty further');
select is(pg_temp.count_of(20, 50), '6000', 'within five thousand lines of the end the count is exact, and says so');
select is(pg_temp.count_of(1, 1000), '6000', 'an export''s first thousand counts to the end of a log this long');
select is((select count(*) from public.activity_page('00000000-0000-4000-8000-000000000001', date '2020-01-01', date '2020-01-01', null, null, 7, 1000)),
  0::bigint, 'past the last line there are none');
reset role;

-- Anyone without activity.read still sees nothing (106 Pema is a dealer).
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*) from public.activity_page('00000000-0000-4000-8000-000000000001', date '2020-01-01', date '2020-01-01', null, null, 1, 50)),
  0::bigint, 'a dealer reads no line');
reset role;

select * from finish();
rollback;
