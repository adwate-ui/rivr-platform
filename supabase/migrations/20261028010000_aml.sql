-- AML: cash limits, structuring and the suspicious-activity register (#105; scope-v1 module 12; decision 0234).
-- By the owner's answers (27 Oct):
-- * Cash in is a cash buy-in at the cage, or a tournament entry paid in cash at the cage. Cash in that would take
--   the member past the visit's cash limit, or the club day's (06:00 to 06:00 IST), is refused (RVCLV, RVCLD).
--   UPI, the wallet and marker repayments are not counted.
-- * Structuring is several visits, or club days, begun within a window, whose cash in ended just under the limit:
--   3 in 7 days within 10% unless aml.structuring says otherwise. When cash in completes the pattern, the register
--   gets an entry with that cash in attached and the owner is alerted; while it is open, cash in of the pattern
--   joins it. A visit or day already reviewed does not open another.
-- * Staff who review AML (aml.review) close an entry with an outcome and a note. Only a super admin changes the
--   limits or the pattern, with a reason, and the owner hears of every change.
-- * No one is tipped off: the member's own data export leaves the register out, and the audit log names neither
--   the member nor the note.

insert into public.setting_key (key, description, scope, value_schema) values
  ('cage.cash_buy_in_limit',
   'AML (decision 0234): the most a member may buy in for cash in one visit and in one club day (06:00 to 06:00 IST); a cash buy-in past either is refused. Paise in whole ₹50 chips; nothing is no limit there.',
   'venue',
   '{"type": "object", "required": ["per_visit_paise", "per_day_paise"], "properties": {"per_visit_paise": {"type": "integer", "maximum": 1000000000, "minimum": 0, "multipleOf": 5000}, "per_day_paise": {"type": "integer", "maximum": 1000000000, "minimum": 0, "multipleOf": 5000}}, "additionalProperties": false}'),
  ('aml.structuring',
   'AML (decision 0234): structuring is this many visits, or club days, within this many days whose cash buy-ins ended within this margin under the limit (1,000 basis points is 10%). 3 in 7 days within 10% unless set.',
   'venue',
   '{"type": "object", "required": ["count", "window_days", "margin_basis_points"], "properties": {"count": {"type": "integer", "maximum": 20, "minimum": 2}, "window_days": {"type": "integer", "maximum": 90, "minimum": 1}, "margin_basis_points": {"type": "integer", "maximum": 5000, "minimum": 1}}, "additionalProperties": false}');

-- Only a super admin sets or removes the AML settings, with a reason, and the owner hears of every change a person
-- makes: nothing for a limit switches it off. (The seed, migrations and a practice reset have no one signed in.)
create function private.guard_aml_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.setting := case when tg_op = 'DELETE' then old else new end;
begin
  if (select auth.uid()) is null or coalesce(private.purging(v_row.venue_id), false) then
    return v_row;
  end if;
  if not private.has_permission(v_row.venue_id, 'venue.configure') then
    raise exception 'Only a super admin changes the AML settings' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and length(btrim(coalesce(new.reason, ''))) < 3 then
    raise exception 'A change to the AML settings needs a reason' using errcode = '22023';
  end if;
  perform private.raise_alert(v_row.venue_id, 'aml.settings_changed', jsonb_build_object('key', v_row.key, 'change', lower(tg_op)));
  return v_row;
end;
$$;

revoke execute on function private.guard_aml_settings() from public, anon, authenticated;

create trigger setting_aml_set before insert on public.setting
  for each row when (new.key in ('cage.cash_buy_in_limit', 'aml.structuring')) execute function private.guard_aml_settings();
create trigger setting_aml_removed before delete on public.setting
  for each row when (old.key in ('cage.cash_buy_in_limit', 'aml.structuring')) execute function private.guard_aml_settings();

-- @rivr/domain cashLimitHit (golden aml.json): which limit cash in would take the member past, the visit's first;
-- null within both. Nothing, or no limit, is no limit; reaching one exactly is within it.
create function private.cash_limit_hit(p_per_visit bigint, p_per_day bigint, p_visit_so_far bigint, p_day_so_far bigint, p_amount bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_per_visit, 0) > 0 and p_visit_so_far + p_amount > p_per_visit then 'visit'
              when coalesce(p_per_day, 0) > 0 and p_day_so_far + p_amount > p_per_day then 'day' end;
$$;

-- @rivr/domain isNearLimit (golden aml.json): whether a total ended within the margin under a limit, the limit
-- itself included, the margin rounded down to the paisa.
create function private.is_near_limit(p_total bigint, p_limit bigint, p_margin_basis_points integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_limit, 0) > 0 and p_total > 0 and p_total <= p_limit and p_total >= p_limit - p_limit * p_margin_basis_points / 10000;
$$;

-- ---------------------------------------------------------------------------------------------------
-- The register.

create table public.sar_entry (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  kind text not null check (kind in ('structuring_visit', 'structuring_day')),
  detected_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  outcome text check (outcome in ('no_action', 'monitor', 'reported')),
  note text check (length(btrim(note)) between 10 and 1000),
  reviewed_by_staff_id uuid references public.staff (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((status = 'reviewed') = (outcome is not null and note is not null and reviewed_by_staff_id is not null and reviewed_at is not null))
);
comment on table public.sar_entry is 'The suspicious-activity register (#105): a pattern found in a member''s cash in, and its review.';
create unique index sar_entry_open_idx on public.sar_entry (member_id, kind) where status = 'open';
create index sar_entry_venue_idx on public.sar_entry (venue_id, detected_at);

-- The cash in an entry is about: a cash buy-in at the cage, or a tournament entry paid in cash.
create table public.sar_entry_transaction (
  id uuid primary key default gen_random_uuid(),
  sar_entry_id uuid not null references public.sar_entry (id),
  venue_id uuid not null references public.venue (id),
  cage_transaction_id uuid references public.cage_transaction (id),
  tournament_purchase_id uuid references public.tournament_purchase (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(cage_transaction_id, tournament_purchase_id) = 1),
  unique (sar_entry_id, cage_transaction_id),
  unique (sar_entry_id, tournament_purchase_id)
);
comment on table public.sar_entry_transaction is 'The cash in a register entry is about (#105).';
create index sar_entry_transaction_venue_idx on public.sar_entry_transaction (venue_id);

create trigger sar_entry_touch_updated_at before update on public.sar_entry
  for each row execute function private.touch_updated_at();
-- An entry is reviewed once; it and its cash in are never taken away.
create trigger sar_entry_no_delete before delete on public.sar_entry
  for each row when (not coalesce(private.purging(old.venue_id), false)) execute function private.refuse_change();
create trigger sar_entry_transaction_append_only before update or delete on public.sar_entry_transaction
  for each row when (not coalesce(private.purging(old.venue_id), false)) execute function private.refuse_change();

alter table public.sar_entry enable row level security;
alter table public.sar_entry_transaction enable row level security;
grant select on public.sar_entry, public.sar_entry_transaction to authenticated;
create policy "AML reviewers see the venue's register" on public.sar_entry
  for select to authenticated using (private.has_permission(venue_id, 'aml.review'));
create policy "AML reviewers see the register's cash in" on public.sar_entry_transaction
  for select to authenticated using (private.has_permission(venue_id, 'aml.review'));

-- ---------------------------------------------------------------------------------------------------
-- Cash in.

-- A member's cash in at a venue since a moment, with the visit it belongs to: a cash buy-in by its seat's visit,
-- a tournament entry by the visit open when it was paid.
create function private.aml_cash_in(p_venue_id uuid, p_member_id uuid, p_since timestamptz)
returns table (id uuid, source text, amount_paise bigint, created_at timestamptz, visit_id uuid, visit_opened_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, 'cage', t.amount_paise, t.created_at, v.id, v.opened_at
  from public.cage_transaction t
  left join public.seat_session s on s.id = t.session_id
  left join public.visit v on v.id = s.visit_id
  where t.venue_id = p_venue_id and t.member_id = p_member_id and t.kind = 'buy_in' and t.method = 'cash' and t.created_at >= p_since
  union all
  select p.id, 'tournament', p.price_paise, p.created_at, v.id, v.opened_at
  from public.tournament_purchase p
  left join lateral (select x.id, x.opened_at from public.visit x
                     where x.member_id = p.member_id and x.venue_id = p.venue_id and x.opened_at <= p.created_at
                       and (x.closed_at is null or x.closed_at >= p.created_at)
                     order by x.opened_at desc limit 1) v on true
  where p.venue_id = p_venue_id and p.member_id = p_member_id and p.paid_by = 'cash' and p.created_at >= p_since;
$$;

-- Refuses cash in past the visit's or the club day's limit. One member's cash in is counted one at a time, so two
-- at once cannot both fit under a limit.
create function private.assert_cash_within_limits(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits jsonb := private.setting_at(p_venue_id, 'cage.cash_buy_in_limit', '', now());
  v_day_began timestamptz := private.tonight_began(now());
  v_visit public.visit;
  v_visit_so_far bigint;
  v_day_so_far bigint;
  v_hit text;
begin
  if v_limits is null or coalesce(private.purging(p_venue_id), false) then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cash-limit:' || p_member_id::text, 0));
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.venue_id = p_venue_id and v.closed_at is null;
  select coalesce(sum(c.amount_paise) filter (where c.visit_id = v_visit.id), 0),
         coalesce(sum(c.amount_paise) filter (where c.created_at >= v_day_began), 0)
  into v_visit_so_far, v_day_so_far
  from private.aml_cash_in(p_venue_id, p_member_id, least(v_day_began, coalesce(v_visit.opened_at, v_day_began))) c;
  v_hit := private.cash_limit_hit((v_limits ->> 'per_visit_paise')::bigint, (v_limits ->> 'per_day_paise')::bigint,
                                  v_visit_so_far, v_day_so_far, p_amount_paise);
  if v_hit = 'visit' then
    raise exception 'This cash would take the member past the visit''s cash limit' using errcode = 'RVCLV';
  elsif v_hit = 'day' then
    raise exception 'This cash would take the member past the club day''s cash limit' using errcode = 'RVCLD';
  end if;
end;
$$;

-- Before a cash buy-in, or a tournament entry paid in cash, is written.
create function private.enforce_cash_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_cash_within_limits(new.venue_id, new.member_id,
    coalesce(to_jsonb(new) ->> 'amount_paise', to_jsonb(new) ->> 'price_paise')::bigint);
  return new;
end;
$$;

-- Structuring of one kind after a member's cash in (`p_cash_id`): the member's visits (or club days) begun within
-- the window whose cash in ended just under the limit. When the cash in's own visit (or day) is one, there are as
-- many as the rule asks, and that visit (or day) was not already reviewed, the open entry of that kind gets their
-- cash in, made and alerted if there is none.
create function private.flag_structuring(p_venue_id uuid, p_member_id uuid, p_cash_id uuid, p_kind text, p_limit bigint, p_rule jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval := make_interval(days => (p_rule ->> 'window_days')::integer);
  v_near integer;
  v_own_period text;
  v_cash uuid[];
  v_entry uuid;
begin
  if coalesce(p_limit, 0) <= 0 then
    return;
  end if;
  with cash as (
    select c.id, c.amount_paise,
           case when p_kind = 'structuring_day' then private.tonight_began(c.created_at) else c.visit_opened_at end as began,
           case when p_kind = 'structuring_day' then private.tonight_began(c.created_at)::text else c.visit_id::text end as period
    from private.aml_cash_in(p_venue_id, p_member_id, now() - v_window - interval '2 days') c
  ),
  near as (
    select c.period from cash c where c.began > now() - v_window group by c.period
    having private.is_near_limit(sum(c.amount_paise)::bigint, p_limit, (p_rule ->> 'margin_basis_points')::integer)
  )
  select (select count(*)::integer from near),
         (select n.period from cash c join near n on n.period = c.period where c.id = p_cash_id),
         (select array_agg(c.id) from cash c join near n on n.period = c.period)
  into v_near, v_own_period, v_cash;
  if v_own_period is null or v_near < (p_rule ->> 'count')::integer then
    return;
  end if;
  select e.id into v_entry from public.sar_entry e where e.member_id = p_member_id and e.kind = p_kind and e.status = 'open' for update;
  if v_entry is null then
    -- A visit (or day) a reviewer already closed does not open another entry; the next one does.
    if exists (select 1 from public.sar_entry_transaction x join public.sar_entry e on e.id = x.sar_entry_id
               join private.aml_cash_in(p_venue_id, p_member_id, now() - v_window - interval '2 days') c
                 on c.id = coalesce(x.cage_transaction_id, x.tournament_purchase_id)
               where e.member_id = p_member_id and e.kind = p_kind and e.status = 'reviewed'
                 and (case when p_kind = 'structuring_day' then private.tonight_began(c.created_at)::text else c.visit_id::text end) = v_own_period) then
      return;
    end if;
    insert into public.sar_entry (venue_id, member_id, kind) values (p_venue_id, p_member_id, p_kind) returning id into v_entry;
    -- The audit log and the alert name neither the member nor anything about them: the register holds that.
    perform private.audit(p_venue_id, 'aml.flag', 'sar_entry', v_entry::text, null, jsonb_build_object('kind', p_kind));
    perform private.raise_alert(p_venue_id, 'aml.structuring', jsonb_build_object('kind', p_kind, 'entry', v_entry));
  end if;
  insert into public.sar_entry_transaction (sar_entry_id, venue_id, cage_transaction_id, tournament_purchase_id)
  select v_entry, p_venue_id, c.id, null from unnest(v_cash) c(id)
  where exists (select 1 from public.cage_transaction t where t.id = c.id)
  on conflict do nothing;
  insert into public.sar_entry_transaction (sar_entry_id, venue_id, cage_transaction_id, tournament_purchase_id)
  select v_entry, p_venue_id, null, c.id from unnest(v_cash) c(id)
  where exists (select 1 from public.tournament_purchase p where p.id = c.id)
  on conflict do nothing;
end;
$$;

-- After cash in, structuring by visit and by club day.
create function private.detect_structuring()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits jsonb := private.setting_at(new.venue_id, 'cage.cash_buy_in_limit', '', now());
  v_rule jsonb := coalesce(private.setting_at(new.venue_id, 'aml.structuring', '', now()),
                           '{"count": 3, "window_days": 7, "margin_basis_points": 1000}'::jsonb);
begin
  if v_limits is null or coalesce(private.purging(new.venue_id), false) then
    return null;
  end if;
  perform private.flag_structuring(new.venue_id, new.member_id, new.id, 'structuring_visit', (v_limits ->> 'per_visit_paise')::bigint, v_rule);
  perform private.flag_structuring(new.venue_id, new.member_id, new.id, 'structuring_day', (v_limits ->> 'per_day_paise')::bigint, v_rule);
  return null;
end;
$$;

create trigger cage_transaction_cash_limits before insert on public.cage_transaction
  for each row when (new.kind = 'buy_in' and new.method = 'cash') execute function private.enforce_cash_limits();
create trigger cage_transaction_structuring after insert on public.cage_transaction
  for each row when (new.kind = 'buy_in' and new.method = 'cash') execute function private.detect_structuring();
create trigger tournament_purchase_cash_limits before insert on public.tournament_purchase
  for each row when (new.paid_by = 'cash') execute function private.enforce_cash_limits();
create trigger tournament_purchase_structuring after insert on public.tournament_purchase
  for each row when (new.paid_by = 'cash') execute function private.detect_structuring();

-- ---------------------------------------------------------------------------------------------------
-- Reading and reviewing the register (aml.review).

-- The venue's register, open entries first, newest first: the member, the pattern, when it was found, the cash in it
-- is about (each with where it came from), and the review.
create function private.aml_register(p_venue_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, member_number bigint, kind text, detected_at timestamptz, status text,
               outcome text, note text, reviewed_by text, reviewed_at timestamptz, cash_paise bigint, buy_ins jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.member_id, m.full_name, m.member_number, e.kind, e.detected_at, e.status, e.outcome, e.note, s.full_name, e.reviewed_at,
         coalesce(sum(coalesce(t.amount_paise, p.price_paise)), 0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'source', case when t.id is null then 'tournament' else 'cage' end,
                                               'at', coalesce(t.created_at, p.created_at), 'amount_paise', coalesce(t.amount_paise, p.price_paise))
                            order by coalesce(t.created_at, p.created_at)) filter (where x.id is not null), '[]'::jsonb)
  from public.sar_entry e
  join public.member m on m.id = e.member_id
  left join public.staff s on s.id = e.reviewed_by_staff_id
  left join public.sar_entry_transaction x on x.sar_entry_id = e.id
  left join public.cage_transaction t on t.id = x.cage_transaction_id
  left join public.tournament_purchase p on p.id = x.tournament_purchase_id
  where e.venue_id = p_venue_id and private.has_permission(p_venue_id, 'aml.review')
  group by e.id, m.full_name, m.member_number, s.full_name
  order by e.status = 'open' desc, e.detected_at desc
  limit 500;
$$;

-- Closes an open entry with an outcome (no action, monitor, reported) and a note of 10 to 1,000 characters, by staff
-- who review AML. The audit log records the review and its outcome, not the note. Refusals: 42501; 22023 an entry
-- already reviewed, an outcome not one of those, or a note too short or long; RVFRZ a frozen venue.
create function private.review_sar_entry(p_entry_id uuid, p_outcome text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.sar_entry := (select e from public.sar_entry e where e.id = p_entry_id for update);
begin
  if v_entry.id is null or not private.has_permission(v_entry.venue_id, 'aml.review') then
    raise exception 'Only staff who review AML review the register' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id);
  if v_entry.status <> 'open' or p_outcome is null or p_outcome not in ('no_action', 'monitor', 'reported')
     or length(btrim(coalesce(p_note, ''))) not between 10 and 1000 then
    raise exception 'An open entry, an outcome, and a note of 10 to 1,000 characters' using errcode = '22023';
  end if;
  update public.sar_entry
  set status = 'reviewed', outcome = p_outcome, note = btrim(p_note), reviewed_by_staff_id = private.current_staff_id(v_entry.venue_id),
      reviewed_at = now()
  where id = p_entry_id;
  perform private.audit(v_entry.venue_id, 'aml.review', 'sar_entry', p_entry_id::text, null, jsonb_build_object('outcome', p_outcome));
end;
$$;

create function public.aml_register(p_venue_id uuid)
returns table (entry_id uuid, member_id uuid, full_name text, member_number bigint, kind text, detected_at timestamptz, status text,
               outcome text, note text, reviewed_by text, reviewed_at timestamptz, cash_paise bigint, buy_ins jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.aml_register(p_venue_id); $$;
create function public.review_sar_entry(p_entry_id uuid, p_outcome text, p_note text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.review_sar_entry(p_entry_id, p_outcome, p_note); $$;

revoke execute on function private.cash_limit_hit(bigint, bigint, bigint, bigint, bigint), private.is_near_limit(bigint, bigint, integer),
  private.aml_cash_in(uuid, uuid, timestamptz), private.assert_cash_within_limits(uuid, uuid, bigint), private.enforce_cash_limits(),
  private.flag_structuring(uuid, uuid, uuid, text, bigint, jsonb), private.detect_structuring()
  from public, anon, authenticated;
revoke execute on function private.aml_register(uuid), private.review_sar_entry(uuid, text, text), public.aml_register(uuid),
  public.review_sar_entry(uuid, text, text) from public, anon;
grant execute on function private.aml_register(uuid), private.review_sar_entry(uuid, text, text), public.aml_register(uuid),
  public.review_sar_entry(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- A member's own data export (#103) leaves the register out: no one is told they are on it. As 20261027200200,
-- with sar_entry left out of one member's archive; the full archive, locked to the owner's key, keeps it.
create or replace function private.export_archive_tables(p_for_member boolean)
returns table (table_name text, column_names text[], predicate text)
language sql
stable
security definer
set search_path = ''
as $$
  with tables as (
    select c.table_name::text as table_name,
           array_agg(c.column_name::text order by c.ordinal_position)
             filter (where c.column_name not like '%\_hash'
                       and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id'))
             as column_names,
           bool_or(c.column_name = 'venue_id') as has_venue,
           string_agg(case when c.column_name = 'member_id' or c.column_name like '%\_member\_id' then format('$2 = t.%I', c.column_name)
                           when c.column_name like '%\_member\_ids' then format('$2 = any(t.%I)', c.column_name) end, ' or ')
             as member_match
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    group by c.table_name
  )
  select table_name, column_names,
         case
           when not p_for_member then
             case when table_name = 'venue' then 't.id = $1' when has_venue then 't.venue_id = $1' else 'true' end
           when table_name = 'member' then 't.venue_id = $1 and t.id = $2'
           when table_name = 'ledger_entry' then
             't.venue_id = $1 and t.account_id in (select a.id from public.ledger_account a where a.venue_id = $1 and a.member_id = $2)'
           when table_name = 'seat_move' then
             't.venue_id = $1 and t.session_id in (select s.id from public.seat_session s where s.venue_id = $1 and s.member_id = $2)'
           else format('t.venue_id = $1 and (%s)', member_match)
         end
  from tables
  where not p_for_member
     or (table_name not in ('sar_entry', 'sar_entry_transaction')
         and (table_name in ('member', 'ledger_entry', 'seat_move') or (has_venue and member_match is not null)))
  order by table_name;
$$;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
