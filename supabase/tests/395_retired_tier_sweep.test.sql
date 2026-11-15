-- A retired tier (audit F-120; the Academy graduate tier is one, decision 0586): the sweep of ended tier changes puts nobody
-- back on it. 213 Mihir was moved off the tier when it was retired; 214 Yash was on another tier for a while when it was.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table club on commit drop as select '00000000-0000-4000-8000-000000000001'::uuid as id;
insert into public.tier (venue_id, name, rank) values ((select id from club), 'Old tier', 9);
create temporary table parts on commit drop as
select '00000000-0000-4000-8000-000000000213'::uuid as moved_after_a_change,
       '00000000-0000-4000-8000-000000000214'::uuid as on_another_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name = 'Member') as member_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name = 'Old tier') as old_tier,
       (select t.id from public.tier t where t.venue_id = (select id from club) and t.name not in ('Member', 'Old tier') and not t.is_retired order by t.rank limit 1) as other_tier,
       (select s.id from public.staff s where s.venue_id = (select id from club) order by s.id limit 1) as staff_id;

-- Mihir: a time-limited change that ended, then a move to the old tier for good. Yash: on the old tier for good, and on
-- another until a change that has now ended.
update public.member m set tier_id = (select old_tier from parts) where m.id = (select moved_after_a_change from parts);
update public.member m set tier_id = (select other_tier from parts) where m.id = (select on_another_tier from parts);
insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, ends_at, changed_by_staff_id, created_at)
select (select id from club), p.moved_after_a_change, p.member_tier, p.other_tier, 'For a while', now() - interval '5 days', p.staff_id, now() - interval '10 days' from parts p
union all
select (select id from club), p.moved_after_a_change, p.other_tier, p.old_tier, 'For good', null, p.staff_id, now() - interval '5 days' from parts p
union all
select (select id from club), p.on_another_tier, p.member_tier, p.old_tier, 'For good', null, p.staff_id, now() - interval '20 days' from parts p
union all
select (select id from club), p.on_another_tier, p.old_tier, p.other_tier, 'For a while', now() - interval '1 minute', p.staff_id, now() - interval '1 day' from parts p;

-- The tier is retired: its member becomes a Member, with a line in his history.
insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, is_expiry)
select (select id from club), p.moved_after_a_change, p.old_tier, p.member_tier, 'The tier is no longer offered', true from parts p;
update public.member m set tier_id = (select member_tier from parts) where m.id = (select moved_after_a_change from parts);
update public.tier t set is_retired = true where t.id = (select old_tier from parts);

select private.end_tier_changes();
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = (select moved_after_a_change from parts)), 'Member',
  'the sweep leaves a moved member on Member, not the retired tier');
select is((select t.name from public.member m join public.tier t on t.id = m.tier_id where m.id = (select on_another_tier from parts)), 'Member',
  'a change that ends lands on the starting tier, not the retired one');

select * from finish();
rollback;
