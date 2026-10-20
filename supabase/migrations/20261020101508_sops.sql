-- The SOP library (#51; scope-v1 module 11). An SOP has versions; each version names its owner (a job
-- title), the day it takes effect and the roles whose staff must acknowledge it, and is never changed:
-- a change is a new version. The version in force is the latest whose day has come (IST). Staff
-- acknowledge the version in force; staff with sops.manage add SOPs, publish versions and see who has
-- acknowledged. The training set (dealer certification, cage, women's safety, AML, table-side food and
-- drink) is loaded into every venue first (decision 0075).

create table public.sop (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  title text not null check (length(trim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  unique (venue_id, title)
);

comment on table public.sop is 'A standard operating procedure in the venue''s library; its text is in sop_version (#51).';

create trigger sop_touch_updated_at before update on public.sop
  for each row execute function private.touch_updated_at();
create trigger sop_audit after insert or update or delete on public.sop
  for each row execute function private.audit_row_change();

create table public.sop_version (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  sop_id uuid not null,
  version integer not null check (version > 0),
  -- Who keeps it current, by job title: Floor manager, General manager.
  owner text not null check (length(trim(owner)) between 1 and 80),
  -- The roles whose staff must acknowledge this version.
  ack_roles public.staff_role[] not null,
  -- In force from this day, in IST, until a later version's day comes.
  effective_on date not null,
  body text not null check (length(trim(body)) between 1 and 20000),
  -- Null for a version loaded by a migration.
  published_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  unique (sop_id, version),
  foreign key (sop_id, venue_id) references public.sop (id, venue_id),
  foreign key (published_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.sop_version is 'Each version of an SOP: owner, the day it takes effect, the roles that must acknowledge it, and its text; never changed (#51).';

create index sop_version_sop_venue_idx on public.sop_version (sop_id, venue_id);
create index sop_version_publisher_venue_idx on public.sop_version (published_by_staff_id, venue_id);
create trigger sop_version_append_only before update or delete on public.sop_version
  for each row execute function private.refuse_change();
create trigger sop_version_no_truncate before truncate on public.sop_version
  for each statement execute function private.refuse_change();
create trigger sop_version_audit after insert on public.sop_version
  for each row execute function private.audit_row_change();

create table public.sop_ack (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  sop_version_id uuid not null,
  staff_id uuid not null,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, staff_id),
  foreign key (sop_version_id, venue_id) references public.sop_version (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.sop_ack is 'A staff member''s acknowledgement of one SOP version (#51).';

create index sop_ack_version_venue_idx on public.sop_ack (sop_version_id, venue_id);
create index sop_ack_staff_venue_idx on public.sop_ack (staff_id, venue_id);
create trigger sop_ack_append_only before update or delete on public.sop_ack
  for each row execute function private.refuse_change();
create trigger sop_ack_no_truncate before truncate on public.sop_ack
  for each statement execute function private.refuse_change();
create trigger sop_ack_audit after insert on public.sop_ack
  for each row execute function private.audit_row_change();

alter table public.sop enable row level security;
alter table public.sop_version enable row level security;
alter table public.sop_ack enable row level security;
grant select on public.sop, public.sop_version, public.sop_ack to authenticated;

create policy "staff read their venue's SOPs" on public.sop
  for select to authenticated using (venue_id in (select private.staff_venues()));
create policy "staff read their venue's SOP versions" on public.sop_version
  for select to authenticated using (venue_id in (select private.staff_venues()));
create policy "staff see their own acknowledgements, and SOP managers the venue's" on public.sop_ack
  for select to authenticated
  using (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid()))
         or venue_id in (select private.venues_where('sops.manage')));

-- Today in IST, the day an SOP version's effective date is read against.
create function private.today_ist()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Adds a version to an SOP, numbered after the last, from today or a later day and never before the
-- last version's day, so versions take effect in order: staff with sops.manage at its venue only
-- (42501), not while frozen. Any other day is 22023.
create function private.publish_sop_version(p_sop_id uuid, p_owner text, p_ack_roles public.staff_role[], p_effective_on date, p_body text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sop public.sop;
  v_version integer;
begin
  -- Locked, so two versions published at once are numbered one after the other.
  select * into v_sop from public.sop s where s.id = p_sop_id for update;
  if v_sop.id is null or not private.has_permission(v_sop.venue_id, 'sops.manage') then
    raise exception 'Only SOP managers at the venue publish its SOPs' using errcode = '42501';
  end if;
  perform private.assert_writable(v_sop.venue_id, null, null);
  if p_effective_on is null or p_effective_on < private.today_ist()
     or p_effective_on < (select max(v.effective_on) from public.sop_version v where v.sop_id = v_sop.id) then
    raise exception 'A version takes effect today or later, and not before the last version' using errcode = '22023';
  end if;
  select coalesce(max(v.version), 0) + 1 into v_version from public.sop_version v where v.sop_id = v_sop.id;
  insert into public.sop_version (venue_id, sop_id, version, owner, ack_roles, effective_on, body, published_by_staff_id)
  values (v_sop.venue_id, v_sop.id, v_version, trim(p_owner), coalesce(p_ack_roles, '{}'), p_effective_on, p_body,
          private.current_staff_id(v_sop.venue_id));
  return v_version;
end;
$$;

-- Adds an SOP to the venue's library with its first version; a title the library has is 23505.
create function private.add_sop(p_venue_id uuid, p_title text, p_owner text, p_ack_roles public.staff_role[], p_effective_on date, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sop_id uuid;
begin
  if not private.has_permission(p_venue_id, 'sops.manage') then
    raise exception 'Only SOP managers at the venue add SOPs' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id, null, null);
  insert into public.sop (venue_id, title) values (p_venue_id, trim(p_title)) returning id into v_sop_id;
  perform private.publish_sop_version(v_sop_id, p_owner, p_ack_roles, p_effective_on, p_body);
  return v_sop_id;
end;
$$;

-- The version of an SOP in force today: the latest whose day has come.
create function private.sop_version_in_force(p_sop_id uuid)
returns public.sop_version
language sql
stable
security definer
set search_path = ''
as $$
  select v.* from public.sop_version v
  where v.sop_id = p_sop_id and v.effective_on <= private.today_ist()
  order by v.version desc limit 1;
$$;

-- The caller acknowledges an SOP version in force at their venue; again is the same acknowledgement.
-- Staff of another venue are 42501; a version not in force, say one just replaced, is RVSTL.
create function private.acknowledge_sop(p_version_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_version public.sop_version;
  v_staff_id uuid;
  v_at timestamptz;
begin
  select * into v_version from public.sop_version v where v.id = p_version_id;
  v_staff_id := private.current_staff_id(v_version.venue_id);
  if v_staff_id is null or not private.has_permission(v_version.venue_id, 'sops.acknowledge') then
    raise exception 'Only staff at the venue acknowledge its SOPs' using errcode = '42501';
  end if;
  if (private.sop_version_in_force(v_version.sop_id)).id is distinct from v_version.id then
    raise exception 'Only the version in force is acknowledged' using errcode = 'RVSTL';
  end if;
  insert into public.sop_ack (venue_id, sop_version_id, staff_id) values (v_version.venue_id, v_version.id, v_staff_id)
  on conflict (sop_version_id, staff_id) do nothing;
  select a.acknowledged_at into v_at from public.sop_ack a where a.sop_version_id = v_version.id and a.staff_id = v_staff_id;
  return v_at;
end;
$$;

-- The venue's library for its staff: each SOP with its version in force and the next waiting for its
-- day, whether the caller must acknowledge the one in force and when they did, and how many of the staff
-- it asks have.
create function private.sop_library(p_venue_id uuid)
returns table (sop_id uuid, title text, version_id uuid, version integer, owner text, ack_roles public.staff_role[],
               effective_on date, body text, next_version_id uuid, next_version integer, next_owner text,
               next_ack_roles public.staff_role[], next_effective_on date, next_body text, must_acknowledge boolean,
               acknowledged_at timestamptz, acknowledged_count integer, required_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select s.id, s.role from public.staff s where s.id = private.current_staff_id(p_venue_id))
  select s.id, s.title, c.id, c.version, c.owner, c.ack_roles, c.effective_on, c.body,
         n.id, n.version, n.owner, n.ack_roles, n.effective_on, n.body,
         coalesce(me.role = any (c.ack_roles), false), a.acknowledged_at,
         (select count(*)::integer from public.staff r join public.sop_ack k on k.staff_id = r.id and k.sop_version_id = c.id
          where r.venue_id = p_venue_id and r.is_active and r.role = any (c.ack_roles)),
         (select count(*)::integer from public.staff r where r.venue_id = p_venue_id and r.is_active and r.role = any (c.ack_roles))
  from public.sop s
  cross join me
  -- The version in force (none yet for an SOP whose first day is still to come), and the next to take
  -- effect: the soonest day, and of two on one day the later, which is the one in force that day.
  left join lateral private.sop_version_in_force(s.id) c on true
  left join lateral (
    select v.* from public.sop_version v
    where v.sop_id = s.id and v.effective_on > private.today_ist() order by v.effective_on, v.version desc limit 1
  ) n on true
  left join public.sop_ack a on a.sop_version_id = c.id and a.staff_id = me.id
  where s.venue_id = p_venue_id
  order by s.title;
$$;

-- For SOP managers: the active staff an SOP version asks to acknowledge it, and when each did.
create function private.sop_acknowledgements(p_version_id uuid)
returns table (staff_id uuid, full_name text, role public.staff_role, acknowledged_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.sop_version;
begin
  select * into v_version from public.sop_version v where v.id = p_version_id;
  if v_version.id is null or not private.has_permission(v_version.venue_id, 'sops.manage') then
    raise exception 'Only SOP managers see acknowledgements' using errcode = '42501';
  end if;
  return query
  select s.id, s.full_name, s.role, a.acknowledged_at
  from public.staff s
  left join public.sop_ack a on a.sop_version_id = v_version.id and a.staff_id = s.id
  where s.venue_id = v_version.venue_id and s.is_active and s.role = any (v_version.ack_roles)
  order by a.acknowledged_at nulls first, s.full_name;
end;
$$;

create function public.add_sop(p_venue_id uuid, p_title text, p_owner text, p_ack_roles public.staff_role[], p_effective_on date, p_body text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_sop(p_venue_id, p_title, p_owner, p_ack_roles, p_effective_on, p_body); $$;

create function public.publish_sop_version(p_sop_id uuid, p_owner text, p_ack_roles public.staff_role[], p_effective_on date, p_body text)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.publish_sop_version(p_sop_id, p_owner, p_ack_roles, p_effective_on, p_body); $$;

create function public.acknowledge_sop(p_version_id uuid)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.acknowledge_sop(p_version_id); $$;

create function public.sop_library(p_venue_id uuid)
returns table (sop_id uuid, title text, version_id uuid, version integer, owner text, ack_roles public.staff_role[],
               effective_on date, body text, next_version_id uuid, next_version integer, next_owner text,
               next_ack_roles public.staff_role[], next_effective_on date, next_body text, must_acknowledge boolean,
               acknowledged_at timestamptz, acknowledged_count integer, required_count integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.sop_library(p_venue_id); $$;

create function public.sop_acknowledgements(p_version_id uuid)
returns table (staff_id uuid, full_name text, role public.staff_role, acknowledged_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.sop_acknowledgements(p_version_id); $$;

-- The training set, loaded into a venue in force from the day it is loaded.
create function private.add_training_sops(p_venue_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sop record;
  v_sop_id uuid;
begin
  for v_sop in
    select * from (values
      ('Dealer certification', 'Floor manager', '{dealer}'::public.staff_role[],
       E'1. Sign in on the tablet at your table with your PIN before the first hand of your down.\n'
       '2. Log every hand once the pot is pushed: enter the pot, and the tablet works out the rake and the jackpot drop.\n'
       '3. Claim a high hand on the tablet with the hand it was dealt in; the floor approves it before anything is paid.\n'
       '4. Chips come only from the cage: send a buy-in request from the tablet and wait for the runner.\n'
       '5. If the tablet loses its connection, keep logging: hands wait on the tablet and go once it reconnects.\n'
       '6. At the end of your down, end it on the tablet and enter the drop-box count before you leave the table.\n'
       '7. Pass the dealer certification quiz in the practice venue before your first live down.'),
      ('Cage', 'Duty manager', '{cashier}'::public.staff_role[],
       E'1. Open the cage''s shift on the console and count the float by denomination before the first transaction.\n'
       '2. Sell chips only to a member whose identity check is complete, and record every buy-in and cash-out against the member.\n'
       '3. Confirm a UPI deposit only once its amount and UTR are found in the bank.\n'
       '4. Prepare withdrawals; a second staff member approves each one, never the one who prepared it.\n'
       '5. Issue a marker only within the member''s credit limit, signed by the member on the cage screen.\n'
       '6. While the venue is frozen, record nothing in the system: run the cage on paper until it is released.\n'
       '7. At the end of the shift, count the chips and cash and close the shift; a difference needs a reason from the floor manager.'),
      ('Women''s safety', 'General manager', '{super_admin,admin,cashier,dealer,marketing,host,owner_view}'::public.staff_role[],
       E'1. Every guest and every member of staff may ask any manager for help at any time.\n'
       '2. The duty manager answers a report at once, in person, and keeps the people involved apart.\n'
       '3. A guest who makes anyone feel unsafe is asked to leave, and is not seated again until the general manager decides.\n'
       '4. Walk any guest or member of staff who asks to their car or cab.\n'
       '5. Log every report in the incident log the same night, with the camera reference.\n'
       '6. Never discuss a report outside the managers handling it.'),
      ('Anti-money laundering', 'General manager', '{super_admin,admin,cashier}'::public.staff_role[],
       E'1. Sell chips only to a member with a complete identity check, and only for themselves.\n'
       '2. Record every buy-in and cash-out in the system as it happens; never split one into several.\n'
       '3. Pay withdrawals only to the member''s own verified payout account.\n'
       '4. Tell the duty manager about anything unusual: large cash with little play, chips passed between players, or a refusal to finish the identity check.\n'
       '5. The duty manager records the concern for review. Do not discuss it with the member.'),
      ('Table-side food and drink', 'Floor manager', '{dealer,host}'::public.staff_role[],
       E'1. Take a seated player''s order between hands and pass it to the host, who sends it to the bar.\n'
       '2. Food and drink never touch the felt: use the side tables and holders.\n'
       '3. A comp is given only when the floor manager allows it.\n'
       '4. Clear empty glasses and plates between hands, never during one.\n'
       '5. Tell the floor at once about a spill on the table; play waits until it is dry.')
    ) as t (title, owner, ack_roles, body)
  loop
    insert into public.sop (venue_id, title) values (p_venue_id, v_sop.title)
    on conflict (venue_id, title) do nothing returning id into v_sop_id;
    if v_sop_id is not null then
      insert into public.sop_version (venue_id, sop_id, version, owner, ack_roles, effective_on, body)
      values (p_venue_id, v_sop_id, 1, v_sop.owner, v_sop.ack_roles, private.today_ist(), v_sop.body);
    end if;
  end loop;
end;
$$;

revoke execute on function private.today_ist(), private.sop_version_in_force(uuid), private.add_training_sops(uuid)
  from public, anon, authenticated;
revoke execute on function
  private.publish_sop_version(uuid, text, public.staff_role[], date, text), private.add_sop(uuid, text, text, public.staff_role[], date, text),
  private.acknowledge_sop(uuid), private.sop_library(uuid), private.sop_acknowledgements(uuid),
  public.publish_sop_version(uuid, text, public.staff_role[], date, text), public.add_sop(uuid, text, text, public.staff_role[], date, text),
  public.acknowledge_sop(uuid), public.sop_library(uuid), public.sop_acknowledgements(uuid)
  from public, anon;
grant execute on function
  private.publish_sop_version(uuid, text, public.staff_role[], date, text), private.add_sop(uuid, text, text, public.staff_role[], date, text),
  private.acknowledge_sop(uuid), private.sop_library(uuid), private.sop_acknowledgements(uuid),
  public.publish_sop_version(uuid, text, public.staff_role[], date, text), public.add_sop(uuid, text, text, public.staff_role[], date, text),
  public.acknowledge_sop(uuid), public.sop_library(uuid), public.sop_acknowledgements(uuid)
  to authenticated;

select private.add_training_sops(v.id) from public.venue v;

-- A new venue gets the training set too: #50's bootstrap with one line more.
create or replace function private.bootstrap_venue(
  p_venue_id uuid,
  p_name text,
  p_slug text,
  p_is_practice boolean,
  p_legal_name text,
  p_address text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, true, 'locked', '-infinity'
  from public.tier t cross join public.feature f
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);

  return p_venue_id;
end;
$$;
