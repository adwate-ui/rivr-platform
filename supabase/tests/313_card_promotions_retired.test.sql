-- The word-only promotion cards retire (owner, 3 Nov; decision 0498): no venue runs one, a new venue gets none, and an
-- ended card, kept for history, shows on no screen (the player's Tonight, the TVs and the website read
-- private.promotion_cards) and cannot be resumed. The high-hand and jackpot features do not need them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table cards (template_key text primary key);
insert into cards values ('high_hands'), ('bad_beat'), ('rivr_rewards'), ('ladies_night'), ('league'), ('sunday_guarantee');

select is_empty($$ select 1 from public.promotion p join cards using (template_key) where p.status <> 'ended' $$,
  'no venue runs a word-only card');

select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e3', 'Elsewhere', 'elsewhere-313', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
select is_empty($$ select 1 from public.promotion p join cards using (template_key) where p.venue_id = '00000000-0000-4000-8000-0000000000e3' $$,
  'a new venue gets none');
select ok((select count(*) > 0 from public.promotion p where p.venue_id = '00000000-0000-4000-8000-0000000000e3'),
  'and still gets the promotions that give something');

-- A card as an older venue keeps it: ended, for history.
create temporary table ids (name text primary key, id uuid);
with p as (insert into public.promotion (venue_id, template_key, name, detail, runs, status, starts_at)
           values ('00000000-0000-4000-8000-000000000001', 'high_hands', 'High hands', 'Royal flush 25,000', 'Every night', 'ended', now() - interval '1 day')
           returning id)
insert into ids select 'card', id from p;
select is_empty($$ select 1 from private.promotion_cards('00000000-0000-4000-8000-000000000001') c where c.promotion_id = (select id from ids) $$,
  'an ended card shows on no screen');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
grant select on ids to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.set_promotion_live((select id from ids), true) $$, '22023', null, 'and is not resumed');
reset role;

-- The high hands and the bad beat go on without their cards.
select has_function('private', 'high_hands', array['uuid'], 'high hands are still claimed and paid at the tables');
select has_function('public', 'pay_bad_beat', 'and the bad beat is still paid from its jackpot');

select * from finish();
rollback;
