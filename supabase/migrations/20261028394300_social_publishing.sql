-- One-click publishing (#154; decision 0269). Staff who publish marketing compose a post, an image and its caption, and
-- choose its channels: Instagram, Facebook, X, LinkedIn, YouTube, Telegram, Google Business Profile and WhatsApp
-- marketing. A channel without the club's credentials offers the image and caption to download and post by hand; no
-- channel has them yet, so every channel does. The image is kept in the public social-media bucket at <venue>/<file>,
-- as it is published anyway. Switching social publishing off stops new posts.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

-- Whether the caller publishes marketing at the venue a bucket path starts with, while the venue is not frozen and
-- social publishing is not switched off; any other name is refused.
create function private.may_upload_social_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{1,80}\.(jpg|png|webp)$'
              then coalesce(private.has_permission(split_part(p_name, '/', 1)::uuid, 'marketing.publish'), false)
                   and not exists (select 1 from public.control_state c
                                   where c.venue_id = split_part(p_name, '/', 1)::uuid and c.released_at is null
                                     and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'social_publishing')))
              else false end;
$$;
create policy "staff who publish marketing upload social media" on storage.objects
  for insert to authenticated with check (bucket_id = 'social-media' and (select private.may_upload_social_media(name)));

create table public.social_post (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  caption text not null check (length(caption) between 1 and 2200),
  -- In the social-media bucket.
  image_path text not null,
  created_by_staff_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  foreign key (created_by_staff_id, venue_id) references public.staff (id, venue_id)
);
comment on table public.social_post is 'A post published to the club''s social channels (#154): its image and caption.';
create index social_post_venue_idx on public.social_post (venue_id, created_at desc);
create index social_post_staff_idx on public.social_post (created_by_staff_id, venue_id);
create trigger social_post_touch_updated_at before update on public.social_post
  for each row execute function private.touch_updated_at();
create trigger social_post_audit after insert or update or delete on public.social_post
  for each row execute function private.audit_row_change();

create table public.social_post_channel (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  post_id uuid not null,
  channel text not null check (channel in ('instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp')),
  -- download: the channel has no credentials, so staff download the image and caption and post them by hand.
  status text not null check (status in ('download', 'published')),
  post_url text check (post_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, channel),
  foreign key (post_id, venue_id) references public.social_post (id, venue_id),
  check ((status = 'published') = (post_url is not null))
);
comment on table public.social_post_channel is 'Where a post went (#154): published, with its link, or to download and post by hand.';
create index social_post_channel_venue_idx on public.social_post_channel (post_id, venue_id);
create trigger social_post_channel_touch_updated_at before update on public.social_post_channel
  for each row execute function private.touch_updated_at();

alter table public.social_post enable row level security;
alter table public.social_post_channel enable row level security;
grant select on public.social_post, public.social_post_channel to authenticated;
create policy "staff who publish marketing see the posts" on public.social_post
  for select to authenticated using (venue_id in (select private.venues_where('marketing.publish')));
create policy "staff who publish marketing see where posts went" on public.social_post_channel
  for select to authenticated using (venue_id in (select private.venues_where('marketing.publish')));

-- Publishes a post to its channels: each without credentials (every one, for now) to download and post. Refusals:
-- 42501 not staff who publish marketing; 22023 no caption, no image of the venue's in the bucket, or no channel or one
-- not offered; RVFRZ or RVKIL the venue frozen or social publishing switched off.
create function private.publish_social_post(p_venue_id uuid, p_caption text, p_image_path text, p_channels text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'marketing.publish'), false) then
    raise exception 'Staff who publish marketing publish posts' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id, 'social_publishing');
  if coalesce(cardinality(p_channels), 0) = 0 or not (p_channels <@ array['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp'])
     or not exists (select 1 from storage.objects o where o.bucket_id = 'social-media' and o.name = p_image_path and split_part(p_image_path, '/', 1) = p_venue_id::text) then
    raise exception 'A caption, the venue''s uploaded image, and channels from those offered' using errcode = '22023';
  end if;
  insert into public.social_post (venue_id, caption, image_path, created_by_staff_id)
  values (p_venue_id, btrim(coalesce(p_caption, '')), p_image_path, private.current_staff_id(p_venue_id))
  returning id into v_id;
  insert into public.social_post_channel (venue_id, post_id, channel, status)
  select distinct p_venue_id, v_id, c, 'download' from unnest(p_channels) c;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A caption, the venue''s uploaded image, and channels from those offered' using errcode = '22023';
end;
$$;

create function public.publish_social_post(p_venue_id uuid, p_caption text, p_image_path text, p_channels text[])
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.publish_social_post(p_venue_id, p_caption, p_image_path, p_channels); $$;

revoke execute on function private.may_upload_social_media(text) from public, anon;
grant execute on function private.may_upload_social_media(text) to authenticated;
revoke execute on function private.publish_social_post(uuid, text, text, text[]), public.publish_social_post(uuid, text, text, text[]) from public, anon;
grant execute on function private.publish_social_post(uuid, text, text, text[]), public.publish_social_post(uuid, text, text, text[]) to authenticated;
