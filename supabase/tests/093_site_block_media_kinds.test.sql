-- The front page's block kinds (#441): a statement, a gallery and a feature are allowed on a page, as
-- the contracts type them; a kind nobody knows is not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select lives_ok($$
  insert into public.site_block (venue_id, page_id, position, kind, content)
  values ('00000000-0000-4000-8000-000000000001', (select id from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and slug = 'home'), 90, 'statement', '{"lines": ["Not luck."]}'),
         ('00000000-0000-4000-8000-000000000001', (select id from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and slug = 'home'), 91, 'gallery', '{"items": []}'),
         ('00000000-0000-4000-8000-000000000001', (select id from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and slug = 'home'), 92, 'feature', '{"heading": "The RIVR app"}')
$$, 'a statement, a gallery and a feature can be placed on a page');

select throws_ok($$
  insert into public.site_block (venue_id, page_id, position, kind, content)
  values ('00000000-0000-4000-8000-000000000001', (select id from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001' and slug = 'home'), 93, 'video', '{}')
$$, '23514', null, 'a kind nobody knows is refused');

select * from finish();
rollback;
