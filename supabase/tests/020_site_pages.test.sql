-- The website's content (#9): anyone reads the published pages of real venues and their blocks in
-- order, through the public views; never a draft, never the practice venue, never the tables. Website
-- editors read the tables. 107 Ishita (marketing), 201 Arjun (member). Content from private.add_website (decision 0195) and, for the practice venue, seed 40_site.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local role anon;
select results_eq(
  $$ select venue_slug, slug, title, nav_position from public.public_site_page order by venue_slug, slug $$,
  $$ values ('gurugram'::text, 'about'::text, 'About'::text, 1), ('gurugram', 'academy', 'RIVR Academy', 5),
            ('gurugram', 'home', 'RIVR Poker Club', null), ('gurugram', 'house-rules', 'House rules', null),
            ('gurugram', 'journal', 'Journal', 6), ('gurugram', 'journal-bankroll', 'Bankroll basics', null),
            ('gurugram', 'journal-holdem-basics', 'Texas Hold''em for beginners', null),
            ('gurugram', 'journal-live-etiquette', 'Live poker etiquette', null),
            ('gurugram', 'journal-plo-basics', 'Pot-Limit Omaha: what changes', null),
            ('gurugram', 'links', 'RIVR Poker Club', null), ('gurugram', 'membership', 'Membership', 2),
            ('gurugram', 'privacy', 'Privacy', null), ('gurugram', 'promotions', 'Promotions', 3),
            ('gurugram', 'questions', 'Questions', null), ('gurugram', 'responsible-play', 'Responsible play', null),
            ('gurugram', 'terms', 'Terms of use', null), ('gurugram', 'tournaments', 'Tournaments', 4), ('gurugram', 'visit', 'Visit', 7) $$,
  'anyone reads the club''s published pages: not the draft, not the practice venue''s');
select results_eq(
  $$ select position, kind from public.public_site_block where venue_slug = 'gurugram' and page_slug = 'home' order by position $$,
  $$ values (1, 'hero'::text), (2, 'marquee'::text), (3, 'story'), (4, 'cards'), (5, 'statement'), (6, 'gallery'), (7, 'cards'), (8, 'games'),
            (9, 'cards'), (10, 'cards'), (11, 'timeline'), (12, 'cards'), (13, 'feature'), (14, 'cards'), (15, 'calendar'), (16, 'cards'),
            (17, 'faq'), (18, 'statement'), (19, 'map') $$,
  'and their blocks, in order');
select is_empty($$ select * from public.public_site_block where page_slug = 'careers' or venue_slug = 'practice' $$,
  'never a draft''s blocks or the practice venue''s');
select throws_ok($$ select * from public.site_page $$, '42501', null, 'nobody signed out reads the tables');
select throws_ok($$ select * from public.site_block $$, '42501', null, 'nor the blocks');
select throws_ok($$ insert into public.site_page (venue_id, slug, title) values ('00000000-0000-4000-8000-000000000001', 'x', 'x') $$,
  '42501', null, 'nobody signed out writes a page');
select throws_ok($$ update public.site_block set content = '{}' $$, '42501', null, 'or changes a block');
select throws_ok($$ delete from public.site_page $$, '42501', null, 'or removes a page');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000107", "role": "authenticated"}';
select ok((select count(*) from public.site_page where slug = 'careers') >= 1, 'a website editor reads drafts too');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.site_page), 0, 'a member reads only the public views');
select is_empty($$ select * from public.site_block $$, 'and no blocks from the tables');
select throws_ok($$ insert into public.site_page (venue_id, slug, title) values ('00000000-0000-4000-8000-000000000001', 'x', 'x') $$,
  '42501', null, 'a member writes no page');
select throws_ok($$ update public.site_block set content = '{}' $$, '42501', null, 'changes no block');
select throws_ok($$ delete from public.site_page $$, '42501', null, 'and removes no page');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is((select count(*)::int from public.site_page), 0, 'staff without website editing read no pages');
reset role;

-- An editor only at the club no longer reads the practice venue's pages.
update public.staff set is_active = false
  where user_id = '00000000-0000-4000-8000-000000000107' and venue_id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000107", "role": "authenticated"}';
select is_empty($$ select * from public.site_page where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'a website editor reads only the pages of venues where they edit');
select ok((select count(*) from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001') >= 3,
  'and still every page of the club, drafts included');
select is_empty($$ select * from public.site_block where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'and only their blocks');
reset role;

select * from finish();
rollback;
