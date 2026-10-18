-- Tier-gated features (additions, "Tier-gated features"). The feature catalogue mirrors
-- packages/contracts/src/features.ts; the tier x feature matrix is effective-dated with a display
-- mode per cell; a super_admin can grant or revoke one feature for one member.
-- has_feature() is the database check every policy and write function behind a gated feature uses.

create table public.feature (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z0-9_-]+)+$'),
  name text not null check (length(trim(name)) > 0),
  description text not null,
  screens text[] not null default '{}',
  -- Core features (sign-in, KYC, balance, withdrawals...) are never gated.
  is_gateable boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feature is
  'Global catalogue declared in code (packages/contracts/src/features.ts), so it has no venue_id. Licensed Learn sources add learn.source.<id> rows at upload.';

create trigger feature_touch_updated_at before update on public.feature
  for each row execute function private.touch_updated_at();

insert into public.feature (key, name, description, screens, is_gateable) values
  ('learn.library', 'Learn library', 'The Learn tab and its library of sources.', '{player:learn}', true),
  ('learn.drills', 'Drills', 'Drill sessions, verdicts and summaries.', '{player:learn/drill}', true),
  ('learn.review', 'Learn review', 'The review heatmap of past drill answers.', '{player:learn/review}', true),
  ('learn.academy_lessons', 'Academy lessons', 'RIVR Academy Level 1 to 3 lessons and quizzes.', '{player:learn/academy}', true),
  ('sessions.history', 'Session history', 'Past sessions with buy-in, cash-out, net and receipts.', '{player:sessions}', true),
  ('balance.deposits', 'Deposits', 'UPI deposit details and UTR entry.', '{player:balance/deposit}', true),
  ('rewards.catalogue', 'Rewards catalogue', 'Redeeming points for seats, upgrades and merchandise.', '{player:rewards/catalogue}', true),
  ('rewards.points_history', 'Points history', 'The movements on a member’s points ledger.', '{player:rewards/points}', true),
  ('league.standings', 'League', 'RIVR League standings and season.', '{player:rewards/league}', true),
  ('referral.share_cards', 'Referral and share cards', 'Referral code and rendered share cards.', '{player:rewards/referral}', true),
  ('cab.requests', 'Cab requests', 'Pickup and drop requests when eligible.', '{player:rewards/cab}', true),
  ('waitlist.join', 'Join waitlist from the app', 'Joining a waitlist before arrival.', '{player:home}', true),
  ('call_time.view', 'Call-time view', 'Time remaining before the member may leave the game.', '{player:home}', true),
  ('tournaments.register', 'Tournament registration', 'Registering and re-entering from the app.', '{player:home/tournament}', true),
  ('promotions.feed', 'Promotions feed', 'Promotion cards on Home.', '{player:home}', true),
  ('floor.live_view', 'Live floor view', 'Tables running, open seats and waitlist lengths.', '{player:home}', true),
  ('fnb.table_side', 'Table-side food and drink', 'Ordering food and drink from the table.', '{player:home/fnb}', true),
  ('academy.booking', 'Academy booking', 'Booking and paying for an Academy batch.', '{player:learn/academy,web:academy}', true),
  ('push.seat_ready', 'Seat-ready notifications', 'Push when a seat is ready.', '{player:profile/notifications}', true),
  ('push.call_time_complete', 'Call-time notifications', 'Push when call time is complete.', '{player:profile/notifications}', true),
  ('push.withdrawal_sent', 'Withdrawal notifications', 'Push when a withdrawal is sent.', '{player:profile/notifications}', true),
  ('push.tournament_starting', 'Tournament notifications', 'Push when a tournament is starting.', '{player:profile/notifications}', true),
  ('push.promotion_published', 'Promotion notifications', 'Push when a promotion is published.', '{player:profile/notifications}', true),
  ('core.sign_in', 'Sign-in', 'Mobile number and one-time code.', '{player:sign-in}', false),
  ('core.kyc', 'KYC', 'Identity verification.', '{player:kyc}', false),
  ('core.profile', 'Profile', 'KYC status, preferences.', '{player:profile}', false),
  ('core.limits', 'Limits and self-exclusion', 'Member-set limits, cool-off and self-exclusion.', '{player:profile/limits}', false),
  ('core.notification_settings', 'Notification settings', 'Choosing which notifications to receive.', '{player:profile/notifications}', false),
  ('core.membership_card', 'Membership card', 'The digital card with its rotating QR.', '{player:card}', false),
  ('core.balance_view', 'Balance', 'Cash, bonus, markers and movements.', '{player:balance}', false),
  ('core.withdrawals', 'Withdrawals', 'Withdrawing an existing balance.', '{player:balance/withdraw}', false),
  ('core.kill_switch_banner', 'Kill-switch banner', 'The banner shown while the venue is frozen.', '{player:*}', false),
  ('core.house_rules', 'House rules', 'The club’s house rules.', '{player:profile/rules,web:house-rules}', false);

create type public.feature_display_mode as enum ('hidden', 'locked');

-- One cell of the tier x feature matrix, in force from effective_from until a later row for the
-- same tier and feature. Cells are never edited; a change is a new row (and is audited).
create table public.tier_feature (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  tier_id uuid not null,
  feature_key text not null references public.feature (key),
  is_enabled boolean not null,
  -- How the entry point shows when the feature is not enabled: not at all, or locked with a notice.
  display_mode public.feature_display_mode not null default 'locked',
  effective_from timestamptz not null default now(),
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tier_id, venue_id) references public.tier (id, venue_id),
  unique (tier_id, feature_key, effective_from)
);

create index tier_feature_lookup_idx on public.tier_feature (tier_id, feature_key, effective_from desc);
create index tier_feature_venue_id_idx on public.tier_feature (venue_id);
create index tier_feature_feature_key_idx on public.tier_feature (feature_key);
create index tier_feature_created_by_idx on public.tier_feature (created_by_staff_id);

-- Grants or revokes one feature for one member, until ends_at or until revoked.
create table public.member_feature_override (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  feature_key text not null references public.feature (key),
  is_granted boolean not null,
  reason text not null check (length(trim(reason)) > 0),
  ends_at timestamptz,
  revoked_at timestamptz,
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

create index member_feature_override_lookup_idx on public.member_feature_override (member_id, feature_key, created_at desc);
create index member_feature_override_venue_id_idx on public.member_feature_override (venue_id);
create index member_feature_override_feature_key_idx on public.member_feature_override (feature_key);
create index member_feature_override_created_by_idx on public.member_feature_override (created_by_staff_id);

-- Only gateable features belong in the matrix or in overrides.
create function private.require_gateable_feature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.feature f where f.key = new.feature_key and f.is_gateable) then
    raise exception 'feature % is core and cannot be gated', new.feature_key using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tier_feature_gateable before insert on public.tier_feature
  for each row execute function private.require_gateable_feature();
create trigger member_feature_override_gateable before insert on public.member_feature_override
  for each row execute function private.require_gateable_feature();
create trigger tier_feature_immutable before update on public.tier_feature
  for each row execute function private.refuse_change();
create trigger member_feature_override_touch_updated_at before update on public.member_feature_override
  for each row execute function private.touch_updated_at();
create trigger tier_feature_audit after insert or update or delete on public.tier_feature
  for each row execute function private.audit_row_change();
create trigger member_feature_override_audit after insert or update or delete on public.member_feature_override
  for each row execute function private.audit_row_change();

-- The override in force for a member and feature now, if any: the newest active one.
create function private.active_override(p_member_id uuid, p_feature_key text)
returns public.member_feature_override
language sql
stable
security definer
set search_path = ''
as $$
  select o.* from public.member_feature_override o
  where o.member_id = p_member_id and o.feature_key = p_feature_key
    and o.revoked_at is null and (o.ends_at is null or o.ends_at > now())
  order by o.created_at desc
  limit 1;
$$;

-- The matrix cell in force now for a tier and feature, if any.
create function private.current_tier_cell(p_tier_id uuid, p_feature_key text)
returns public.tier_feature
language sql
stable
security definer
set search_path = ''
as $$
  select tf.* from public.tier_feature tf
  where tf.tier_id = p_tier_id and tf.feature_key = p_feature_key and tf.effective_from <= now()
  order by tf.effective_from desc
  limit 1;
$$;

-- Whether a member may use a feature now. Core features: always. Gateable features: an active
-- override decides; otherwise the member's tier cell in force; otherwise no. Unknown keys: no.
create function private.has_feature(p_member_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  feature_row public.feature;
  override_row public.member_feature_override;
begin
  select * into feature_row from public.feature f where f.key = p_feature_key;
  if not found then return false; end if;
  if not feature_row.is_gateable then return true; end if;
  override_row := private.active_override(p_member_id, p_feature_key);
  if override_row.id is not null then return override_row.is_granted; end if;
  return coalesce((
    select (private.current_tier_cell(m.tier_id, p_feature_key)).is_enabled
    from public.member m where m.id = p_member_id
  ), false);
end;
$$;

-- How a feature shows for a member: 'enabled', 'locked' (with the tiers that have it) or 'hidden'.
create function private.feature_state(p_member_id uuid, p_feature_key text)
returns table (state text, tiers text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  member_row public.member;
  cell public.tier_feature;
begin
  if private.has_feature(p_member_id, p_feature_key) then
    return query select 'enabled'::text, '{}'::text[];
    return;
  end if;
  select * into member_row from public.member m where m.id = p_member_id;
  cell := private.current_tier_cell(member_row.tier_id, p_feature_key);
  if coalesce(cell.display_mode, 'hidden') = 'hidden' then
    return query select 'hidden'::text, '{}'::text[];
    return;
  end if;
  return query
    select 'locked'::text, coalesce(array_agg(t.name order by t.rank), '{}')
    from public.tier t
    where t.venue_id = member_row.venue_id and not t.is_retired
      and coalesce((private.current_tier_cell(t.id, p_feature_key)).is_enabled, false);
end;
$$;

grant execute on function private.has_feature(uuid, text), private.feature_state(uuid, text),
  private.active_override(uuid, text), private.current_tier_cell(uuid, text)
  to authenticated, service_role;

-- What the apps' useFeature() reads: every feature's state for the signed-in member.
-- Staff, devices and the public get no rows. It runs with the caller's rights; the private
-- helpers it calls do the lookups the caller cannot.
create function public.my_feature_access()
returns table (feature_key text, state text, tiers text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select f.key, s.state, s.tiers
  from public.feature f
  cross join lateral private.feature_state((select private.current_member_id()), f.key) s
  where (select private.current_member_id()) is not null;
$$;

grant execute on function public.my_feature_access() to authenticated;

alter table public.feature enable row level security;
alter table public.tier_feature enable row level security;
alter table public.member_feature_override enable row level security;
grant select on public.feature to authenticated;
grant select, insert, delete on public.tier_feature to authenticated;
grant select, insert on public.member_feature_override to authenticated;
-- Revoking an override is the only change allowed to one.
grant update (revoked_at) on public.member_feature_override to authenticated;

create policy "everyone signed in reads the catalogue" on public.feature
  for select to authenticated using (true);

-- Members read their venue's matrix so Realtime tells open apps when a cell changes.
create policy "staff and members read the venue's matrix" on public.tier_feature
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or venue_id = (select private.current_member_venue_id()));

create policy "tier managers add matrix cells" on public.tier_feature
  for insert to authenticated
  with check (venue_id in (select private.venues_where('tiers.manage')) and effective_from >= now() - interval '1 minute');

create policy "tier managers withdraw cells not yet in force" on public.tier_feature
  for delete to authenticated
  using (venue_id in (select private.venues_where('tiers.manage')) and effective_from > now());

create policy "members see their overrides; member staff see the venue's" on public.member_feature_override
  for select to authenticated
  using (member_id = (select private.current_member_id()) or venue_id in (select private.venues_where('members.read')));

create policy "super admins grant overrides" on public.member_feature_override
  for insert to authenticated
  with check (venue_id in (select private.venues_where('members.override_features')));

create policy "super admins revoke overrides" on public.member_feature_override
  for update to authenticated
  using (venue_id in (select private.venues_where('members.override_features')))
  with check (venue_id in (select private.venues_where('members.override_features')));

-- Changes reach open apps without a reload.
alter publication supabase_realtime add table public.tier_feature, public.member_feature_override, public.member;
