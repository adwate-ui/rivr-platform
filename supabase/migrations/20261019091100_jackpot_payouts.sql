-- Bad-beat payouts and their reversals (#48 part 2; decision 0048, question #300). Staff with
-- jackpots.approve pay a bad beat at a table: the loser, the winner and the other players dealt in,
-- named by their mobile numbers. The venue's jackpot.payout rule says what share of the main pool
-- is paid and how it splits; private.bad_beat_payout works it out on the pool as it stands, in whole
-- ₹50 chips paid at the table, so the main pool is debited and chips in play credited (TDS is taken
-- at cash-out, as for any winnings). A payout is never changed: a mistake is put right by a
-- reversal, the same amounts posted back. Every payout and reversal is a jackpot_event.

insert into public.setting_key (key, description, scope, value_schema) values
  ('jackpot.payout',
   'How a bad beat pays, in basis points: the share of the main pool paid, and its split between the loser, the winner and the other players dealt in, which together make 100% (scope-v1 module 8).',
   'venue',
   '{"type":"object","properties":{"pool_basis_points":{"type":"integer","minimum":0,"maximum":10000},"loser_basis_points":{"type":"integer","minimum":0,"maximum":10000},"winner_basis_points":{"type":"integer","minimum":0,"maximum":10000},"table_basis_points":{"type":"integer","minimum":0,"maximum":10000}},"required":["pool_basis_points","loser_basis_points","winner_basis_points","table_basis_points"],"additionalProperties":false}');

create type public.jackpot_event_kind as enum ('payout', 'reversal');

create table public.jackpot_event (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  kind public.jackpot_event_kind not null,
  -- A reversal names the payout it reverses; a payout is reversed at most once.
  reverses_id uuid unique references public.jackpot_event (id),
  table_id uuid,
  loser_member_id uuid,
  winner_member_id uuid,
  table_member_ids uuid[] not null default '{}',
  -- The main pool before the payout, and what was paid: whole ₹50 chips.
  pool_paise bigint not null check (pool_paise >= 0),
  loser_paise bigint not null check (loser_paise >= 0 and loser_paise % 5000 = 0),
  winner_paise bigint not null check (winner_paise >= 0 and winner_paise % 5000 = 0),
  each_at_table_paise bigint not null check (each_at_table_paise >= 0 and each_at_table_paise % 5000 = 0),
  total_paise bigint not null check (total_paise > 0 and total_paise <= pool_paise),
  -- The jackpot.payout rule it was paid under.
  rule jsonb not null,
  reason text check (reason is null or length(trim(reason)) between 3 and 300),
  staff_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (loser_member_id, venue_id) references public.member (id, venue_id),
  foreign key (winner_member_id, venue_id) references public.member (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, idempotency_key),
  check ((kind = 'reversal') = (reverses_id is not null)),
  check ((kind = 'reversal') = (reason is not null)),
  check (kind = 'reversal' or (table_id is not null and loser_member_id is not null and winner_member_id is not null
                               and loser_member_id <> winner_member_id))
);

comment on table public.jackpot_event is 'Bad-beat jackpot payouts and their reversals (#48).';

create index jackpot_event_venue_created_idx on public.jackpot_event (venue_id, created_at desc);
create index jackpot_event_table_venue_idx on public.jackpot_event (table_id, venue_id);
create index jackpot_event_loser_venue_idx on public.jackpot_event (loser_member_id, venue_id);
create index jackpot_event_winner_venue_idx on public.jackpot_event (winner_member_id, venue_id);
create index jackpot_event_staff_venue_idx on public.jackpot_event (staff_id, venue_id);
-- No client writes an event: only the functions below do, and an event is never changed.
create trigger jackpot_event_append_only before update or delete on public.jackpot_event
  for each row execute function private.refuse_change();
create trigger jackpot_event_no_truncate before truncate on public.jackpot_event
  for each statement execute function private.refuse_change();
create trigger jackpot_event_audit after insert on public.jackpot_event
  for each row execute function private.audit_row_change();
alter table public.jackpot_event enable row level security;
grant select on public.jackpot_event to authenticated;

create policy "staff who pay jackpots or read the ledger see the venue's jackpot events" on public.jackpot_event
  for select to authenticated
  using (venue_id in (select private.venues_where('jackpots.approve')) or venue_id in (select private.venues_where('ledger.read')));

-- The venue's members with these mobile numbers, in the order given; refused if any is not a member.
create function private.members_by_phone(p_venue_id uuid, p_phones text[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(m.id order by p.position), '{}') into v_ids
  from unnest(coalesce(p_phones, '{}')) with ordinality as p (phone, position)
  join public.member m on m.venue_id = p_venue_id and m.phone = p.phone;
  if cardinality(v_ids) <> cardinality(coalesce(p_phones, '{}')) then
    raise exception 'Every player is a member of this venue' using errcode = 'RVNMB';
  end if;
  return v_ids;
end;
$$;

-- Posts a payout (p_sign 1) or its reversal (-1): the main pool debited and chips in play credited,
-- or the other way round. One balanced transaction, keyed by the event.
create function private.post_jackpot_event(p_venue_id uuid, p_event_id uuid, p_total bigint, p_sign integer)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.post_ledger_transaction(p_venue_id, case when p_sign = 1 then 'jackpot_payout' else 'jackpot_reversal' end,
    'jackpot:' || p_event_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.jackpot.main'),
                         'amount', (p_sign * p_total)::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'),
                         'amount', (-p_sign * p_total)::text)),
    null, case when p_sign = 1 then 'Bad-beat jackpot paid in chips' else 'Bad-beat jackpot payout reversed' end);
$$;

-- The venue's main pool now, as the ledger holds it.
create function private.main_pool(p_venue_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select b.natural_balance from public.ledger_balance b where b.venue_id = p_venue_id and b.code = 'venue.jackpot.main'), 0)::bigint;
$$;

-- Staff with jackpots.approve pay a bad beat at a table: the loser, the winner and the other players
-- dealt in, by mobile number (+91…), under the jackpot.payout rule in force. One payout at a time per
-- venue, worked out on the pool as it stands. A replay of the same request is the same payout. Not
-- while the venue is frozen or promotions are switched off (question #300).
create function private.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text,
                                     p_table_phones text[], p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_players uuid[];
  v_rule jsonb;
  v_pool bigint;
  v_paid record;
  v_event_id uuid;
begin
  if not private.has_permission(p_venue_id, 'jackpots.approve') then
    raise exception 'Only staff who approve jackpots pay one' using errcode = '42501';
  end if;
  select e.id into v_event_id from public.jackpot_event e where e.venue_id = p_venue_id and e.idempotency_key = p_idempotency_key;
  if v_event_id is not null then
    return v_event_id;
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  if not exists (select 1 from public.game_table t where t.id = p_table_id and t.venue_id = p_venue_id) then
    raise exception 'That table is not at this venue' using errcode = '22023';
  end if;
  v_players := private.members_by_phone(p_venue_id, array[p_loser_phone, p_winner_phone] || coalesce(p_table_phones, '{}'));
  if (select count(distinct player) from unnest(v_players) as player) <> cardinality(v_players) then
    raise exception 'The loser, the winner and each other player are different members' using errcode = '22023';
  end if;
  v_rule := private.setting_at(p_venue_id, 'jackpot.payout', '', now());
  if v_rule is null then
    raise exception 'No payout rule is set' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('jackpot:' || p_venue_id, 0));
  v_pool := private.main_pool(p_venue_id);
  select * into v_paid from private.bad_beat_payout(v_pool, (v_rule ->> 'pool_basis_points')::numeric::integer,
    (v_rule ->> 'loser_basis_points')::numeric::integer, (v_rule ->> 'winner_basis_points')::numeric::integer,
    (v_rule ->> 'table_basis_points')::numeric::integer, cardinality(v_players) - 2);
  if v_paid.total = 0 then
    raise exception 'The pool pays nothing yet' using errcode = '22023';
  end if;
  insert into public.jackpot_event (venue_id, kind, table_id, loser_member_id, winner_member_id, table_member_ids, pool_paise,
                                    loser_paise, winner_paise, each_at_table_paise, total_paise, rule, staff_id, idempotency_key)
  values (p_venue_id, 'payout', p_table_id, v_players[1], v_players[2], v_players[3:], v_pool, v_paid.loser, v_paid.winner,
          v_paid.each_at_table, v_paid.total, v_rule, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_event_id;
  perform private.post_jackpot_event(p_venue_id, v_event_id, v_paid.total, 1);
  perform private.emit(p_venue_id, 'jackpot.paid',
    jsonb_build_object('event_id', v_event_id, 'table_id', p_table_id, 'loser_member_id', v_players[1], 'winner_member_id', v_players[2],
                       'total_paise', v_paid.total),
    'jackpot.paid:' || v_event_id);
  return v_event_id;
end;
$$;

-- Staff with jackpots.approve reverse a payout made in error, with a reason: the same amounts post
-- back from chips in play to the main pool. A payout is reversed at most once; a replay is the same
-- reversal. Not while the venue is frozen.
create function private.reverse_jackpot_event(p_event_id uuid, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payout public.jackpot_event;
  v_reversal_id uuid;
begin
  select * into v_payout from public.jackpot_event e where e.id = p_event_id;
  if v_payout.id is null or not private.has_permission(v_payout.venue_id, 'jackpots.approve') then
    raise exception 'Only staff who approve jackpots reverse a payout' using errcode = '42501';
  end if;
  select e.id into v_reversal_id from public.jackpot_event e where e.venue_id = v_payout.venue_id and e.idempotency_key = p_idempotency_key;
  if v_reversal_id is not null then
    return v_reversal_id;
  end if;
  perform private.assert_writable(v_payout.venue_id);
  if v_payout.kind <> 'payout' then
    raise exception 'Only a payout is reversed' using errcode = '22023';
  end if;
  if exists (select 1 from public.jackpot_event e where e.reverses_id = v_payout.id) then
    raise exception 'That payout is already reversed' using errcode = 'RVDUP';
  end if;
  insert into public.jackpot_event (venue_id, kind, reverses_id, table_id, pool_paise, loser_paise, winner_paise, each_at_table_paise,
                                    total_paise, rule, reason, staff_id, idempotency_key)
  values (v_payout.venue_id, 'reversal', v_payout.id, v_payout.table_id, v_payout.pool_paise, v_payout.loser_paise,
          v_payout.winner_paise, v_payout.each_at_table_paise, v_payout.total_paise, v_payout.rule, trim(p_reason),
          private.current_staff_id(v_payout.venue_id), p_idempotency_key)
  returning id into v_reversal_id;
  perform private.post_jackpot_event(v_payout.venue_id, v_reversal_id, v_payout.total_paise, -1);
  return v_reversal_id;
end;
$$;

-- The venue's pools and payout rule, for staff who pay jackpots or read the ledger: the console's
-- Jackpots screen, the practice venue's too (public_jackpot is the club's only).
create function private.jackpot_pools(p_venue_id uuid)
returns table (main_paise bigint, season_paise bigint, freeroll_paise bigint, payout_rule jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission(p_venue_id, 'jackpots.approve') or private.has_permission(p_venue_id, 'ledger.read')) then
    raise exception 'Only staff who pay jackpots or read the ledger see the pools' using errcode = '42501';
  end if;
  return query
  select coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.main'), 0)::bigint,
         coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.season'), 0)::bigint,
         coalesce(sum(b.natural_balance) filter (where b.code = 'venue.jackpot.freeroll'), 0)::bigint,
         private.setting_at(p_venue_id, 'jackpot.payout', '', now())
  from public.ledger_balance b
  where b.venue_id = p_venue_id and b.code like 'venue.jackpot.%';
end;
$$;

-- The venue's payouts and reversals, latest first, with the players' names and the table's.
create function private.jackpot_history(p_venue_id uuid)
returns table (event_id uuid, kind public.jackpot_event_kind, reverses_id uuid, is_reversed boolean, table_name text,
               loser_name text, winner_name text, others integer, loser_paise bigint, winner_paise bigint,
               each_at_table_paise bigint, total_paise bigint, reason text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.kind, e.reverses_id, exists (select 1 from public.jackpot_event r where r.reverses_id = e.id), t.name,
         l.full_name, w.full_name, cardinality(e.table_member_ids), e.loser_paise, e.winner_paise, e.each_at_table_paise,
         e.total_paise, e.reason, e.created_at
  from public.jackpot_event e
  left join public.game_table t on t.id = e.table_id
  left join public.member l on l.id = e.loser_member_id
  left join public.member w on w.id = e.winner_member_id
  where e.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'jackpots.approve') or private.has_permission(p_venue_id, 'ledger.read'))
  order by e.created_at desc, e.id;
$$;

revoke execute on function private.members_by_phone(uuid, text[]), private.post_jackpot_event(uuid, uuid, bigint, integer),
  private.main_pool(uuid) from public, anon, authenticated;
grant execute on function private.pay_bad_beat(uuid, uuid, text, text, text[], text), private.reverse_jackpot_event(uuid, text, text),
  private.jackpot_pools(uuid), private.jackpot_history(uuid) to authenticated;

create function public.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text,
                                    p_table_phones text[], p_idempotency_key text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.pay_bad_beat(p_venue_id, p_table_id, p_loser_phone, p_winner_phone, p_table_phones, p_idempotency_key); $$;

create function public.reverse_jackpot_event(p_event_id uuid, p_reason text, p_idempotency_key text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.reverse_jackpot_event(p_event_id, p_reason, p_idempotency_key); $$;

create function public.jackpot_pools(p_venue_id uuid)
returns table (main_paise bigint, season_paise bigint, freeroll_paise bigint, payout_rule jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.jackpot_pools(p_venue_id); $$;

create function public.jackpot_history(p_venue_id uuid)
returns table (event_id uuid, kind public.jackpot_event_kind, reverses_id uuid, is_reversed boolean, table_name text,
               loser_name text, winner_name text, others integer, loser_paise bigint, winner_paise bigint,
               each_at_table_paise bigint, total_paise bigint, reason text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.jackpot_history(p_venue_id); $$;

revoke execute on function public.pay_bad_beat(uuid, uuid, text, text, text[], text), public.reverse_jackpot_event(uuid, text, text),
  public.jackpot_pools(uuid), public.jackpot_history(uuid) from public, anon;
grant execute on function public.pay_bad_beat(uuid, uuid, text, text, text[], text), public.reverse_jackpot_event(uuid, text, text),
  public.jackpot_pools(uuid), public.jackpot_history(uuid) to authenticated;
