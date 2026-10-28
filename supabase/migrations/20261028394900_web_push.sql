-- Web push (#139, #338; decision 0272). A member turns notifications on for a phone in Profile: the player app's service
-- worker subscribes with the club's VAPID public key, and the subscription is kept here, one row per browser. The push
-- consumer sends each event to the member's phones when they want that kind (private.wants_push: their tier has it and
-- they have not turned it off; a promotion only with marketing consent): seat ready, call time done, withdrawal sent,
-- tournament starting, a promotion offered, and their own session reminder. Practice-venue events never reach it.

create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- The browser's push service address, one row each: a phone that changes hands moves to its new member. Only the
  -- browsers' own push services (Chrome's, Firefox's, Apple's, Windows'), so a member cannot point pushes anywhere else.
  endpoint text not null unique check (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/\S+$' and length(endpoint) <= 2000),
  -- The browser's keys for encrypting what is sent to it (RFC 8291), base64url.
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{20,200}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{8,100}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.push_subscription is 'The phones a member turned push notifications on for: each browser''s push address and keys.';

create index push_subscription_venue_id_idx on public.push_subscription (venue_id);
create index push_subscription_member_id_idx on public.push_subscription (member_id);
create trigger push_subscription_touch_updated_at before update on public.push_subscription
  for each row execute function private.touch_updated_at();

-- Nobody reads it but the push consumer: members save and remove their phones through the functions below.
alter table public.push_subscription enable row level security;
revoke all on public.push_subscription from anon, authenticated;

-- A member's export gives their phones' push addresses; the browser's keys stay out of it.
insert into private.member_export_column (table_name, column_name, kind) values
  ('push_subscription', 'id', 'owed'), ('push_subscription', 'venue_id', 'owed'), ('push_subscription', 'member_id', 'owed'),
  ('push_subscription', 'endpoint', 'owed'), ('push_subscription', 'created_at', 'owed'), ('push_subscription', 'updated_at', 'owed'),
  ('push_subscription', 'p256dh', 'withheld'), ('push_subscription', 'auth', 'withheld');

-- The signed-in member's phone: keeps its subscription, moving it to them if the browser was another member's (the same
-- browser presents the same keys, so nobody who merely knows an address takes it). A member keeps their five latest phones.
create function private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null then
    raise exception 'Only a member has push notifications' using errcode = '42501';
  end if;
  insert into public.push_subscription (venue_id, member_id, endpoint, p256dh, auth)
  values (private.current_member_venue_id(), v_member_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set venue_id = excluded.venue_id, member_id = excluded.member_id, p256dh = excluded.p256dh, updated_at = now()
  where public.push_subscription.auth = excluded.auth;
  delete from public.push_subscription s
  where s.member_id = v_member_id
    and s.id not in (select k.id from public.push_subscription k where k.member_id = v_member_id order by k.updated_at desc, k.id limit 5);
end;
$$;

-- The signed-in member turns notifications off for a phone of theirs.
create function private.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscription s where s.endpoint = p_endpoint and s.member_id = private.current_member_id();
$$;

-- Where a push of this kind goes for a member of the venue (the push consumer, service role): each of their phones,
-- when they want it. A session reminder (no kind) is the member's own setting, so it goes whenever they have a phone.
-- A promotion only as WhatsApp offers it (private.offer_recipient): while it runs, to a tier with promotions.feed, with
-- marketing sends on. Never at the practice venue, and never for an erased member.
create function private.push_targets(p_venue_id uuid, p_member_id uuid, p_push_type text, p_promotion_id uuid)
returns table (endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscription s
  join public.member m on m.id = s.member_id and m.erased_at is null
  join public.venue v on v.id = s.venue_id and not v.is_practice
  where s.venue_id = p_venue_id and s.member_id = p_member_id
    and (p_push_type is null or private.wants_push(p_member_id, p_push_type))
    and (p_promotion_id is null or exists (select 1 from private.offer_recipient(p_venue_id, p_member_id, p_promotion_id)))
  order by s.updated_at desc, s.id
  limit 5;
$$;

-- A phone whose browser dropped its subscription (the push service answered 404 or 410).
create function private.forget_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscription s where s.endpoint = p_endpoint;
$$;

-- Tournament starting: when a tournament's clock starts, each member with a place in it (seated or an alternate) is told
-- once, however many entries they have.
create function private.emit_tournament_starting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  for v_member_id in
    select distinct e.member_id from public.tournament_entry e where e.tournament_id = new.id and e.status in ('seated', 'alternate')
  loop
    perform private.emit(new.venue_id, 'tournament.starting',
                         jsonb_build_object('tournament_id', new.id, 'member_id', v_member_id, 'name', new.name),
                         'tournament.starting:' || new.id || ':' || v_member_id);
  end loop;
  return null;
end;
$$;

create trigger tournament_starting after update of clock_started_at on public.tournament
  for each row when (old.clock_started_at is null and new.clock_started_at is not null)
  execute function private.emit_tournament_starting();

-- As 20261028394200_social_inbox.sql made it, deleting the member's phones too.
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
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.save_push_subscription(p_endpoint, p_p256dh, p_auth); $$;
create function public.remove_push_subscription(p_endpoint text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_push_subscription(p_endpoint); $$;
create function public.push_targets(p_venue_id uuid, p_member_id uuid, p_push_type text default null, p_promotion_id uuid default null)
returns table (endpoint text, p256dh text, auth text)
language sql stable security invoker set search_path = ''
as $$ select * from private.push_targets(p_venue_id, p_member_id, p_push_type, p_promotion_id); $$;
create function public.forget_push_subscription(p_endpoint text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.forget_push_subscription(p_endpoint); $$;

revoke execute on function private.save_push_subscription(text, text, text), private.remove_push_subscription(text),
  private.push_targets(uuid, uuid, text, uuid), private.forget_push_subscription(text), private.emit_tournament_starting(),
  public.save_push_subscription(text, text, text), public.remove_push_subscription(text), public.push_targets(uuid, uuid, text, uuid),
  public.forget_push_subscription(text) from public, anon, authenticated;
grant execute on function private.save_push_subscription(text, text, text), private.remove_push_subscription(text),
  public.save_push_subscription(text, text, text), public.remove_push_subscription(text) to authenticated;
grant execute on function private.push_targets(uuid, uuid, text, uuid), private.forget_push_subscription(text),
  public.push_targets(uuid, uuid, text, uuid), public.forget_push_subscription(text) to service_role;

select private.schedule_outbox_consumer('push');
