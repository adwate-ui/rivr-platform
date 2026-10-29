-- A promotion's rules and questions (#618): marketing (107 Ishita) submits them with the promotion, the database holds
-- them to their shape, and the website's cards carry them, with whether the promotion is the welcome offer (a rule for
-- new players). The practice venue's never show.
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
create temp table welcome as select jsonb_build_object(
  'name', 'Welcome bonus', 'runs', 'Your first visit', 'detail', '₹1,000 bonus on your first buy-in',
  'rules', jsonb_build_array('New members only', ' Once a member '),
  'questions', jsonb_build_array(jsonb_build_object('question', 'Do I claim it?', 'answer', 'No: it is added at the cage.')),
  'rule', jsonb_build_object('trigger', 'buy_in', 'conditions', '{"new_player": true}'::jsonb,
                             'effect', '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb)) as body;
grant select on welcome to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'welcome', public.submit_promotion('00000000-0000-4000-8000-000000000001', (select body from welcome));
reset role;
select results_eq($$ select rules, questions from public.promotion where id = (select id from ids where name = 'welcome') $$,
  $$ values (array['New members only', 'Once a member'], '[{"question": "Do I claim it?", "answer": "No: it is added at the cage."}]'::jsonb) $$,
  'marketing submits a promotion with its rules, trimmed, and its questions');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select website_rules, website_questions -> 0 ->> 'question' from public.promotions_awaiting_approval('00000000-0000-4000-8000-000000000001')
                     where promotion_id = (select id from ids where name = 'welcome') $$,
  $$ values (array['New members only', 'Once a member'], 'Do I claim it?'::text) $$,
  'the super admin deciding on it reads the rules and questions it puts on the website');
reset role;

-- Live (as a super admin's approval leaves it), its card on the website carries them, as the welcome offer.
update public.promotion set status = 'live', starts_at = now() - interval '1 minute' where id = (select id from ids where name = 'welcome');
set local role anon;
select results_eq($$ select rules, questions ->> 0, is_welcome from public.public_promotion_cards where title = 'Welcome bonus' $$,
  $$ values (array['New members only', 'Once a member'], '{"answer": "No: it is added at the cage.", "question": "Do I claim it?"}'::text, true) $$,
  'the website''s card carries its rules and questions, and is the welcome offer');
select is((select count(*) from public.public_promotion_cards where is_welcome is null), 0::bigint, 'every card says whether it is the welcome offer');
reset role;
select columns_are('public', 'public_promotion_cards', array['venue_slug', 'title', 'detail', 'runs', 'rules', 'questions', 'is_welcome'],
  'public_promotion_cards shows a card''s words, rules and questions, and whether it is the welcome offer, nothing more');

-- The database holds them to their shape.
select throws_ok($$ update public.promotion set rules = array[repeat('x', 201)] where id = (select id from ids where name = 'welcome') $$,
  '23514', null, 'a rule is at most 200 characters');
select throws_ok($$ update public.promotion set questions = '[{"question": "Q", "answer": "A", "link": "x"}]' where id = (select id from ids where name = 'welcome') $$,
  '23514', null, 'a question has its answer and nothing else');
select throws_ok($$ update public.promotion set questions = '[{"question": "Q"}]' where id = (select id from ids where name = 'welcome') $$,
  '23514', null, 'and never comes without one');

select * from finish();
rollback;
