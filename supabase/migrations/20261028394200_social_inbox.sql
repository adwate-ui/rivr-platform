-- The social inbox (#156; decision 0268). Meta's webhook (the social-inbox Edge Function, its signature checked against
-- the app secret) brings Instagram and Facebook messages and WhatsApp messages. Each conversation is a lead, with its
-- messages; a WhatsApp lead is linked to the member with that number, at once or when they sign up, and to whoever
-- takes the number on a phone change. Staff who publish marketing read the leads in the console. Never the practice
-- venue. A member's erasure deletes their leads and messages.

create table public.lead (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  channel text not null check (channel in ('instagram', 'facebook', 'whatsapp')),
  -- The conversation: the sender's id on Instagram and Facebook, their number on WhatsApp.
  thread_id text not null check (length(thread_id) between 1 and 100),
  -- Who wrote: the sender's id, or their number with its + on WhatsApp.
  handle text not null check (length(handle) between 1 and 100),
  first_message text not null check (length(first_message) <= 1000),
  last_message_at timestamptz not null,
  member_id uuid,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  unique (venue_id, channel, thread_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((member_id is null) = (linked_at is null))
);
comment on table public.lead is 'A conversation on Instagram, Facebook or WhatsApp (#156): a lead, linked to the member it became.';
create index lead_last_idx on public.lead (venue_id, last_message_at desc);
create index lead_member_idx on public.lead (member_id, venue_id);
create index lead_whatsapp_idx on public.lead (venue_id, handle) where channel = 'whatsapp' and member_id is null;
create trigger lead_touch_updated_at before update on public.lead
  for each row execute function private.touch_updated_at();

create table public.inbox_message (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  lead_id uuid not null,
  -- Meta's id for the message.
  source_id text not null check (length(source_id) between 1 and 200),
  text text not null check (length(text) <= 4000),
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, source_id),
  foreign key (lead_id, venue_id) references public.lead (id, venue_id)
);
comment on table public.inbox_message is 'A message in a lead''s conversation (#156).';
create index inbox_message_lead_idx on public.inbox_message (lead_id, venue_id);
create trigger inbox_message_touch_updated_at before update on public.inbox_message
  for each row execute function private.touch_updated_at();

alter table public.lead enable row level security;
alter table public.inbox_message enable row level security;
grant select on public.lead, public.inbox_message to authenticated;
create policy "staff who publish marketing see the leads" on public.lead
  for select to authenticated using (venue_id in (select private.venues_where('marketing.publish')));
create policy "staff who publish marketing see the leads' messages" on public.inbox_message
  for select to authenticated using (venue_id in (select private.venues_where('marketing.publish')));

-- A member's export gives the leads linked to them whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind)
select 'lead', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'channel', 'thread_id', 'handle', 'first_message', 'last_message_at', 'member_id', 'linked_at', 'created_at',
                  'updated_at']) c (column_name);

-- Records the webhook's messages for a venue: each conversation a lead (a WhatsApp one linked to the member with that
-- number), each message once. The service role only, never the practice venue (22023). The number of new messages.
create function private.record_inbox_messages(p_venue_id uuid, p_messages jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then
    raise exception 'Messages are recorded for a club, never the practice venue' using errcode = '22023';
  end if;
  with messages as (
    select x.id, x.channel, x.thread_id, x.handle, x.text, x.received_at
    from jsonb_to_recordset(p_messages) as x (id text, channel text, thread_id text, handle text, text text, received_at timestamptz)
  ),
  leads as (
    insert into public.lead as target (venue_id, channel, thread_id, handle, first_message, last_message_at, member_id, linked_at)
    select distinct on (m.channel, m.thread_id) p_venue_id, m.channel, m.thread_id, m.handle, left(m.text, 1000), m.received_at, who.id,
           case when who.id is not null then now() end
    from messages m
    left join public.member who on m.channel = 'whatsapp' and who.venue_id = p_venue_id and who.phone = m.handle and who.erased_at is null
    order by m.channel, m.thread_id, m.received_at
    on conflict (venue_id, channel, thread_id) do update set last_message_at = greatest(target.last_message_at, excluded.last_message_at)
    returning target.id, target.channel, target.thread_id
  )
  insert into public.inbox_message (venue_id, lead_id, source_id, text, received_at)
  select p_venue_id, l.id, m.id, left(m.text, 4000), m.received_at
  from messages m join leads l on l.channel = m.channel and l.thread_id = m.thread_id
  on conflict (venue_id, source_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A member who signs up, or whose number changes, is linked to the WhatsApp leads from that number not yet linked.
create function private.link_member_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lead l set member_id = new.id, linked_at = now()
  where l.venue_id = new.venue_id and l.channel = 'whatsapp' and l.handle = new.phone and l.member_id is null;
  return null;
end;
$$;
create trigger member_link_leads after insert or update of phone on public.member
  for each row execute function private.link_member_leads();

-- The venue's leads, the latest conversation first, with how many messages and the member each became. Refusal: 42501
-- not staff who publish marketing.
create function private.venue_leads(p_venue_id uuid)
returns table (lead_id uuid, channel text, handle text, first_message text, last_message_at timestamptz, messages integer, member_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'marketing.publish'), false) then
    raise exception 'Staff who publish marketing read the leads' using errcode = '42501';
  end if;
  return query
  select l.id, l.channel, l.handle, l.first_message, l.last_message_at, (select count(*)::integer from public.inbox_message i where i.lead_id = l.id),
         m.full_name
  from public.lead l left join public.member m on m.id = l.member_id
  where l.venue_id = p_venue_id
  order by l.last_message_at desc, l.id
  limit 200;
end;
$$;

-- As 20261028393700_learn_progress.sql left it, with a member's leads and their messages deleted.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.learn_attempt x where x.member_id = p_member.id;
  delete from public.learn_card x where x.member_id = p_member.id;
  delete from public.learn_session x where x.member_id = p_member.id;
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.record_inbox_messages(p_venue_id uuid, p_messages jsonb)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.record_inbox_messages(p_venue_id, p_messages); $$;
create function public.venue_leads(p_venue_id uuid)
returns table (lead_id uuid, channel text, handle text, first_message text, last_message_at timestamptz, messages integer, member_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_leads(p_venue_id); $$;

revoke execute on function private.record_inbox_messages(uuid, jsonb), public.record_inbox_messages(uuid, jsonb), private.link_member_leads()
  from public, anon, authenticated;
grant execute on function private.record_inbox_messages(uuid, jsonb), public.record_inbox_messages(uuid, jsonb) to service_role;
revoke execute on function private.venue_leads(uuid), public.venue_leads(uuid) from public, anon;
grant execute on function private.venue_leads(uuid), public.venue_leads(uuid) to authenticated;
