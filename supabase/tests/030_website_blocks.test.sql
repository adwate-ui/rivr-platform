-- The website's blocks (#35): every kind the contract knows is allowed, nothing else; the club's
-- information pages are published and readable by anyone; the practice venue's never are.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select results_eq(
  $$ select distinct kind from public.site_block order by kind $$,
  $$ values ('careers'::text), ('faq'), ('hero'), ('map'), ('rules'), ('text') $$,
  'the seed uses every kind of block');
select throws_ok(
  $$ insert into public.site_block (venue_id, page_id, position, kind, content)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b1', 9, 'video', '{}') $$,
  '23514', null, 'a kind the website does not know is refused');

set local role anon;
select results_eq(
  $$ select slug from public.public_site_page where nav_position is not null order by nav_position $$,
  $$ values ('academy'::text), ('house-rules'), ('questions'), ('visit'), ('responsible-play') $$,
  'anyone sees the published pages in the navigation, in order; careers stays a draft');
select results_eq(
  $$ select kind from public.public_site_block where page_slug = 'house-rules' order by position $$,
  $$ values ('hero'::text), ('rules') $$, 'and their blocks, each page opening with its hero');
select is_empty($$ select * from public.public_site_block where content::text like '%Training only%' $$,
  'never the practice venue''s');
reset role;

select * from finish();
rollback;
