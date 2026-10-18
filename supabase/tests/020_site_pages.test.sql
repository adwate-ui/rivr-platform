-- The website's content (#9): anyone reads the published pages of real venues and their blocks in
-- order, through the public views; never a draft, never the practice venue, never the tables. Website
-- editors read the tables. 107 Ishita (marketing), 201 Arjun (member). Content from seed 40_site.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local role anon;
select results_eq(
  $$ select venue_slug, slug, title, nav_position from public.public_site_page order by venue_slug, slug $$,
  $$ values ('gurugram'::text, 'academy'::text, 'RIVR Academy'::text, 1), ('gurugram', 'home', 'RIVR Poker Club', null) $$,
  'anyone reads the club''s published pages: not the draft, not the practice venue''s');
select results_eq(
  $$ select position, kind from public.public_site_block where venue_slug = 'gurugram' and page_slug = 'home' order by position $$,
  $$ values (1, 'hero'::text), (2, 'text'::text) $$,
  'and their blocks, in order');
select is_empty($$ select * from public.public_site_block where page_slug = 'careers' or venue_slug = 'practice' $$,
  'never a draft''s blocks or the practice venue''s');
select throws_ok($$ select * from public.site_page $$, '42501', null, 'nobody signed out reads the tables');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000107", "role": "authenticated"}';
select ok((select count(*) from public.site_page where slug = 'careers') >= 1, 'a website editor reads drafts too');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.site_page), 0, 'a member reads only the public views');
reset role;

select * from finish();
rollback;
