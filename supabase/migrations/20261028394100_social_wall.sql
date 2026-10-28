-- The social wall (#157, #158; decision 0267). Public Instagram posts that tag the club are pulled every five minutes by
-- the social-wall Edge Function (Instagram's Graph API, through @rivr/adapters instagram-graph) into a moderation queue.
-- Staff who publish marketing approve or reject each one. Approved posts rotate on a TV showing the social wall and
-- in the website's social wall block (public_wall_posts), never the practice venue's. A post shows its poster's public
-- Instagram handle and caption.

create table public.wall_post (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- Instagram's id for the post.
  source_id text not null check (length(source_id) between 1 and 100),
  handle text not null check (length(handle) between 1 and 60),
  caption text not null default '' check (length(caption) <= 2200),
  media_url text not null check (media_url ~ '^https://'),
  media_kind text not null check (media_kind in ('image', 'video')),
  permalink text not null check (permalink ~ '^https://'),
  posted_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderated_by_staff_id uuid,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, source_id),
  foreign key (moderated_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((status = 'pending') = (moderated_at is null))
);
comment on table public.wall_post is 'A public Instagram post that tags the club (#157), pending, approved or rejected for the social wall.';
create index wall_post_status_idx on public.wall_post (venue_id, status, posted_at desc);
create index wall_post_staff_idx on public.wall_post (moderated_by_staff_id, venue_id);
create trigger wall_post_touch_updated_at before update on public.wall_post
  for each row execute function private.touch_updated_at();
create trigger wall_post_audit after insert or update or delete on public.wall_post
  for each row execute function private.audit_row_change();
alter table public.wall_post enable row level security;
grant select on public.wall_post to authenticated;
create policy "staff who publish marketing see the wall's posts" on public.wall_post
  for select to authenticated using (venue_id in (select private.venues_where('marketing.publish')));

-- Records the posts the social-wall function pulled for a venue; a post already held is left as it was. The service
-- role only, and never for the practice venue (22023). The number recorded.
create function private.record_wall_posts(p_venue_id uuid, p_posts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then
    raise exception 'Posts are recorded for a club, never the practice venue' using errcode = '22023';
  end if;
  insert into public.wall_post (venue_id, source_id, handle, caption, media_url, media_kind, permalink, posted_at)
  select p_venue_id, x.id, x.username, left(coalesce(x.caption, ''), 2200), x.media_url, x.media_kind, x.permalink, x.posted_at
  from jsonb_to_recordset(p_posts) as x (id text, username text, caption text, media_url text, media_kind text, permalink text, posted_at timestamptz)
  on conflict (venue_id, source_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Approves a post for the wall, or rejects it; either can be changed later. Refusals: 42501 not staff who publish
-- marketing; P0002 no such post; RVFRZ the venue frozen.
create function private.moderate_wall_post(p_venue_id uuid, p_post_id uuid, p_is_approved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'marketing.publish'), false) then
    raise exception 'Staff who publish marketing moderate the wall' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.wall_post
  set status = case when p_is_approved then 'approved' else 'rejected' end, moderated_by_staff_id = private.current_staff_id(p_venue_id),
      moderated_at = now()
  where id = p_post_id and venue_id = p_venue_id;
  if not found then
    raise exception 'No such post' using errcode = 'P0002';
  end if;
end;
$$;

-- The wall for a paired TV showing it: the newest twelve approved posts.
create function private.tv_social_wall()
returns table (handle text, caption text, posted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.handle, p.caption, p.posted_at
  from public.wall_post p
  where p.venue_id = private.tv_showing('social_wall') and p.status = 'approved'
  order by p.posted_at desc limit 12;
$$;

-- The website's wall: each club's newest approved posts, never the practice venue's.
create function private.public_wall_post_rows()
returns table (venue_slug text, handle text, caption text, permalink text, posted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, p.handle, p.caption, p.permalink, p.posted_at
  from public.venue v
  cross join lateral (select * from public.wall_post w where w.venue_id = v.id and w.status = 'approved' order by w.posted_at desc limit 12) p
  where not v.is_practice;
$$;
create view public.public_wall_posts
with (security_invoker = true)
as
select venue_slug, handle, caption, permalink, posted_at from private.public_wall_post_rows();
grant select on public.public_wall_posts to anon, authenticated;

-- A post approved, or taken off the wall, tells the venue's TVs at once (their half-minute read is the fallback).
create function private.signal_social_wall()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform private.signal_tv(new.venue_id, 'social_wall');
  end if;
  return null;
end;
$$;
create trigger wall_post_signal_tv after update on public.wall_post
  for each row execute function private.signal_social_wall();

-- The website's social wall block: a heading over the club's approved posts.
alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
                  'story', 'cards', 'marquee', 'timeline', 'table', 'promotions', 'social_wall'));

-- The keys the website reads for each kind of block, as 20261028393300_site_block_public_keys.sql left them, with the
-- social wall's.
create or replace function private.site_block_public_keys(p_kind text)
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
    when 'social_wall' then array['heading']
    else array[]::text[]
  end;
$$;

-- A club's website comes with the wall at the end of its home page: private.add_website, as
-- 20261027000200_website_comes_with_the_venue.sql made it, adds the pages, then the wall block. A club made before
-- (production's) gets the block below.
alter function private.add_website(uuid) rename to add_website_pages;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_pages(p_venue_id);
  insert into public.site_block (venue_id, page_id, position, kind, content)
  select p.venue_id, p.id, (select coalesce(max(b.position), 0) + 1 from public.site_block b where b.page_id = p.id), 'social_wall',
         '{"heading": "On Instagram"}'::jsonb
  from public.site_page p join public.venue v on v.id = p.venue_id and not v.is_practice
  where p.venue_id = p_venue_id and p.slug = 'home' and not exists (select 1 from public.site_block b where b.page_id = p.id and b.kind = 'social_wall');
end;
$$;
revoke execute on function private.add_website(uuid) from public, anon, authenticated;

-- The clubs' home pages end with the wall.
insert into public.site_block (venue_id, page_id, position, kind, content)
select p.venue_id, p.id, (select coalesce(max(b.position), 0) + 1 from public.site_block b where b.page_id = p.id), 'social_wall',
       '{"heading": "On Instagram"}'::jsonb
from public.site_page p join public.venue v on v.id = p.venue_id and not v.is_practice
where p.slug = 'home' and not exists (select 1 from public.site_block b where b.page_id = p.id and b.kind = 'social_wall');

create function public.record_wall_posts(p_venue_id uuid, p_posts jsonb)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.record_wall_posts(p_venue_id, p_posts); $$;
create function public.moderate_wall_post(p_venue_id uuid, p_post_id uuid, p_is_approved boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.moderate_wall_post(p_venue_id, p_post_id, p_is_approved); $$;
create function public.tv_social_wall()
returns table (handle text, caption text, posted_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_social_wall(); $$;

revoke execute on function private.record_wall_posts(uuid, jsonb), public.record_wall_posts(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.record_wall_posts(uuid, jsonb), public.record_wall_posts(uuid, jsonb) to service_role;
revoke execute on function private.public_wall_post_rows(), private.signal_social_wall() from public, anon, authenticated;
grant execute on function private.public_wall_post_rows() to anon, authenticated;
revoke execute on function private.moderate_wall_post(uuid, uuid, boolean), private.tv_social_wall(), public.moderate_wall_post(uuid, uuid, boolean),
  public.tv_social_wall() from public, anon;
grant execute on function private.moderate_wall_post(uuid, uuid, boolean), private.tv_social_wall(), public.moderate_wall_post(uuid, uuid, boolean),
  public.tv_social_wall() to authenticated;

-- pg_cron runs the pull every five minutes with the scheduler's secret (decision 0038).
select private.schedule_outbox_consumer('social-wall', '*/5 * * * *');
