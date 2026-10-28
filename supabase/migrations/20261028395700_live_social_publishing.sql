-- Live publishing per channel (#586; decision 0281). A channel the club has connected (setting social.connected_channels,
-- once its secrets are set) is sent the post by the outbox consumer social-publish, which records the post's link; the
-- others still offer it to download and post (decision 0269). A channel refused, or connected in the setting but without
-- its secrets, falls back to download and post. Never at the practice venue. Otherwise as in
-- 20261028394300_social_publishing.sql.
insert into public.setting_key (key, description, scope, value_schema) values
  ('social.connected_channels', 'The social channels the club has connected, with their secrets set: a post goes out to these by itself, and the others offer it to download and post. None set is none.', 'venue',
   '{"type":"object","properties":{"channels":{"maxItems":8,"type":"array","items":{"type":"string","enum":["instagram","facebook","x","linkedin","youtube","telegram","google_business_profile","whatsapp"]}}},"required":["channels"],"additionalProperties":false}');

-- sending: a connected channel, waiting for the consumer.
alter table public.social_post_channel drop constraint social_post_channel_status_check;
alter table public.social_post_channel add constraint social_post_channel_status_check check (status in ('download', 'sending', 'published'));

create or replace function private.publish_social_post(p_venue_id uuid, p_caption text, p_image_path text, p_channels text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  -- The connected channels, none at the practice venue, so nothing from it reaches a channel.
  v_connected text[] := case when (select v.is_practice from public.venue v where v.id = p_venue_id) then '{}'::text[]
    else array(select jsonb_array_elements_text(private.setting_at(p_venue_id, 'social.connected_channels', '', now()) -> 'channels')) end;
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
  select distinct p_venue_id, v_id, c, case when c = any (v_connected) then 'sending' else 'download' end from unnest(p_channels) c;
  if exists (select 1 from public.social_post_channel x where x.post_id = v_id and x.status = 'sending') then
    perform private.emit(p_venue_id, 'social.post_published', jsonb_build_object('post_id', v_id), 'social.post_published:' || v_id);
  end if;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A caption, the venue''s uploaded image, and channels from those offered' using errcode = '22023';
end;
$$;

-- What the consumer sends: the post's caption and image, and the channels still sending. With the venue frozen or social
-- publishing switched off since it was published, nothing goes: those channels fall back to download and post.
create function private.social_post_to_send(p_post_id uuid)
returns table (caption text, image_path text, channels text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if exists (select 1 from public.social_post p
             join public.control_state s on s.venue_id = p.venue_id and s.released_at is null
             where p.id = p_post_id and (s.level = 'venue_freeze' or (s.level = 'feature_kill' and s.feature = 'social_publishing'))) then
    update public.social_post_channel x set status = 'download' where x.post_id = p_post_id and x.status = 'sending';
    return;
  end if;
  return query
  select p.caption, p.image_path, array_agg(c.channel order by c.channel)
  from public.social_post p
  join public.social_post_channel c on c.post_id = p.id and c.status = 'sending'
  join public.venue v on v.id = p.venue_id and not v.is_practice
  where p.id = p_post_id
  group by p.caption, p.image_path;
end;
$$;

-- A channel's outcome: published, with the post's link; or, with no link, to download and post.
create function private.record_social_post_channel(p_post_id uuid, p_channel text, p_post_url text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.social_post_channel c
  set status = case when p_post_url is null then 'download' else 'published' end, post_url = p_post_url
  where c.post_id = p_post_id and c.channel = p_channel and c.status = 'sending';
$$;

create function public.social_post_to_send(p_post_id uuid)
returns table (caption text, image_path text, channels text[])
language sql volatile security invoker set search_path = ''
as $$ select * from private.social_post_to_send(p_post_id); $$;
create function public.record_social_post_channel(p_post_id uuid, p_channel text, p_post_url text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_social_post_channel(p_post_id, p_channel, p_post_url); $$;

revoke execute on function private.social_post_to_send(uuid), public.social_post_to_send(uuid),
  private.record_social_post_channel(uuid, text, text), public.record_social_post_channel(uuid, text, text) from public, anon, authenticated;
grant execute on function private.social_post_to_send(uuid), public.social_post_to_send(uuid),
  private.record_social_post_channel(uuid, text, text), public.record_social_post_channel(uuid, text, text) to service_role;

select private.schedule_outbox_consumer('social-publish');
