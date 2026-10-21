-- The website's content (#9): anyone reads the published pages of real venues and their blocks in
-- order, through the public views; never a draft, never the practice venue, never the tables. Website
-- editors read the tables. 107 Ishita (marketing), 201 Arjun (member). Content from seeds 40_site.sql and 41_site_pages.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local role anon;
select results_eq(
  $$ select venue_slug, slug, title, nav_position from public.public_site_page order by venue_slug, slug $$,
  $$ values ('gurugram'::text, 'academy'::text, 'RIVR Academy'::text, 1), ('gurugram', 'home', 'RIVR Poker Club', null),
            ('gurugram', 'house-rules', 'House rules', 3), ('gurugram', 'links', 'RIVR Poker Club', null),
            ('gurugram', 'privacy', 'Privacy', 7), ('gurugram', 'questions', 'Questions', 4),
            ('gurugram', 'responsible-play', 'Responsible play', 6), ('gurugram', 'visit', 'Visit', 5) $$,
  'anyone reads the club''s published pages: not the draft, not the practice venue''s');
select results_eq(
  $$ select position, kind from public.public_site_block where venue_slug = 'gurugram' and page_slug = 'home' order by position $$,
  $$ values (1, 'hero'::text), (2, 'statement'::text), (3, 'gallery'), (4, 'feature'), (5, 'games'), (6, 'calendar'), (7, 'statement'), (8, 'map') $$,
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
