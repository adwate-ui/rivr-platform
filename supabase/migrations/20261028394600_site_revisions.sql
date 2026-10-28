-- The website editor (#129; features "Website editing"; additions flow 17; decision 0270). Staff with website.edit edit a
-- page's blocks as a draft, preview the draft on the website itself by its preview token (public_site_preview), and
-- publish it now or at a time
-- (pg_cron publishes it within the minute). Each version a page has shown is a revision kept with its blocks, so its
-- history can be read and any earlier version published again in one click. The first edit of a page keeps what it
-- showed until then as its first revision. Publishing replaces the page's blocks, which the public views read; the
-- website renders each page on request, so a publish is live at once and there is no cache to purge.

create table public.site_revision (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  page_id uuid not null,
  -- The page's blocks in order, each {kind, content} as @rivr/contracts siteBlockSchema has them.
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  status text not null check (status in ('draft', 'scheduled', 'published', 'replaced')),
  publish_at timestamptz,
  published_at timestamptz,
  -- The website's preview of a draft is reached by this token alone.
  preview_token uuid not null default gen_random_uuid() unique,
  created_by_staff_id uuid not null,
  -- Who scheduled it: the publish goes ahead only while they still edit the website.
  scheduled_by_staff_id uuid,
  -- The clock, so revisions made in one transaction keep their order.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  foreign key (page_id, venue_id) references public.site_page (id, venue_id),
  foreign key (created_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (scheduled_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((status = 'scheduled') = (publish_at is not null)),
  check ((status = 'scheduled') = (scheduled_by_staff_id is not null)),
  check (status not in ('published', 'replaced') or published_at is not null)
);
comment on table public.site_revision is 'A version of a website page (#129): a draft, scheduled, published, or replaced by a later one.';
-- One draft (or scheduled draft) a page.
create unique index site_revision_draft_idx on public.site_revision (page_id) where status in ('draft', 'scheduled');
create index site_revision_page_idx on public.site_revision (page_id, venue_id, created_at desc);
create index site_revision_staff_idx on public.site_revision (created_by_staff_id, venue_id);
create index site_revision_scheduler_idx on public.site_revision (scheduled_by_staff_id, venue_id);
-- One version on the website a page.
create unique index site_revision_published_idx on public.site_revision (page_id) where status = 'published';
create index site_revision_due_idx on public.site_revision (publish_at) where status = 'scheduled';
create trigger site_revision_touch_updated_at before update on public.site_revision
  for each row execute function private.touch_updated_at();
create trigger site_revision_audit after insert or update or delete on public.site_revision
  for each row execute function private.audit_row_change();
alter table public.site_revision enable row level security;
grant select on public.site_revision to authenticated;
create policy "staff who edit the website see its revisions" on public.site_revision
  for select to authenticated using (venue_id in (select private.venues_where('website.edit')));

-- A page's blocks as it shows them now, in order.
create function private.site_page_blocks(p_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', b.kind, 'content', b.content) order by b.position), '[]'::jsonb)
  from public.site_block b where b.page_id = p_page_id;
$$;

-- Puts a revision on the website: the page's blocks become the revision's, and the one it shows replaces the last.
create function private.apply_site_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.site_revision;
begin
  select * into v_revision from public.site_revision r where r.id = p_revision_id;
  perform 1 from public.site_page p where p.id = v_revision.page_id for update;
  update public.site_revision r set status = 'replaced' where r.page_id = v_revision.page_id and r.status = 'published';
  delete from public.site_block b where b.page_id = v_revision.page_id;
  insert into public.site_block (venue_id, page_id, position, kind, content)
  select v_revision.venue_id, v_revision.page_id, e.n, e.block ->> 'kind', e.block -> 'content'
  from jsonb_array_elements(v_revision.blocks) with ordinality as e (block, n);
  update public.site_revision r set status = 'published', published_at = now(), publish_at = null, scheduled_by_staff_id = null where r.id = v_revision.id;
end;
$$;

-- The website editor's guard: staff who edit the website at a venue not frozen, and a page of that venue (P0002 if not).
create function private.assert_site_editor(p_venue_id uuid, p_page_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'website.edit'), false) then
    raise exception 'Staff who edit the website edit its pages' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if not exists (select 1 from public.site_page p where p.id = p_page_id and p.venue_id = p_venue_id) then
    raise exception 'No such page' using errcode = 'P0002';
  end if;
end;
$$;

-- Saves a page's draft: its blocks, each {kind, content}. A scheduled draft stays scheduled. The first edit of a page
-- keeps what it showed as its first revision. The draft's preview token. Refusals: 42501; P0002; 22023 no blocks, more than 100, or one without a kind
-- and content; RVFRZ the venue frozen.
create function private.save_site_draft(p_venue_id uuid, p_page_id uuid, p_blocks jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
  v_token uuid;
begin
  perform private.assert_site_editor(p_venue_id, p_page_id);
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) not between 1 and 100
     or exists (select 1 from jsonb_array_elements(p_blocks) b where jsonb_typeof(b -> 'content') is distinct from 'object' or coalesce(b ->> 'kind', '') = '') then
    raise exception 'From 1 to 100 blocks, each with its kind and content' using errcode = '22023';
  end if;
  v_staff_id := private.current_staff_id(p_venue_id);
  if not exists (select 1 from public.site_revision r where r.page_id = p_page_id) then
    insert into public.site_revision (venue_id, page_id, blocks, status, published_at, created_by_staff_id)
    values (p_venue_id, p_page_id, private.site_page_blocks(p_page_id), 'published', now(), v_staff_id);
  end if;
  update public.site_revision r set blocks = p_blocks
  where r.page_id = p_page_id and r.status in ('draft', 'scheduled')
  returning r.preview_token into v_token;
  if v_token is null then
    insert into public.site_revision (venue_id, page_id, blocks, status, created_by_staff_id)
    values (p_venue_id, p_page_id, p_blocks, 'draft', v_staff_id)
    returning preview_token into v_token;
  end if;
  return v_token;
end;
$$;

-- Publishes a page's draft now, or at a time to come (pg_cron publishes it within the minute, once tried now). When it goes live.
-- Refusals: 42501; P0002 no such page or no draft; 22023 a block the website cannot show (an unknown kind, or a
-- second hero); RVFRZ.
create function private.publish_site_draft(p_venue_id uuid, p_page_id uuid, p_publish_at timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft_id uuid;
begin
  perform private.assert_site_editor(p_venue_id, p_page_id);
  select r.id into v_draft_id from public.site_revision r where r.page_id = p_page_id and r.status in ('draft', 'scheduled');
  if v_draft_id is null then
    raise exception 'The page has no draft' using errcode = 'P0002';
  end if;
  if p_publish_at is not null and p_publish_at > now() then
    -- The draft must be one the website can show: tried, then undone.
    begin
      perform private.apply_site_revision(v_draft_id);
      raise exception 'tried' using errcode = 'RVTRY';
    exception when sqlstate 'RVTRY' then
      null;
    end;
    update public.site_revision r set status = 'scheduled', publish_at = p_publish_at, scheduled_by_staff_id = private.current_staff_id(p_venue_id)
    where r.id = v_draft_id;
    return p_publish_at;
  end if;
  perform private.apply_site_revision(v_draft_id);
  return now();
exception
  when check_violation or unique_violation or not_null_violation then
    raise exception 'A block the website cannot show' using errcode = '22023';
end;
$$;

-- Publishes an earlier version of a page again, as a new revision: one-click rollback. Refusals: 42501; P0002 no such
-- page or revision; RVFRZ.
create function private.rollback_site_page(p_venue_id uuid, p_page_id uuid, p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy_id uuid;
begin
  perform private.assert_site_editor(p_venue_id, p_page_id);
  insert into public.site_revision (venue_id, page_id, blocks, status, published_at, created_by_staff_id)
  select r.venue_id, r.page_id, r.blocks, 'replaced', now(), private.current_staff_id(p_venue_id)
  from public.site_revision r
  where r.id = p_revision_id and r.page_id = p_page_id and r.venue_id = p_venue_id and r.status in ('published', 'replaced')
  returning id into v_copy_id;
  if v_copy_id is null then
    raise exception 'No such version of the page' using errcode = 'P0002';
  end if;
  perform private.apply_site_revision(v_copy_id);
end;
$$;

-- Publishes the scheduled drafts whose time has come; pg_cron runs it every minute. A venue's drafts wait while it is
-- frozen, as its edits do. One whose scheduler no longer edits the website (left, revoked or moved off it), or that the
-- website cannot show, goes back to being a draft with one alert, rather than failing every minute.
create function private.publish_due_site_revisions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_count integer := 0;
begin
  for v_due in
    select r.id, r.venue_id, r.scheduled_by_staff_id from public.site_revision r
    where r.status = 'scheduled' and r.publish_at <= now()
      and not exists (select 1 from public.control_state c where c.venue_id = r.venue_id and c.level = 'venue_freeze' and c.released_at is null)
    order by r.publish_at
  loop
    begin
      if not exists (select 1 from public.staff s join public.role_permission rp on rp.role = s.role
                     where s.id = v_due.scheduled_by_staff_id and s.is_active and rp.permission = 'website.edit'
                       and not exists (select 1 from public.control_state c where c.staff_id = s.id and c.level = 'access_revoke' and c.released_at is null)) then
        raise exception 'The scheduler no longer edits the website' using errcode = '42501';
      end if;
      perform private.apply_site_revision(v_due.id);
      v_count := v_count + 1;
    exception when others then
      update public.site_revision r set status = 'draft', publish_at = null, scheduled_by_staff_id = null where r.id = v_due.id;
      perform private.raise_alert(v_due.venue_id, 'website.publish_failed', jsonb_build_object('revision_id', v_due.id));
    end;
  end loop;
  return v_count;
end;
$$;
select cron.schedule('site-publish', '* * * * *', 'select private.publish_due_site_revisions()');

-- A draft as the website previews it: the page and the draft's blocks in order, each block's content only its kind's
-- public keys, for the draft whose preview token the request carries in its x-site-preview header (the website's
-- server sends it); nothing for a request without one, and never the practice venue's, as the website shows nothing of it. The website reads it through public_site_preview, as it reads
-- every page.
create function private.public_site_preview_rows()
returns table (page_slug text, title text, description text, "position" integer, kind text, content jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with asked as (
    select nullif(current_setting('request.headers', true), '')::json ->> 'x-site-preview' as token
  )
  select p.slug, p.title, p.description, e.n::integer, e.block ->> 'kind',
         (select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) from jsonb_each(e.block -> 'content') c
          where c.key = any (private.site_block_public_keys(e.block ->> 'kind')))
  from asked
  -- A case, so only a token's shape is ever read as a uuid.
  join public.site_revision r
    on r.preview_token = case when asked.token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then asked.token::uuid end
  join public.site_page p on p.id = r.page_id
  join public.venue v on v.id = r.venue_id and not v.is_practice
  cross join lateral jsonb_array_elements(r.blocks) with ordinality as e (block, n)
  where r.status in ('draft', 'scheduled');
$$;
create view public.public_site_preview
with (security_invoker = true)
as
select page_slug, title, description, position, kind, content from private.public_site_preview_rows();
grant select on public.public_site_preview to anon, authenticated;

create function public.save_site_draft(p_venue_id uuid, p_page_id uuid, p_blocks jsonb)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_site_draft(p_venue_id, p_page_id, p_blocks); $$;
create function public.publish_site_draft(p_venue_id uuid, p_page_id uuid, p_publish_at timestamptz default null)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.publish_site_draft(p_venue_id, p_page_id, p_publish_at); $$;
create function public.rollback_site_page(p_venue_id uuid, p_page_id uuid, p_revision_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.rollback_site_page(p_venue_id, p_page_id, p_revision_id); $$;

revoke execute on function private.site_page_blocks(uuid), private.apply_site_revision(uuid), private.assert_site_editor(uuid, uuid),
  private.publish_due_site_revisions() from public, anon, authenticated;
revoke execute on function private.save_site_draft(uuid, uuid, jsonb), private.publish_site_draft(uuid, uuid, timestamptz),
  private.rollback_site_page(uuid, uuid, uuid), public.save_site_draft(uuid, uuid, jsonb), public.publish_site_draft(uuid, uuid, timestamptz),
  public.rollback_site_page(uuid, uuid, uuid) from public, anon;
grant execute on function private.save_site_draft(uuid, uuid, jsonb), private.publish_site_draft(uuid, uuid, timestamptz),
  private.rollback_site_page(uuid, uuid, uuid), public.save_site_draft(uuid, uuid, jsonb), public.publish_site_draft(uuid, uuid, timestamptz),
  public.rollback_site_page(uuid, uuid, uuid) to authenticated;
revoke execute on function private.public_site_preview_rows() from public;
grant execute on function private.public_site_preview_rows() to anon, authenticated;

-- A page's versions are the website's own content, as its pages and blocks are: a practice reset and a go-live purge
-- keep them. As 20261028110000_cctv.sql left the list, with site_revision.
create or replace function private.practice_reset_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['audit_log', 'staff', 'staff_credential', 'device', 'device_pairing', 'tablet_assignment', 'computer_enrolment',
               'tv_screen', 'venue_config', 'setting', 'tier', 'tier_feature', 'chip_denomination', 'table_type', 'game_table',
               'invoice_series', 'sop', 'sop_version', 'sop_ack', 'quiz', 'quiz_attempt', 'site_block', 'site_page', 'site_revision', 'control_state',
               'contact', 'drill', 'camera'];
$$;
