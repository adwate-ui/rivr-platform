-- The dropped Academy (audit F-120): its members move to Member with a line in their history, the tier is retired and kept,
-- its two draft promotions go, running it again does nothing, and the sweep of ended tier changes puts nobody back on it.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table club on commit drop as select '00000000-0000-4000-8000-000000000001'::uuid as id;
create temporary table graduates on commit drop as
select m.id from public.member m join public.tier t on t.id = m.tier_id where t.name = 'Academy graduate' and m.venue_id = (select id from club);
select ok((select count(*) from graduates) > 1, 'the seed has graduates');

-- Two for the sweep: one with a time-limited change that ended and then a permanent move to the tier, and one who moved to it
-- for good and is on another tier until a change that has now ended.
create temporary table parts on commit drop as
select (select g.id from graduates g order by g.id limit 1) as moved_after_a_change,
       (select g.id from graduates g order by g.id offset 1 limit 1) as on_another_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name = 'Member') as member_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name = 'Academy graduate') as graduate_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name not in ('Member', 'Academy graduate') and not t.is_retired order by t.rank limit 1) as other_tier,
       (select s.id from public.staff s where s.venue_id = (select id from club) order by s.id limit 1) as staff_id;
delete from graduates g where g.id = (select on_another_tier from parts);
update public.member m set tier_id = (select other_tier from parts) where m.id = (select on_another_tier from parts);
insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, ends_at, changed_by_staff_id, created_at)
select (select id from club), p.moved_after_a_change, p.member_tier, p.other_tier, 'For a while', now() - interval '5 days', p.staff_id, now() - interval '10 days' from parts p
union all
select (select id from club), p.moved_after_a_change, p.other_tier, p.graduate_tier, 'For good', null, p.staff_id, now() - interval '5 days' from parts p
union all
select (select id from club), p.on_another_tier, p.member_tier, p.graduate_tier, 'For good', null, p.staff_id, now() - interval '20 days' from parts p
union all
select (select id from club), p.on_another_tier, p.graduate_tier, p.other_tier, 'For a while', now() - interval '1 minute', p.staff_id, now() - interval '1 day' from parts p;

-- A promotion that has left draft stays. The guard's own switch lets its status change without a version.
select set_config('rivr.promotion_sync', 'on', true);
update public.promotion p set status = 'ended' where p.venue_id = (select id from club) and p.template_key = 'graduate_freeroll';
select set_config('rivr.promotion_sync', 'off', true);

select private.retire_academy_tier((select id from club));

select is((select count(*)::integer from public.member m join public.tier t on t.id = m.tier_id where t.name = 'Academy graduate' and m.venue_id = (select id from club)), 0, 'nobody is left on the tier');
select is((select count(*)::integer from public.member m join public.tier t on t.id = m.tier_id join graduates g on g.id = m.id where t.name = 'Member'), (select count(*)::integer from graduates), 'they are on Member');
select is((select count(*)::integer from public.member_tier_change c join graduates g on g.id = c.member_id where c.reason = 'The Academy is no longer offered'), (select count(*)::integer from graduates), 'each with a line in their history');
select ok((select t.is_retired from public.tier t where t.venue_id = (select id from club) and t.name = 'Academy graduate'), 'the tier is retired');
select is((select count(*)::integer from public.promotion p where p.venue_id = (select id from club) and p.template_key = 'graduate_first_buy_in'), 0, 'a draft promotion goes');
select is((select count(*)::integer from public.promotion p where p.venue_id = (select id from club) and p.template_key = 'graduate_freeroll'), 1, 'one that has left draft stays');
select lives_ok($$ select private.retire_academy_tier((select id from club)) $$, 'running it again does nothing');
select is((select count(*)::integer from public.member_tier_change c join graduates g on g.id = c.member_id where c.reason = 'The Academy is no longer offered'), (select count(*)::integer from graduates), 'and adds no second line');

select private.end_tier_changes();
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = (select moved_after_a_change from parts)), 'Member', 'the sweep leaves a moved member on Member, not the retired tier');
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = (select on_another_tier from parts)), 'Member', 'a change that ends lands on the starting tier, not the retired one');

select * from finish();
rollback;
