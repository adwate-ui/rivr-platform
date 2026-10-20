-- Promotion cards (#86): Home's with feature promotions.feed, the website's never the practice venue,
-- and the WhatsApp offer to members who opted in to marketing, once. 107 Ishita (marketing) publishes;
-- 212 Vihaan has opted in to marketing, 211 Ishaan has not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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

select * from finish();
rollback;
