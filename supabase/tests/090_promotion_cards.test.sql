-- Promotion cards (#86): Home's with feature promotions.feed, a TV's its own venue's, the website's
-- never the practice venue, and the WhatsApp offer to members who opted in to marketing, once, sent
-- only while it runs and marketing sends are on. 107 Ishita (marketing) publishes;
-- 212 Vihaan has opted in to marketing, 211 Ishaan has not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions (57_promotions.sql) back to drafts: the test starts with none live.
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.offers(p_promotion uuid) returns text language sql as $$
  select coalesce(string_agg(right(payload ->> 'member_id', 3), ' ' order by payload ->> 'member_id'), 'none')
  from public.outbox_event where event_type = 'promotion.offered' and payload ->> 'promotion_id' = p_promotion::text;
$$;

insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'marketing');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.my_promotion_cards() $$, 'with nothing published, Home has no card');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'flow7', public.publish_promotion('00000000-0000-4000-8000-000000000001', jsonb_build_object(
  'name', 'Double points', 'runs', 'NLH 100/200 · Thursday, 14:00 to 20:00',
  'rule', jsonb_build_object('trigger', 'hours_played', 'conditions', '{"days": [4]}'::jsonb, 'effect', '{"kind": "points", "multiplier_percent": 200}'::jsonb)));
reset role;

-- Home: the member's venue's live cards, with promotions.feed.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select title, detail, runs from public.my_promotion_cards() $$,
  $$ values ('Double points'::text, null::text, 'NLH 100/200 · Thursday, 14:00 to 20:00'::text) $$, 'Ishaan''s Home shows the published card');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'promotions.feed', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.my_promotion_cards() $$, 'without promotions.feed, none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select * from public.my_promotion_cards() $$, 'nor does a member of another venue see the club''s');
reset role;

-- The website: every club's live cards, never the practice venue's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.publish_promotion('00000000-0000-4000-8000-000000000002', jsonb_build_object('name', 'Practice points', 'runs', 'Every day',
  'rule', jsonb_build_object('trigger', 'hours_played', 'effect', '{"kind": "points", "points": 5}'::jsonb))) $$, 'a practice promotion goes live');
reset role;
set local role anon;
select results_eq($$ select venue_slug, title from public.public_promotion_cards $$, $$ values ('gurugram'::text, 'Double points'::text) $$,
  'the website reads the club''s card, and never the practice venue''s');
reset role;

-- A paired TV: its own venue's cards, the practice venue's for training; a member reads none through it.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e861', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000861'),
  ('00000000-0000-4000-8000-00000000e862', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000862');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d861', '00000000-0000-4000-8000-000000000001', 'tv', 'Promotions TV', '00000000-0000-4000-8000-00000000e861'),
  ('00000000-0000-4000-8000-00000000d862', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice promotions TV', '00000000-0000-4000-8000-00000000e862');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e861');
select results_eq($$ select title from public.tv_promotions() $$, $$ values ('Double points'::text) $$, 'a TV at the club reads the club''s card');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e862');
select results_eq($$ select title from public.tv_promotions() $$, $$ values ('Practice points'::text) $$, 'the practice venue''s TV reads its own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is_empty($$ select * from public.tv_promotions() $$, 'and a member reads none as a TV');
reset role;

-- WhatsApp: offered once to each member who opted in to marketing.
select is(pg_temp.offers((select id from ids where name = 'flow7')), '212', 'publishing offers it to Vihaan, who opted in, and not to Ishaan');
select results_eq($$ select payload ->> 'title', payload ->> 'runs' from public.outbox_event where event_type = 'promotion.offered'
                     and payload ->> 'promotion_id' = (select id::text from ids where name = 'flow7') $$,
  $$ values ('Double points'::text, 'NLH 100/200 · Thursday, 14:00 to 20:00'::text) $$, 'with its card');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.set_promotion_live((select id from ids where name = 'flow7'), false);
reset role;
select is_empty($$ select * from private.promotion_cards('00000000-0000-4000-8000-000000000001') $$, 'paused, it leaves Home and the TVs');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.set_promotion_live((select id from ids where name = 'flow7'), true);
select public.publish_promotion_template((select id from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = 'referral'));
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'promotion.offered'
           and payload ->> 'promotion_id' = (select id::text from ids where name = 'flow7')), 1, 'resumed, it is not offered again');
select is(pg_temp.offers((select id from public.promotion where venue_id = '00000000-0000-4000-8000-000000000001' and template_key = 'referral')), '212',
  'a published template is offered too');
select is((select count(*)::integer from private.promotion_cards('00000000-0000-4000-8000-000000000001')), 2, 'and both cards are live');

-- At send time, the WhatsApp consumer finds the member only while the offer may still be sent.
create temp table templates as select template_key, id from public.promotion
where venue_id = '00000000-0000-4000-8000-000000000001' and template_key is not null;
grant select on templates to authenticated;
select is((select count(*)::integer from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
  (select id from templates where template_key = 'referral'))), 1, 'at send time, Vihaan is found for a running offer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.set_promotion_live((select id from ids where name = 'flow7'), false);
reset role;
select is_empty($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
  (select id from ids where name = 'flow7')) $$, 'paused, an offer still waiting is not sent');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
  (select id from templates where template_key = 'referral')) $$, '42501', null, 'and only the WhatsApp consumer may look');
reset role;

-- Ishaan opts in, but his tier has no promotions.feed: neither offered nor found.
insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'marketing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.publish_promotion_template((select id from templates where template_key = 'tuesday_bonus'));
reset role;
select is(pg_temp.offers((select id from templates where template_key = 'tuesday_bonus')), '212', 'a member without promotions.feed is not offered it');
select is_empty($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
  (select id from templates where template_key = 'tuesday_bonus')) $$, 'nor found at send time');

-- Marketing sends switched off: a waiting offer is not sent, and a new promotion is offered to nobody.
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'marketing_sends', 'Test');
select is_empty($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
  (select id from templates where template_key = 'tuesday_bonus')) $$, 'with marketing sends switched off, a waiting offer is not sent');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.publish_promotion_template((select id from templates where template_key = 'graduate_first_buy_in'));
reset role;
select is(pg_temp.offers((select id from templates where template_key = 'graduate_first_buy_in')), 'none', 'and a new one is offered to nobody');

-- A frozen venue refuses a promotion put live straight into the table, as publish_promotion does.
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select throws_ok($$ insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Straight in', 'live') $$,
  'RVFRZ', null, 'a frozen venue refuses a promotion put live straight into the table');

select * from finish();
rollback;
