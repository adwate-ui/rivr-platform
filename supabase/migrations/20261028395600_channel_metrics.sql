-- Channel analytics (#164; decision 0280): each social channel's follower count, once a night, beside the members who
-- signed up from that channel's links (utm_source), through KYC and the first buy-in. Referral and creator codes stay
-- in the growth funnel (#166) on the same report. The nightly job is the Edge Function channel-analytics; a channel with no
-- follower count to read (Google Business Profile, WhatsApp) or no credentials yet is skipped.
create table public.channel_metric (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  channel text not null check (channel in ('instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp')),
  -- The venue's own date of the count, so a night has one count per channel.
  measured_on date not null,
  followers integer not null check (followers >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, channel, measured_on)
);
comment on table public.channel_metric is 'Each social channel''s follower count, one a night (#164).';
create trigger channel_metric_touch_updated_at before update on public.channel_metric
  for each row execute function private.touch_updated_at();

alter table public.channel_metric enable row level security;
grant select on public.channel_metric to authenticated;
create policy "staff who read reports see the venue's channel counts" on public.channel_metric
  for select to authenticated using (private.has_permission(venue_id, 'reports.read'));

-- The nightly job's counts, as [{channel, followers}]: tonight's for each, again if the job runs twice.
create function private.record_channel_followers(p_venue_id uuid, p_counts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then
    raise exception 'Channel counts are for a club venue' using errcode = '22023';
  end if;
  insert into public.channel_metric (venue_id, channel, measured_on, followers)
  select p_venue_id, c.channel, (now() at time zone v.time_zone)::date, c.followers
  from jsonb_to_recordset(p_counts) as c (channel text, followers integer)
  join public.venue v on v.id = p_venue_id
  on conflict (venue_id, channel, measured_on) do update set followers = excluded.followers;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Each channel, in the publishing order: its latest count and the count 30 days before that, and the members who signed
-- up from its links (a link's utm_source naming the channel, with no referral or creator code, as the growth funnel
-- counts a link), how many finished KYC and how many bought in.
create function private.channel_funnel(p_venue_id uuid)
returns table (channel text, followers integer, followers_30_days_ago integer, signed_up integer, kyc_done integer, bought_in integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_reports(p_venue_id);
  return query
  select ch.name, latest.followers, earlier.followers, count(m.id)::integer,
         (count(m.id) filter (where exists (select 1 from public.kyc_record k where k.member_id = m.id and k.status = 'verified')))::integer,
         (count(m.id) filter (where exists (select 1 from public.cage_transaction t where t.member_id = m.id and t.kind = 'buy_in')))::integer
  from unnest(array['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp']) with ordinality as ch (name, position)
  left join lateral (select x.followers, x.measured_on from public.channel_metric x
                     where x.venue_id = p_venue_id and x.channel = ch.name order by x.measured_on desc limit 1) latest on true
  left join lateral (select x.followers from public.channel_metric x
                     where x.venue_id = p_venue_id and x.channel = ch.name and x.measured_on <= latest.measured_on - 30
                     order by x.measured_on desc limit 1) earlier on true
  left join public.sign_up_attribution a on a.venue_id = p_venue_id and lower(a.utm_source::text) = ch.name
                                         and a.referral_code is null and a.creator_code is null
  left join public.member m on m.id = a.member_id and m.erased_at is null
  group by ch.name, ch.position, latest.followers, earlier.followers
  order by ch.position;
end;
$$;

create function public.record_channel_followers(p_venue_id uuid, p_counts jsonb)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.record_channel_followers(p_venue_id, p_counts); $$;
create function public.channel_funnel(p_venue_id uuid)
returns table (channel text, followers integer, followers_30_days_ago integer, signed_up integer, kyc_done integer, bought_in integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.channel_funnel(p_venue_id); $$;

revoke execute on function private.record_channel_followers(uuid, jsonb), public.record_channel_followers(uuid, jsonb),
  private.channel_funnel(uuid), public.channel_funnel(uuid) from public, anon, authenticated;
grant execute on function private.record_channel_followers(uuid, jsonb), public.record_channel_followers(uuid, jsonb) to service_role;
grant execute on function private.channel_funnel(uuid), public.channel_funnel(uuid) to authenticated;

-- 00:00 IST, after the day's posts.
select private.schedule_outbox_consumer('channel-analytics', '30 18 * * *');
