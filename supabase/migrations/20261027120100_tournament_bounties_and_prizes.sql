-- Bounties (#117; decision 0206) and what tournaments pay (#121; decision 0205). A template, and the
-- tournaments made from it, may put part of each entry's buy-in on the player's head: a standard bounty
-- is paid whole to whoever knocks them out, a progressive one half, the rest going on the eliminator's
-- own head. Every prize and bounty is paid to the member's wallet after TDS (private.tds_for) through
-- private.credit_wallet, lane A's contracted twin of private.debit_wallet, built here at lane A's word.

-- Moves money from the venue accounts in p_from ([{"code": ..., "amount": paise}], adding up to p_amount)
-- to a member's wallet cash, less p_tds_paise withheld into venue.tds_payable, as one ledger transaction of
-- kind p_reason, once per p_idempotency_key (a replay gives the first transaction; the key for other lines
-- is refused, 23505). Refusals: RVNOM no such member here; 22023 an amount not above nothing, not all from
-- venue accounts, or TDS outside it; RVFRZ a frozen venue, RVMBR a frozen member. Gives the ledger transaction.
create function private.credit_wallet(p_venue_id uuid, p_member_id uuid, p_amount bigint, p_reason text, p_idempotency_key text,
                                      p_from jsonb, p_tds_paise bigint default 0)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from jsonb := (select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', ((f.value ->> 'amount')::bigint)::text))
                   from jsonb_array_elements(coalesce(p_from, '[]')) f
                   join public.ledger_account a on a.venue_id = p_venue_id and a.member_id is null and a.code = f.value ->> 'code');
  v_lines jsonb := coalesce(v_from, '[]') || coalesce((select jsonb_agg(l.line) from (
       select jsonb_build_object('account_id', a.id, 'amount', (-(p_amount - p_tds_paise))::text) as line
       from public.ledger_account a where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.cash'
         and p_amount > p_tds_paise
       union all
       select jsonb_build_object('account_id', a.id, 'amount', (-p_tds_paise)::text)
       from public.ledger_account a where a.venue_id = p_venue_id and a.member_id is null and a.code = 'venue.tds_payable' and p_tds_paise > 0
     ) l), '[]');
  -- The same request again gives its transaction, whatever has changed since; another with its id is refused.
  v_replay uuid := private.find_ledger_replay(p_venue_id, p_idempotency_key, p_reason, v_lines, null);
begin
  if v_replay is not null then
    return v_replay;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_amount is null or p_amount <= 0 or p_tds_paise is null or p_tds_paise < 0 or p_tds_paise > p_amount
     or jsonb_array_length(coalesce(v_from, '[]')) <> jsonb_array_length(coalesce(p_from, '[]'))
     or exists (select 1 from jsonb_array_elements(p_from) f where (f.value ->> 'amount')::bigint <= 0)
     or p_amount <> coalesce((select sum((f.value ->> 'amount')::bigint) from jsonb_array_elements(p_from) f), 0) then
    raise exception 'An amount above nothing, all of it from venue accounts, the TDS within it' using errcode = '22023';
  end if;
  -- One wallet movement at a time per member.
  perform 1 from public.member m where m.id = p_member_id for update;
  return private.post_ledger_transaction(p_venue_id, p_reason, p_idempotency_key, v_lines, null, p_reason);
end;
$$;

revoke execute on function private.credit_wallet(uuid, uuid, bigint, text, text, jsonb, bigint) from public, anon, authenticated;

-- The bounty: a part of the buy-in, below what the pool would get, on every entry's and re-entry's head;
-- not in a rebuy tournament, whose busted players come back on the same run.
alter table public.tournament_template
  add column bounty_paise bigint check (bounty_paise > 0 and bounty_paise % 5000 = 0),
  add column bounty_kind text check (bounty_kind in ('standard', 'progressive')),
  add constraint tournament_template_bounty check ((bounty_paise is null) = (bounty_kind is null)
                                                   and (bounty_paise is null or (format <> 'rebuy' and bounty_paise < buy_in_paise - fee_paise)));
alter table public.tournament
  add column bounty_paise bigint check (bounty_paise > 0 and bounty_paise % 5000 = 0),
  add column bounty_kind text check (bounty_kind in ('standard', 'progressive')),
  add constraint tournament_bounty check ((bounty_paise is null) = (bounty_kind is null)
                                          and (bounty_paise is null or (format <> 'rebuy' and bounty_paise < buy_in_paise - fee_paise)));

-- What a tournament paid: each run's prize (its place's, or its share of a deal, with its own bounty when it
-- was left at the end), and each bounty paid on a bust (with what went on the eliminator's head); the TDS
-- on it, withheld or shadow, and its ledger transaction (none when nothing was paid).
create table public.tournament_payout (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  tournament_id uuid not null,
  entry_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('prize', 'bounty')),
  -- A prize: the run's place. A bounty: the run it knocked out.
  place integer check (place >= 1),
  busted_entry_id uuid,
  prize_paise bigint not null check (prize_paise >= 0 and prize_paise % 5000 = 0),
  bounty_paise bigint not null check (bounty_paise >= 0 and bounty_paise % 5000 = 0),
  head_paise bigint not null default 0 check (head_paise >= 0 and head_paise % 5000 = 0),
  tds_paise bigint not null check (tds_paise >= 0),
  is_tds_shadow boolean not null,
  ledger_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (busted_entry_id),
  foreign key (tournament_id, venue_id) references public.tournament (id, venue_id),
  foreign key (entry_id, venue_id) references public.tournament_entry (id, venue_id),
  foreign key (busted_entry_id, venue_id) references public.tournament_entry (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  check ((kind = 'prize') = (place is not null) and (kind = 'bounty') = (busted_entry_id is not null)),
  check (kind = 'bounty' or (head_paise = 0 and prize_paise + bounty_paise > 0)),
  check (kind = 'prize' or prize_paise = 0),
  check (tds_paise <= prize_paise + bounty_paise),
  check ((ledger_transaction_id is null) = (prize_paise + bounty_paise = 0))
);

comment on table public.tournament_payout is 'What a tournament paid (#117, #121): prizes by place or deal, and bounties on busts, each with its TDS and ledger transaction; never changed.';

create unique index tournament_payout_prize_idx on public.tournament_payout (entry_id) where kind = 'prize';
create index tournament_payout_tournament_idx on public.tournament_payout (tournament_id, venue_id);
create index tournament_payout_entry_idx on public.tournament_payout (entry_id, venue_id);
create index tournament_payout_member_idx on public.tournament_payout (member_id, venue_id);
create index tournament_payout_txn_idx on public.tournament_payout (ledger_transaction_id, venue_id);

create trigger tournament_payout_never_changed before update or delete on public.tournament_payout
  for each row execute function private.refuse_change();
create trigger tournament_payout_no_truncate before truncate on public.tournament_payout
  for each statement execute function private.refuse_change();
create trigger tournament_payout_audit after insert on public.tournament_payout
  for each row execute function private.audit_row_change();

alter table public.tournament_payout enable row level security;
-- Not the ledger transaction, as a buy's is not shown either.
grant select (id, venue_id, tournament_id, entry_id, member_id, kind, place, busted_entry_id, prize_paise, bounty_paise, head_paise, tds_paise,
              is_tds_shadow, created_at) on public.tournament_payout to authenticated;
create policy "staff who run tournaments, the cage or read the ledger see the venue's payouts" on public.tournament_payout
  for select to authenticated
  using (venue_id in (select private.venues_where('tournaments.manage')) or venue_id in (select private.venues_where('cage.transact'))
         or venue_id in (select private.venues_where('ledger.read')));
create policy "members with tournament registration see their own payouts" on public.tournament_payout
  for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature(member_id, 'tournaments.register'));

-- TDS on a prize or bounty alone (decision 0068's private.tds_for, at now): what it comes to, what is
-- withheld (nothing while the switch is off: shadow), and whether it is shadow. None with no tds.config.
create function private.tournament_prize_tds(p_venue_id uuid, p_member_id uuid, p_winnings_paise bigint)
returns table (tds_paise bigint, withheld_paise bigint, is_shadow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.amount_paise, 0), case when coalesce(t.is_shadow, true) then 0 else t.amount_paise end, coalesce(t.is_shadow, false)
  from (select 1) one left join private.tds_for(p_venue_id, p_member_id, p_winnings_paise, now()) t on true;
$$;

-- What is on a run's head: the tournament's bounty, and what progressive busts added to it.
create function private.tournament_bounty_on(p_entry_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.bounty_paise, 0) + coalesce((select sum(p.head_paise) from public.tournament_payout p where p.entry_id = e.id and p.kind = 'bounty'), 0)
  from public.tournament_entry e join public.tournament t on t.id = e.tournament_id
  where e.id = p_entry_id;
$$;

-- Pays a run what it won, to the member's wallet after TDS from the prize pool, and records it. A prize
-- (p_busted_id null) is the place's prize and the run's own bounty; a bounty is what p_busted_id's head pays.
create function private.pay_tournament_run(p_entry_id uuid, p_place integer, p_prize bigint, p_bounty bigint, p_head bigint,
                                           p_busted_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := (select e from public.tournament_entry e where e.id = p_entry_id);
  v_won bigint := p_prize + p_bounty;
  v_tds record;
begin
  select * into v_tds from private.tournament_prize_tds(v_entry.venue_id, v_entry.member_id, v_won);
  insert into public.tournament_payout (venue_id, tournament_id, entry_id, member_id, kind, place, busted_entry_id, prize_paise, bounty_paise,
                                        head_paise, tds_paise, is_tds_shadow, ledger_transaction_id)
  values (v_entry.venue_id, v_entry.tournament_id, p_entry_id, v_entry.member_id, case when p_busted_id is null then 'prize' else 'bounty' end,
          p_place, p_busted_id, p_prize, p_bounty, p_head, v_tds.tds_paise, v_tds.is_shadow,
          case when v_won > 0 then private.credit_wallet(v_entry.venue_id, v_entry.member_id, v_won,
                 case when p_busted_id is null then 'tournament_prize' else 'tournament_bounty' end,
                 case when p_busted_id is null then 'tournament_prize:' || p_entry_id else 'tournament_bounty:' || p_busted_id end,
                 jsonb_build_array(jsonb_build_object('code', 'venue.tournament_pool', 'amount', v_won)), v_tds.withheld_paise) end);
end;
$$;

-- A buy changes the prize pool by its price less its fee, less the bounty an entry or re-entry carries.
-- As 20261026235300_tournament_floor.sql left it, the bounties left out of the pool.
create or replace function private.tournament_counts(p_tournament_id uuid)
returns table (entries integer, re_entries integer, players_left integer, chips_in_play bigint, pool_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where p.kind in ('entry', 're_entry'))::integer, count(*) filter (where p.kind = 're_entry')::integer,
         (select count(*)::integer from public.tournament_entry e where e.tournament_id = p_tournament_id and e.status = 'seated'),
         coalesce(sum(p.chips), 0)::bigint,
         (coalesce(sum(p.price_paise - p.fee_paise), 0)
          - count(*) filter (where p.kind in ('entry', 're_entry')) * coalesce((select t.bounty_paise from public.tournament t where t.id = p_tournament_id), 0))::bigint
  from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
  where p.tournament_id = p_tournament_id and e.status <> 'refunded';
$$;

drop function public.bust_tournament_entry(uuid);
drop function private.bust_tournament_entry(uuid);
-- A seated player busts, for tournaments.manage: the bust takes the next place in the order of busts, and
-- the oldest alternate takes a seat. In a bounty tournament, p_eliminator_id is the run seated at the same
-- table that knocked them out, and is paid the bounty on their head (private.tournament_bounty_split). Gives
-- the place it finishes in as things stand. Refusals: 42501, also for an eliminator who is the caller's own
-- member record; 22023 not seated, or an eliminator missing in a bounty tournament, given in another, or not
-- seated at that table; RVFRZ; RVMBR the eliminator frozen.
create function private.bust_tournament_entry(p_entry_id uuid, p_eliminator_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry := private.entry_for_floor(p_entry_id);
  v_kind text := (select t.bounty_kind from public.tournament t where t.id = v_entry.tournament_id);
  v_split record;
  v_place integer;
begin
  if v_entry.status is distinct from 'seated' or (v_kind is null) <> (p_eliminator_id is null)
     or (p_eliminator_id is not null and not exists (select 1 from public.tournament_entry e where e.id = p_eliminator_id and e.id <> p_entry_id
                                                     and e.tournament_id = v_entry.tournament_id and e.status = 'seated'
                                                     and e.table_number = v_entry.table_number)) then
    raise exception 'A seated player, and in a bounty tournament the player at their table who knocked them out' using errcode = '22023';
  end if;
  if coalesce(private.is_own_kyc_check((select e.member_id from public.tournament_entry e where e.id = p_eliminator_id)), false) then
    raise exception 'Staff never pay a bounty to themselves' using errcode = '42501';
  end if;
  if v_kind is not null then
    select * into v_split from private.tournament_bounty_split(private.tournament_bounty_on(p_entry_id), v_kind);
    perform private.pay_tournament_run(p_eliminator_id, null, 0, v_split.paid_paise, v_split.head_paise, p_entry_id);
  end if;
  update public.tournament_entry
  set status = 'busted', busted_at = now(), table_number = null, seat_number = null,
      bust_order = coalesce((select max(e.bust_order) from public.tournament_entry e where e.tournament_id = v_entry.tournament_id), 0) + 1
  where id = p_entry_id;
  v_place := (select r.place from private.tournament_places(v_entry.tournament_id) r where r.entry_id = p_entry_id);
  perform private.seat_tournament_entry(e.id) from public.tournament_entry e
  where e.id = (select a.id from public.tournament_entry a where a.tournament_id = v_entry.tournament_id and a.status = 'alternate'
                order by a.created_at, a.id limit 1);
  return v_place;
end;
$$;

create function public.bust_tournament_entry(p_entry_id uuid, p_eliminator_id uuid default null)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.bust_tournament_entry(p_entry_id, p_eliminator_id); $$;

-- As 20261026231100_tournament_templates.sql left them, with the bounty.
create or replace function private.save_tournament_template(p_venue_id uuid, p_template jsonb, p_template_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament_template;
  v_id uuid;
begin
  perform private.assert_runs_tournaments(p_venue_id);
  perform private.assert_writable(p_venue_id);
  begin
    v_row := jsonb_populate_record(null::public.tournament_template, p_template);
    if v_row.last_registration_level > (select private.blind_level_count(s.levels) from public.blind_structure s
                                        where s.id = v_row.blind_structure_id and s.venue_id = p_venue_id) then
      raise exception 'The last registration level is one of the structure''s' using errcode = '22023';
    end if;
    if p_template_id is null then
      insert into public.tournament_template (venue_id, name, format, buy_in_paise, fee_paise, starting_stack, blind_structure_id,
                                              last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips, places_paid,
                                              guarantee_paise, bounty_paise, bounty_kind)
      values (p_venue_id, btrim(v_row.name), v_row.format, v_row.buy_in_paise, v_row.fee_paise, v_row.starting_stack, v_row.blind_structure_id,
              v_row.last_registration_level, v_row.max_buys, v_row.add_on_paise, v_row.add_on_fee_paise, v_row.add_on_chips, v_row.places_paid,
              v_row.guarantee_paise, v_row.bounty_paise, v_row.bounty_kind)
      returning id into v_id;
    else
      update public.tournament_template
      set name = btrim(v_row.name), format = v_row.format, buy_in_paise = v_row.buy_in_paise, fee_paise = v_row.fee_paise,
          starting_stack = v_row.starting_stack, blind_structure_id = v_row.blind_structure_id,
          last_registration_level = v_row.last_registration_level, max_buys = v_row.max_buys, add_on_paise = v_row.add_on_paise,
          add_on_fee_paise = v_row.add_on_fee_paise, add_on_chips = v_row.add_on_chips, places_paid = v_row.places_paid,
          guarantee_paise = v_row.guarantee_paise, bounty_paise = v_row.bounty_paise, bounty_kind = v_row.bounty_kind
      where id = p_template_id and venue_id = p_venue_id
      returning id into v_id;
    end if;
  exception when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
                 or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'A template within its bounds, on a structure of this venue' using errcode = '22023';
  end;
  if v_id is null then
    raise exception 'No such template at this venue' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create or replace function private.create_tournament(p_template_id uuid, p_name text, p_starts_at timestamptz, p_is_published boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament_template t where t.id = p_template_id);
  v_id uuid;
begin
  perform private.assert_runs_tournaments(v_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_is_published is null then
    raise exception 'A name of 1 to 80 characters, and a start' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  insert into public.tournament (venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published, template_id, format, fee_paise,
                                 starting_stack, levels, last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips,
                                 places_paid, bounty_paise, bounty_kind)
  select t.venue_id, btrim(p_name), p_starts_at, t.buy_in_paise, t.guarantee_paise, p_is_published, t.id, t.format, t.fee_paise,
         t.starting_stack, s.levels, t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid,
         t.bounty_paise, t.bounty_kind
  from public.tournament_template t join public.blind_structure s on s.id = t.blind_structure_id
  where t.id = p_template_id
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function private.tournament_prize_tds(uuid, uuid, bigint), private.tournament_bounty_on(uuid),
  private.pay_tournament_run(uuid, integer, bigint, bigint, bigint, uuid), private.bust_tournament_entry(uuid, uuid) from public, anon, authenticated;
grant execute on function private.bust_tournament_entry(uuid, uuid) to authenticated;
revoke execute on function public.bust_tournament_entry(uuid, uuid) from public, anon;
grant execute on function public.bust_tournament_entry(uuid, uuid) to authenticated;
