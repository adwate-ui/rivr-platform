-- The website's pages and their blocks (#9; tech plan item 2, decision 0021). Marketing edits them
-- in the console (C-020); the website reads the published pages of real venues through the public
-- views below, never the practice venue. A block is a kind with its content as JSON, in the shape
-- @rivr/contracts siteBlockSchema checks; the website skips a block it cannot read.

create table public.site_page (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The page's address: `home` is the website's front page, every other slug is /<slug>.
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  title text not null check (length(trim(title)) between 1 and 80),
  -- The search engines' summary.
  description text check (length(description) <= 200),
  -- Its place in the website's navigation; null keeps it out.
  nav_position integer check (nav_position between 1 and 20),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, slug),
  unique (id, venue_id)
);

comment on table public.site_page is 'A page of a venue''s website: its address, title and place in the navigation.';

create table public.site_block (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  page_id uuid not null,
  position integer not null check (position between 1 and 100),
  kind text not null check (kind in ('hero', 'text')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (page_id, venue_id) references public.site_page (id, venue_id) on delete cascade,
  unique (page_id, position)
);

comment on table public.site_block is 'One block of a website page, in order: its kind and content.';

create index site_block_page_id_idx on public.site_block (page_id, venue_id);
create trigger site_page_touch_updated_at before update on public.site_page
  for each row execute function private.touch_updated_at();
create trigger site_page_audit after insert or update or delete on public.site_page
  for each row execute function private.audit_row_change();
create trigger site_block_touch_updated_at before update on public.site_block
  for each row execute function private.touch_updated_at();
create trigger site_block_audit after insert or update or delete on public.site_block
  for each row execute function private.audit_row_change();

alter table public.site_page enable row level security;
alter table public.site_block enable row level security;
-- Reads only for now: the console's editor (C-020) adds the writes.
grant select on public.site_page, public.site_block to authenticated;

create policy "website editors see the venue's pages" on public.site_page
  for select to authenticated
  using (venue_id in (select private.venues_where('website.edit')));

create policy "website editors see the venue's blocks" on public.site_block
  for select to authenticated
  using (venue_id in (select private.venues_where('website.edit')));

-- What anyone may read: the published pages of real venues, and their blocks.
create function private.public_site_page_rows()
returns table (venue_slug text, slug text, title text, description text, nav_position integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, p.slug, p.title, p.description, p.nav_position
  from public.site_page p join public.venue v on v.id = p.venue_id
  where p.is_published and not v.is_practice;
$$;

create function private.public_site_block_rows()
returns table (venue_slug text, page_slug text, "position" integer, kind text, content jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, p.slug, b.position, b.kind, b.content
  from public.site_block b
  join public.site_page p on p.id = b.page_id
  join public.venue v on v.id = p.venue_id
  where p.is_published and not v.is_practice;
$$;

grant execute on function private.public_site_page_rows(), private.public_site_block_rows() to anon, authenticated;

create view public.public_site_page
with (security_invoker = true)
as
select venue_slug, slug, title, description, nav_position from private.public_site_page_rows();

create view public.public_site_block
with (security_invoker = true)
as
select venue_slug, page_slug, "position", kind, content from private.public_site_block_rows();

grant select on public.public_site_page, public.public_site_block to anon, authenticated;
