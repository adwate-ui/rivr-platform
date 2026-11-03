-- A promotion's card may carry a link (#776): the builder submits it, the approver reads it, and once live the member's
-- card opens it. Only an https address is taken. 107 Ishita (marketing) submits and 101, a super admin, approves (#144);
-- 211 Ishaan is a member of the club.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- The seed's live promotions back to drafts: the test reads only its own card.
-- A promotion run in versions goes back to draft through its version (decision 0461).
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table body as select jsonb_build_object(
  'name', 'Happy hour', 'runs', 'Daily, 19:00 to 21:00',
  'rule', jsonb_build_object('trigger', 'hours_played', 'effect', '{"kind": "points", "points": 50}'::jsonb)) as promotion;
grant select on body to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'linked', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"link": " https://glaza.example/happy-hour "}'::jsonb from body));
insert into ids select 'plain', public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Late night points", "link": ""}'::jsonb from body));
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Elsewhere", "link": "javascript:alert(1)"}'::jsonb from body)) $$, '23514', null,
  'a link that is not an https address is refused');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Plain web", "link": "http://glaza.example/"}'::jsonb from body)) $$, '23514', null,
  'nor is a plain http one');
select throws_ok($$ select public.submit_promotion('00000000-0000-4000-8000-000000000001',
  (select promotion || '{"name": "Disguised", "link": "https://rivr.club@evil.example/"}'::jsonb from body)) $$, '23514', null,
  'nor one whose host hides behind a user part, so the approver reads the host it opens');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select name, link from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001')
                     where promotion_id in (select id from ids) order by name $$,
  $$ values ('Happy hour'::text, 'https://glaza.example/happy-hour'::text), ('Late night points', null) $$,
  'the approver reads the link the card will open, trimmed, and none when none was typed');
select public.approve_promotion(id) from ids;
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select title, link from public.my_promotion_cards() order by title $$,
  $$ values ('Happy hour'::text, 'https://glaza.example/happy-hour'::text), ('Late night points', null) $$,
  'the member''s card carries its link, and a card without one has none');
reset role;

select * from finish();
rollback;
