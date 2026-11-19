-- Activity's About for a Bonus decision (decision 0670): how many it decided only when it was on several members; one
-- member's decision names them, and once they are erased, no one (the logic review of #1104).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table decision on commit drop as
with made as (insert into public.audit_log (venue_id, occurred_at, action, entity, entity_id, after) values
  ('00000000-0000-4000-8000-000000000001', timestamptz '2020-02-01 21:00:00+05:30', 'bonus.approve', 'promotion_bonus_decision', 'd-several',
   '{"grants": 3, "chips": 1500, "amount_paise": 150000}'),
  ('00000000-0000-4000-8000-000000000001', timestamptz '2020-02-01 21:01:00+05:30', 'bonus.approve', 'promotion_bonus_decision', 'd-one',
   '{"grants": 2, "chips": 1000, "amount_paise": 100000, "member_id": "00000000-0000-4000-8000-000000000203"}')
  returning id, entity_id)
select id, entity_id from made;

create function pg_temp.about(p_entity_id text) returns text language sql as $$
  select l.about from private.activity_line l where l.id = (select d.id from decision d where d.entity_id = p_entity_id);
$$;

select is(pg_temp.about('d-several'), '3', 'a decision on several members says how many it decided');
select is(pg_temp.about('d-one'), (select full_name from public.member where id = '00000000-0000-4000-8000-000000000203'), 'one member''s decision names them');

update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null, known_as = null
where id = '00000000-0000-4000-8000-000000000203';
select is(pg_temp.about('d-one'), null, 'once they are erased it names no one, never a count');

select * from finish();
rollback;
