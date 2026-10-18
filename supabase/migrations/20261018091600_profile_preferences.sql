-- Profile (#7; scope-v1 "Player app"): the games and the stake a member wants waitlist alerts for,
-- and the push notifications they want (lane C contract: notification_preference). Promotions are
-- a consent (public.consent, purpose marketing), never a preference. These are a member's own
-- choices: a freeze never stops them (as consent), and they are not audited, so the permanent audit
-- log holds staff actions, not every toggle.

create table public.member_preference (
  member_id uuid primary key,
  venue_id uuid not null,
  games text[] not null default '{}' check (games <@ array['nlh', 'plo', 'tournaments']::text[] and cardinality(games) <= 3),
  -- The stake for waitlist alerts as blinds in paise, as member.qualifying_*: 100/200 is 10000 and
  -- 20000. One of the club's table types (#34).
  small_blind bigint check (small_blind > 0),
  -- At most ₹10,00,000, well inside what an app can hold as a number.
  big_blind bigint check (big_blind > small_blind and big_blind <= 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((small_blind is null) = (big_blind is null))
);

comment on table public.member_preference is 'The games and the stake a member wants waitlist alerts for.';

create index member_preference_venue_id_idx on public.member_preference (venue_id);
create trigger member_preference_touch_updated_at before update on public.member_preference
  for each row execute function private.touch_updated_at();

-- A member's choice for one kind of push notification, named by its feature key. No row means on.
-- Promotion pushes follow the marketing consent instead.
create table public.notification_preference (
  member_id uuid not null,
  venue_id uuid not null,
  push_type text not null references public.feature (key)
    check (push_type like 'push.%' and push_type <> 'push.promotion_published'),
  is_on boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, push_type),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.notification_preference is 'Which push notifications a member wants; no row means on.';

create index notification_preference_venue_id_idx on public.notification_preference (venue_id);
create trigger notification_preference_touch_updated_at before update on public.notification_preference
  for each row execute function private.touch_updated_at();

alter table public.member_preference enable row level security;
alter table public.notification_preference enable row level security;
-- Reads only: members change theirs through the functions below.
grant select on public.member_preference, public.notification_preference to authenticated;

create policy "members see their own preferences" on public.member_preference
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy "members see their own notification choices" on public.notification_preference
  for select to authenticated
  using (member_id = (select private.current_member_id()));

-- The signed-in member saves their games and the stake for waitlist alerts.
create function private.save_my_preferences(p_games text[], p_small_blind bigint default null, p_big_blind bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null then
    raise exception 'Only a member has preferences' using errcode = '42501';
  end if;
  insert into public.member_preference (member_id, venue_id, games, small_blind, big_blind)
  values (v_member_id, v_venue_id, coalesce(array(select distinct g from unnest(p_games) as g), '{}'), p_small_blind, p_big_blind)
  on conflict (member_id) do update
  set games = excluded.games, small_blind = excluded.small_blind, big_blind = excluded.big_blind;
end;
$$;

-- The signed-in member turns one kind of push notification on or off, if their tier has it.
create function private.set_my_notification(p_push_type text, p_is_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null then
    raise exception 'Only a member has notification choices' using errcode = '42501';
  end if;
  if not private.has_feature(v_member_id, p_push_type) then
    raise exception 'This notification is not part of the member''s tier' using errcode = '42501';
  end if;
  insert into public.notification_preference (member_id, venue_id, push_type, is_on)
  values (v_member_id, v_venue_id, p_push_type, p_is_on)
  on conflict (member_id, push_type) do update set is_on = excluded.is_on;
end;
$$;

-- Whether a member gets a push of this kind (the push sender, lanes C and D): only if their tier has
-- the push feature (rule 8), and then on unless they turned it off; a promotion only with marketing
-- consent in force.
create function private.wants_push(p_member_id uuid, p_push_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_feature(p_member_id, p_push_type) and case
    when p_push_type = 'push.promotion_published' then private.has_consent(p_member_id, 'marketing')
    else coalesce((select n.is_on from public.notification_preference n
                   where n.member_id = p_member_id and n.push_type = p_push_type), true)
  end;
$$;

grant execute on function private.save_my_preferences(text[], bigint, bigint), private.set_my_notification(text, boolean)
  to authenticated;
grant execute on function private.wants_push(uuid, text) to service_role;

-- Whether the signed-in member's own consent for a purpose is in force. Profile asks this rather
-- than reading consent rows, which a login that is also staff could see for the whole venue.
create function private.has_my_consent(p_purpose text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_consent(private.current_member_id(), p_purpose);
$$;

grant execute on function private.has_my_consent(text) to authenticated;

-- Signed-in callers reach the private functions only through these invoker wrappers.
create function public.save_my_preferences(p_games text[], p_small_blind bigint default null, p_big_blind bigint default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.save_my_preferences(p_games, p_small_blind, p_big_blind);
$$;

create function public.set_my_notification(p_push_type text, p_is_on boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.set_my_notification(p_push_type, p_is_on);
$$;

create function public.has_my_consent(p_purpose text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_my_consent(p_purpose);
$$;

grant execute on function public.save_my_preferences(text[], bigint, bigint), public.set_my_notification(text, boolean),
  public.has_my_consent(text)
  to authenticated;
