-- promotion.granted tells of what a promotion gave (#1019): a Bonus that waits for a super admin (decision 0670) is told of
-- when approved, never while it waits nor once refused, so a consumer counting the event never counts a refused Bonus. A
-- grant given at once is told of at once (084 and 441 hold that). 101 Vikram, a super admin, decides; members 211 and 212
-- are the seed's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts (decision 0491): only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

-- A sign-up Bonus live at the club from two days ago, every day all day, for everyone.
do $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Welcome 550') returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', 'Welcome 550', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}',
          '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00',
                             'startsOn', (private.club_day_of(now()) - 2)::text, 'timezone', 'Asia/Kolkata'),
          '{"perMember": "none"}', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
end;
$$;

-- Asha (211) and Bhavna (212) sign up: each Bonus waits.
select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'signup',
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000211', 'key', 'test-550-asha'));
select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'signup',
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000212', 'key', 'test-550-bhavna'));
insert into ids
select case g.member_id when '00000000-0000-4000-8000-000000000211' then 'asha' else 'bhavna' end, g.id
from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
where p.name = 'Welcome 550' and g.status = 'waiting';
select is((select count(*)::integer from ids), 2, 'both sign-ups wait for a super admin');
select is_empty($$ select 1 from public.outbox_event e join ids on e.idempotency_key = 'promotion.granted:' || ids.id
                   where e.event_type = 'promotion.granted' $$, 'a Bonus that waits is not told of');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                    array[(select id from ids where name = 'asha')], gen_random_uuid()) $$, 'the super admin approves Asha''s');
select lives_ok($$ select public.refuse_promotion_bonus('00000000-0000-4000-8000-000000000001',
                    array[(select id from ids where name = 'bhavna')], 'Signed up twice under two numbers', gen_random_uuid()) $$,
  'and refuses Bhavna''s');
reset role;

select results_eq(
  $$ select e.payload ->> 'member_id', e.payload ->> 'status', (e.payload ->> 'cost_paise')::bigint, (e.payload ->> 'chips')::bigint
     from public.outbox_event e
     where e.event_type = 'promotion.granted' and e.idempotency_key = 'promotion.granted:' || (select id from ids where name = 'asha') $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::text, 'given'::text, 50000::bigint, 500::bigint) $$,
  'approved, it is told of once, as given, with what it gave');
select is_empty($$ select 1 from public.outbox_event e
                   where e.event_type = 'promotion.granted' and e.idempotency_key = 'promotion.granted:' || (select id from ids where name = 'bhavna') $$,
  'refused, it is never told of');

-- A decision changes each grant once (#1019): one row-audit line for it, and for an approved one one more for the Bonus it
-- posted; besides one Activity line a decision.
select results_eq(
  $$ select ids.name, count(*) filter (where l.entity = 'promotion_grant')::integer, count(*) filter (where l.entity = 'bonus_grant')::integer
     from ids
     join public.promotion_grant g on g.id = ids.id
     join public.audit_log l
       on (l.entity = 'promotion_grant' and l.entity_id = g.id::text and l.action = 'update')
       or (l.entity = 'bonus_grant' and l.entity_id = g.bonus_grant_id::text)
     group by ids.name order by ids.name $$,
  $$ values ('asha'::text, 1, 1), ('bhavna'::text, 1, 0) $$,
  'each decided grant has one audit line for its change, and an approved one one for its Bonus');
select is((select count(*)::integer from public.audit_log l
           where l.action in ('bonus.approve', 'bonus.refuse') and l.entity = 'promotion_bonus_decision'
             and l.entity_id in (select g.decision_id::text from public.promotion_grant g join ids on ids.id = g.id)), 2,
  'and each decision its one Activity line');

-- The member's record shows a Bonus that waited as given when approved, not when calculated (#1019). Chandra is 213.
select private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'signup',
  jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000213', 'key', 'test-550-chandra'));
insert into ids select 'chandra', g.id from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
where p.name = 'Welcome 550' and g.member_id = '00000000-0000-4000-8000-000000000213';
update public.promotion_grant set created_at = now() - interval '2 days' where id = (select id from ids where name = 'chandra');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.approve_promotion_bonus('00000000-0000-4000-8000-000000000001',
                    array[(select id from ids where name = 'chandra')], gen_random_uuid()) $$, 'Chandra''s, calculated two days ago, is approved now');
select results_eq($$ select granted_at from public.member_promotion_grants('00000000-0000-4000-8000-000000000213', 20) $$,
  $$ values (now()) $$, 'her record shows it given when approved, not when calculated');
reset role;

select * from finish();
rollback;
