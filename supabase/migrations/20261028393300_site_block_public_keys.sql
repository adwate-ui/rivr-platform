-- Website blocks (#239, from the #9 reviews). The public view gives each block only the keys the website reads for
-- its kind, so a key kept with a block, such as an editor's note, never reaches the public. And a page has one hero
-- at most: one h1 and one gold button a page.

-- The keys the website reads for each kind of block: packages/contracts/src/site.ts siteBlockSchema's content keys.
create function private.site_block_public_keys(p_kind text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'hero' then array['eyebrow', 'heading', 'text', 'action', 'video', 'note']
    when 'statement' then array['eyebrow', 'lines', 'text', 'action', 'image', 'note']
    when 'gallery' then array['eyebrow', 'heading', 'intro', 'items', 'note']
    when 'feature' then array['eyebrow', 'heading', 'text', 'points', 'action', 'image', 'alt']
    when 'text' then array['heading', 'body']
    when 'rules' then array['heading', 'rules']
    when 'faq' then array['heading', 'questions']
    when 'careers' then array['heading', 'roles', 'apply']
    when 'map' then array['heading', 'address', 'hours', 'directionsUrl', 'phone', 'email']
    when 'games' then array['heading']
    when 'calendar' then array['heading']
    when 'links' then array['heading', 'links']
    when 'story' then array['eyebrow', 'heading', 'paragraphs', 'figures', 'action', 'image', 'alt']
    when 'cards' then array['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action']
    when 'marquee' then array['phrases']
    when 'timeline' then array['eyebrow', 'heading', 'intro', 'items']
    when 'table' then array['heading', 'intro', 'columns', 'rows', 'note']
    when 'promotions' then array['heading']
    else array[]::text[]
  end;
$$;

-- As 20261018092400_site_pages.sql left it, but each block's content only its kind's public keys.
create or replace function private.public_site_block_rows()
returns table (venue_slug text, page_slug text, "position" integer, kind text, content jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, p.slug, b.position, b.kind,
         (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(b.content) e
          where e.key = any (private.site_block_public_keys(b.kind)))
  from public.site_block b
  join public.site_page p on p.id = b.page_id
  join public.venue v on v.id = p.venue_id
  where p.is_published and not v.is_practice;
$$;

create unique index site_block_one_hero_idx on public.site_block (page_id) where kind = 'hero';
