-- Website blocks (#239): a published block's extra keys never reach the public, and a page has one hero at most.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.site_page (venue_id, slug, title, description, is_published)
values ('00000000-0000-4000-8000-000000000001', 'keys-test', 'Keys test', 'A page for this test', true);
insert into public.site_block (venue_id, page_id, position, kind, content)
select '00000000-0000-4000-8000-000000000001', id, 1, 'hero', '{"heading": "Welcome", "editorNote": "Ask Meera before Friday"}'::jsonb
from public.site_page where slug = 'keys-test';

set local role anon;
select is((select content from public.public_site_block where page_slug = 'keys-test'), '{"heading": "Welcome"}'::jsonb,
  'the public reads the hero''s heading, never the note kept with it');
reset role;

select throws_ok($$ insert into public.site_block (venue_id, page_id, position, kind, content)
                    select '00000000-0000-4000-8000-000000000001', id, 2, 'hero', '{"heading": "Again"}'::jsonb
                    from public.site_page where slug = 'keys-test' $$, '23505', null, 'a page takes one hero');
select ok(private.site_block_public_keys('text') = array['heading', 'body'], 'a text block keeps its heading and body');

select * from finish();
rollback;
