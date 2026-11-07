-- Ended promotions apart (the owner, 8 Nov): the promotions list says when each ended. 107 Ishita (marketing) ends the
-- Tuesday buy-in bonus; the Referral, still live, has no end; a host reads no list at all.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table tuesday as
  select v.id from public.promotion p join public.promotion_version v on v.promotion_id = p.id and v.version = p.current_version
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.name = 'Buy-in bonus Tuesday';
grant select on tuesday to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from tuesday), 1, 'the seed runs the Tuesday buy-in bonus in versions');
select ok((select ended_at is null from public.promotions_overview('00000000-0000-4000-8000-000000000001') where current_version_id = (select id from tuesday)),
  'a live promotion has no end');
select lives_ok($$ select public.end_promotion_version((select id from tuesday)) $$, 'Ishita ends the Tuesday buy-in bonus');
select results_eq($$ select current_status, ended_at = now() from public.promotions_overview('00000000-0000-4000-8000-000000000001')
                     where current_version_id = (select id from tuesday) $$,
  $$ values ('ended'::text, true) $$, 'the list says it ended, and when');
select ok((select ended_at is null from public.promotions_overview('00000000-0000-4000-8000-000000000001') where name = 'Referral'),
  'the Referral, still live, has no end');
select ok(not exists (select 1 from public.promotions_overview('00000000-0000-4000-8000-000000000001') where ended_at is not null and coalesce(current_status, status) <> 'ended'),
  'only ended promotions have an end');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.promotions_overview('00000000-0000-4000-8000-000000000001') $$, 'a host reads no promotions list');
reset role;

select * from finish();
rollback;
