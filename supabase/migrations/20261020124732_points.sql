-- Points (#89; scope-v1 module 9; features "Wallet"; question #395, decision 0161). A member earns points
-- for a visit when it closes (private.close_visit: a final cash-out, the door's check-out, the end of the
-- day), on two schemes at once. Hours by stake: each table type's points.per_hour for the time played
-- there, on the call-time clock (seating to leaving, less time away), a session that moved sharing its
-- time among its tables. RIVR Rewards: each hand's rake is shared among the members seated at its table,
-- and the member earns points.rewards_rake_share of their share as points, one a rupee. Every rule is
-- @rivr/domain/points, proved on packages/testing/golden/points.json (024_golden_twins). Each earning is
-- kept in points_earning, so a member's points reconcile to the ledger and to their seat sessions.
-- Points never convert to cash: they leave only through private.debit_points (a redemption).

insert into public.setting_key (key, description, scope, value_schema) values
  ('points.per_hour',
   'Points a member earns for each hour played, per table type, so by stake (#89, decision 0161); none set earns none.',
   'table_type',
   '{"type":"object","properties":{"points":{"type":"integer","minimum":0,"maximum":10000}},"required":["points"],"additionalProperties":false}'),
  ('points.rewards_rake_share',
   'RIVR Rewards (#89, decision 0161): the share of a member''s rake, in basis points (500 is 5%), earned as points at one a rupee; none set earns none.',
   'venue',
   '{"type":"object","properties":{"basis_points":{"type":"integer","minimum":0,"maximum":10000}},"required":["basis_points"],"additionalProperties":false}');

-- @rivr/domain pointsForTime: a table type's points an hour for the seconds played there, rounded down.
create function private.points_for_time(p_seconds bigint, p_per_hour bigint)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_seconds is null or p_seconds < 0 or p_per_hour is null or p_per_hour < 0 then
    raise exception 'Time played and a rate of points are never negative or missing' using errcode = '22023';
  end if;
  return p_seconds * p_per_hour / 3600;
end;
$$;

-- @rivr/domain tablePlayedSeconds: a session's time played, shared among its tables in proportion to the
-- time at each, rounded down to the second.
create function private.table_played_seconds(p_table bigint, p_session bigint, p_played bigint)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_table is null or p_session is null or p_played is null or p_table < 0 or p_table > p_session
     or p_played < 0 or p_played > p_session then
    raise exception 'A table''s time and the time played are within the session' using errcode = '22023';
  end if;
  if p_session = 0 then return 0; end if;
  return p_table * p_played / p_session;
end;
$$;

-- @rivr/domain rakeShare: a hand's rake split equally among the members seated, rounded down to the paisa.
create function private.rake_share(p_rake bigint, p_seated integer)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_rake is null or p_rake < 0 or p_seated is null or p_seated < 1 then
    raise exception 'A share of rake goes to at least one seated member' using errcode = '22023';
  end if;
  return p_rake / p_seated;
end;
$$;

-- @rivr/domain rakePoints: a share in basis points of a member's rake, as points at one a rupee, rounded down.
create function private.rake_points(p_share bigint, p_basis_points integer)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_share is null or p_share < 0 or p_basis_points is null or p_basis_points not between 0 and 10000 then
    raise exception 'A rake share is never negative, and a rate is 0 to 10,000 basis points' using errcode = '22023';
  end if;
  return p_share * p_basis_points / 1000000;
end;
$$;

create table public.points_earning (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  visit_id uuid not null references public.visit (id),
  basis text not null check (basis in ('hours', 'rake')),
  -- Hours: the seat session, a table it sat at, and the seconds played there.
  session_id uuid references public.seat_session (id),
  table_id uuid,
  played_seconds bigint check (played_seconds >= 0),
  -- Rake: the member's share of the rake for the visit, in paise.
  rake_share_paise bigint check (rake_share_paise >= 0),
  -- The rule in force: points an hour, or the share of rake in basis points.
  rate integer not null check (rate between 0 and 10000),
  points bigint not null check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  check ((basis = 'hours') = (session_id is not null and table_id is not null and played_seconds is not null)),
  check ((basis = 'rake') = (rake_share_paise is not null)),
  check (basis = 'hours' or (session_id is null and table_id is null and played_seconds is null)),
  check (basis = 'rake' or rake_share_paise is null)
);

comment on table public.points_earning is 'What a visit earned in points, by table and from rake (#89); never changed.';

create unique index points_earning_one_rake_idx on public.points_earning (visit_id) where basis = 'rake';
create index points_earning_member_venue_idx on public.points_earning (member_id, venue_id);
create index points_earning_visit_idx on public.points_earning (visit_id);
create index points_earning_session_idx on public.points_earning (session_id);
create index points_earning_table_venue_idx on public.points_earning (table_id, venue_id);
create trigger points_earning_never_changed before update or delete on public.points_earning
  for each row execute function private.refuse_change();
create trigger points_earning_no_truncate before truncate on public.points_earning
  for each statement execute function private.refuse_change();
create trigger points_earning_audit after insert on public.points_earning
  for each row execute function private.audit_row_change();
alter table public.points_earning enable row level security;
grant select on public.points_earning to authenticated;

-- A member's points movements are rewards.points_history (decision 0062); staff who read members see all.
create policy "members see their own points earned" on public.points_earning
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'rewards.points_history'));
create policy "staff who read members see the venue's points earned" on public.points_earning
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- Finding who sat where while a visit lasted, among the sessions that ended since it began or are open.
create index seat_session_venue_ended_idx on public.seat_session (venue_id, ended_at);

-- The tables a seat session sat at, in order: from seating, or a move, to the next move, or leaving.
create function private.session_tables(p_session_id uuid)
returns table (o_table_id uuid, o_from timestamptz, o_to timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.from_table_id, coalesce(lag(m.created_at) over (order by m.created_at, m.id), s.started_at), m.created_at
  from public.seat_move m join public.seat_session s on s.id = m.session_id
  where m.session_id = p_session_id
  union all
  select s.table_id, coalesce((select max(m.created_at) from public.seat_move m where m.session_id = s.id), s.started_at),
         coalesce(s.ended_at, 'infinity')
  from public.seat_session s where s.id = p_session_id;
$$;

-- A closed visit's time played at each table of each seat session, with the table type's points an hour in
-- force when the member sat down there. A seat still open when the visit closed ends with it. A seat change
-- at the same table, or a return to it, adds up before anything is rounded: rounding is per table.
create function private.visit_table_time(p_visit_id uuid)
returns table (o_session_id uuid, o_table_id uuid, o_played bigint, o_rate integer)
language sql
stable
security definer
set search_path = ''
as $$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           extract(epoch from (least(t.o_to, v.closed_at) - t.o_from)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at
  ),
  rated as (
    select st.*, coalesce((private.setting_at(st.venue_id, 'points.per_hour', tt.code, st.o_from) ->> 'points')::integer, 0) as rate
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
  )
  select r.session_id, r.table_id, private.table_played_seconds(floor(sum(r.seconds))::bigint, r.wall, greatest(0, r.wall - r.away_seconds)), r.rate
  from rated r
  group by r.session_id, r.table_id, r.rate, r.wall, r.away_seconds
  order by min(r.o_from);
$$;

-- A closed visit's share of rake: each hand at a table while the member sat there, shared equally among
-- everyone seated at that table when it was played (the tablet does not say who was dealt in).
create function private.visit_rake_share(p_visit_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with this_visit as (select v.venue_id, v.opened_at, v.closed_at from public.visit v where v.id = p_visit_id),
  mine as (
    select t.o_table_id, t.o_from, least(t.o_to, w.closed_at) as o_to
    from this_visit w join public.seat_session s on s.visit_id = p_visit_id
    cross join lateral private.session_tables(s.id) t
  ),
  -- Everyone seated at the venue while the visit lasted, worked out once rather than for every hand.
  seated as materialized (
    select t.o_table_id, t.o_from, t.o_to from this_visit w
    join public.seat_session s on s.venue_id = w.venue_id and s.started_at < w.closed_at and (s.ended_at > w.opened_at or s.ended_at is null)
    cross join lateral private.session_tables(s.id) t
  )
  select coalesce(sum(private.rake_share(h.rake_paise, (select count(*)::integer from seated o
                                                        where o.o_table_id = h.table_id and o.o_from <= h.played_at and o.o_to > h.played_at))), 0)::bigint
  from mine m join public.hand h on h.table_id = m.o_table_id and h.played_at >= m.o_from and h.played_at < m.o_to;
$$;

-- Posts points between the member and the venue's points issued: positive credits the member.
create function private.post_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_kind text, p_memo text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_account uuid;
  v_issued_account uuid;
begin
  select a.id into v_member_account from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.points';
  select a.id into v_issued_account from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id is null and a.code = 'venue.points_issued';
  if v_member_account is null or v_issued_account is null then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  return private.post_ledger_transaction(p_venue_id, p_kind, p_idempotency_key,
    jsonb_build_array(jsonb_build_object('account_id', v_member_account, 'amount', (-p_points)::text),
                      jsonb_build_object('account_id', v_issued_account, 'amount', p_points::text)),
    null, p_memo);
end;
$$;

-- Credits points to a member once per idempotency key (lane D's contract: League, Learn, promotions).
create function private.credit_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn uuid;
begin
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if p_points is null or p_points < 1 then
    raise exception 'Points credited are a whole number above nothing' using errcode = '22023';
  end if;
  v_txn := private.post_points(p_venue_id, p_member_id, p_points, 'points_earned', p_reason, p_idempotency_key);
  perform private.emit(p_venue_id, 'points.earned',
                       jsonb_build_object('member_id', p_member_id, 'points', p_points, 'ledger_transaction_id', v_txn), 'points.earned:' || v_txn);
  return v_txn;
end;
$$;

-- Takes points from a member, never below nothing: a redemption. Points never convert to cash.
create function private.debit_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if p_points is null or p_points < 1 then
    raise exception 'Points taken are a whole number above nothing' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id for update;
  if not found then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  select -private.account_balance(a.id) into v_balance from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.points';
  if exists (select 1 from public.ledger_transaction t where t.venue_id = p_venue_id and t.idempotency_key = p_idempotency_key) then
    return private.post_points(p_venue_id, p_member_id, -p_points, 'points_redeemed', p_reason, p_idempotency_key);
  end if;
  if coalesce(v_balance, 0) < p_points then
    raise exception 'Not enough points: % held, % asked', coalesce(v_balance, 0), p_points using errcode = 'RVPTS';
  end if;
  return private.post_points(p_venue_id, p_member_id, -p_points, 'points_redeemed', p_reason, p_idempotency_key);
end;
$$;

-- Earns a closed visit its points, once: its time at each table, then its share of rake, kept in
-- points_earning, and their sum credited to the member.
create function private.earn_visit_points(p_visit_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_share bigint;
  v_rate integer;
  v_points bigint;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.closed_at is null or exists (select 1 from public.points_earning e where e.visit_id = p_visit_id) then
    return 0;
  end if;
  -- No write while the venue or member is frozen: the close that called this is refused with it.
  perform private.assert_writable(v_visit.venue_id, null, v_visit.member_id);
  insert into public.points_earning (venue_id, member_id, visit_id, basis, session_id, table_id, played_seconds, rate, points)
  select v_visit.venue_id, v_visit.member_id, p_visit_id, 'hours', t.o_session_id, t.o_table_id, t.o_played, t.o_rate,
         private.points_for_time(t.o_played, t.o_rate)
  from private.visit_table_time(p_visit_id) t;
  v_share := private.visit_rake_share(p_visit_id);
  v_rate := coalesce((private.setting_at(v_visit.venue_id, 'points.rewards_rake_share', '', v_visit.closed_at) ->> 'basis_points')::integer, 0);
  insert into public.points_earning (venue_id, member_id, visit_id, basis, rake_share_paise, rate, points)
  values (v_visit.venue_id, v_visit.member_id, p_visit_id, 'rake', v_share, v_rate, private.rake_points(v_share, v_rate));
  select sum(e.points) into v_points from public.points_earning e where e.visit_id = p_visit_id;
  if v_points > 0 then
    perform private.credit_points(v_visit.venue_id, v_visit.member_id, v_points, 'Points for the visit', 'points.visit:' || p_visit_id);
  end if;
  return v_points;
end;
$$;

-- #76's close_visit, now earning the visit its points as it closes.
create or replace function private.close_visit(p_member_id uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit.id is null then return null; end if;
  update public.visit set closed_at = greatest(p_at, v_visit.opened_at), close_reason = p_reason where id = v_visit.id;
  perform private.emit(v_visit.venue_id, 'visit.closed',
                       jsonb_build_object('visit_id', v_visit.id, 'member_id', p_member_id, 'reason', p_reason), 'visit.closed:' || v_visit.id);
  perform private.earn_visit_points(v_visit.id);
  return v_visit.id;
end;
$$;

revoke execute on function private.points_for_time(bigint, bigint), private.table_played_seconds(bigint, bigint, bigint),
  private.rake_share(bigint, integer), private.rake_points(bigint, integer), private.session_tables(uuid),
  private.visit_table_time(uuid), private.visit_rake_share(uuid),
  private.post_points(uuid, uuid, bigint, text, text, text), private.credit_points(uuid, uuid, bigint, text, text),
  private.debit_points(uuid, uuid, bigint, text, text), private.earn_visit_points(uuid) from public, anon, authenticated;
