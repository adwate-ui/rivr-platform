-- Buy-ins at the cage (#57; scope-v1 module 5; design prompt flow 3; lane A contract). A cashier
-- (cage.transact) issues chips to a seated player for cash, by UPI with its 12-digit UTR, or from the
-- member's wallet cash: one balanced ledger transaction, once per request id, by the rule @rivr/domain
-- buyIn and its SQL twin private.buy_in_check (packages/testing/golden/cage.json, 024_golden_twins).
-- Refused without a finished identity check, during a break, for a frozen member or venue, for a
-- player not seated, below the table's minimum buy-in, or for more than the wallet holds. A buy-in
-- request from the table waits in the cage's queue with the member's KYC photo; Approve from wallet
-- completes it (flow 3). The dealer tablet's Buy-in button is #59.

create table public.buy_in_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 5000 = 0),
  status text not null default 'waiting' constraint buy_in_request_status check (status in ('waiting', 'approved', 'declined')),
  requested_by_staff_id uuid,
  requested_by_device_id uuid,
  decided_by_staff_id uuid,
  decided_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (requested_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (requested_by_device_id, venue_id) references public.device (id, venue_id),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, idempotency_key),
  constraint buy_in_request_decided check ((status = 'waiting') = (decided_at is null) and (decided_at is null) = (decided_by_staff_id is null))
);

comment on table public.buy_in_request is 'A buy-in the table asks the cage for, until a cashier approves or declines it (#57).';

create index buy_in_request_waiting_idx on public.buy_in_request (venue_id, created_at) where status = 'waiting';
create index buy_in_request_member_idx on public.buy_in_request (member_id, venue_id);
-- One request waits per seat at a time: the cage decides it before the table asks again.
create unique index buy_in_request_one_waiting_idx on public.buy_in_request (session_id) where status = 'waiting';
create index buy_in_request_staff_idx on public.buy_in_request (requested_by_staff_id, venue_id);
create index buy_in_request_device_idx on public.buy_in_request (requested_by_device_id, venue_id);
create index buy_in_request_decider_idx on public.buy_in_request (decided_by_staff_id, venue_id);
create trigger buy_in_request_touch_updated_at before update on public.buy_in_request
  for each row execute function private.touch_updated_at();
create trigger buy_in_request_audit after insert or update or delete on public.buy_in_request
  for each row execute function private.audit_row_change();

create table public.cage_transaction (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('buy_in')),
  method text not null check (method in ('cash', 'upi', 'wallet')),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 5000 = 0),
  utr text check (utr ~ '^[0-9]{12}$'),
  session_id uuid not null references public.seat_session (id),
  buy_in_request_id uuid unique references public.buy_in_request (id),
  ledger_transaction_id uuid not null,
  cashier_staff_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (cashier_staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, idempotency_key),
  check ((method = 'upi') = (utr is not null))
);

comment on table public.cage_transaction is 'Chips issued at the cage: method, amount, UTR for UPI, and its ledger transaction (#57); never changed.';

-- A UTR pays for one buy-in.
create unique index cage_transaction_utr_idx on public.cage_transaction (venue_id, utr) where utr is not null;
create index cage_transaction_member_idx on public.cage_transaction (member_id, venue_id);
create index cage_transaction_session_idx on public.cage_transaction (session_id);
create index cage_transaction_ledger_idx on public.cage_transaction (ledger_transaction_id, venue_id);
create index cage_transaction_cashier_idx on public.cage_transaction (cashier_staff_id, venue_id);
create index cage_transaction_venue_idx on public.cage_transaction (venue_id, created_at);
create trigger cage_transaction_never_changed before update or delete on public.cage_transaction
  for each row execute function private.refuse_change();
create trigger cage_transaction_no_truncate before truncate on public.cage_transaction
  for each statement execute function private.refuse_change();
create trigger cage_transaction_audit after insert on public.cage_transaction
  for each row execute function private.audit_row_change();

alter table public.buy_in_request enable row level security;
alter table public.cage_transaction enable row level security;
grant select on public.buy_in_request, public.cage_transaction to authenticated;
create policy "cashiers see the venue's buy-in requests" on public.buy_in_request
  for select to authenticated using (venue_id in (select private.venues_where('cage.transact')));
create policy "members see their own cage transactions" on public.cage_transaction
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "cashiers see the venue's cage transactions" on public.cage_transaction
  for select to authenticated using (venue_id in (select private.venues_where('cage.transact')));
create policy "staff who read the ledger see the venue's cage transactions" on public.cage_transaction
  for select to authenticated using (venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain buyIn in SQL, proved on the same golden file: the account a buy-in comes from, or why not.
create function private.buy_in_check(p_method text, p_amount_paise bigint, p_minimum_paise bigint, p_wallet_paise bigint)
returns table (result text, debit text)
language sql
immutable
set search_path = ''
as $$
  select case when p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 then 'not_chips'
              when p_amount_paise < p_minimum_paise then 'below_minimum'
              when p_method = 'wallet' and p_amount_paise > p_wallet_paise then 'wallet_short'
              else 'ok' end,
         case when p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 or p_amount_paise < p_minimum_paise
                   or (p_method = 'wallet' and p_amount_paise > p_wallet_paise) then ''
              when p_method = 'cash' then 'cash_drawer' when p_method = 'upi' then 'bank' else 'member_cash' end;
$$;

-- A member's wallet cash, in paise: their cash account's natural balance.
create function private.wallet_cash(p_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(-sum(e.amount), 0)::bigint
  from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
  where a.member_id = p_member_id and a.code = 'member.cash';
$$;

-- What the cage refuses before any money moves: not a cashier here, no such member, a frozen member
-- or venue, no finished identity check, a break, or not seated. Gives the member's open session.
create function private.cage_check(p_venue_id uuid, p_member_id uuid)
returns public.seat_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier issues chips' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One buy-in at a time per member, after any break or freeze committed meanwhile.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'KYC incomplete: no chips until it is approved' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: no buy-ins until it ends' using errcode = 'RVBRK';
  end if;
  select * into v_session from public.seat_session s where s.member_id = p_member_id and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Not seated: chips are issued to a seat' using errcode = 'RVNST';
  end if;
  return v_session;
end;
$$;

-- Issues chips to a seated member for cash, by UPI (its UTR) or from wallet cash, once per request id,
-- completing a waiting buy-in request when one is given. Gives the cage transaction.
create function private.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid,
                                    p_utr text default null, p_buy_in_request_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.cage_transaction;
  v_session public.seat_session;
  v_check record;
  v_request public.buy_in_request;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier issues chips' using errcode = '42501';
  end if;
  select * into v_replay from public.cage_transaction c where c.venue_id = p_venue_id and c.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise or v_replay.method <> p_method then
      raise exception 'That request id was used for another buy-in' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  v_session := private.cage_check(p_venue_id, p_member_id);
  if p_method is null or p_method not in ('cash', 'upi', 'wallet') or (p_method = 'upi') <> (p_utr is not null)
     or (p_utr is not null and p_utr !~ '^[0-9]{12}$') then
    raise exception 'Cash, UPI with its 12-digit UTR, or wallet' using errcode = '22023';
  end if;
  if exists (select 1 from public.cage_transaction c where c.venue_id = p_venue_id and c.utr = p_utr) then
    raise exception 'That UTR already paid for another buy-in' using errcode = 'RVUTR';
  end if;
  select * into v_check from private.buy_in_check(p_method, p_amount_paise,
    (select tt.buy_in_min_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_session.table_id),
    private.wallet_cash(p_member_id));
  if v_check.result <> 'ok' then
    raise exception 'Refused: %', v_check.result
      using errcode = case v_check.result when 'not_chips' then 'RVCHP' when 'below_minimum' then 'RVMIN' else 'RVSHT' end;
  end if;
  if p_buy_in_request_id is not null then
    select * into v_request from public.buy_in_request r where r.id = p_buy_in_request_id for update;
    if v_request.id is null or v_request.venue_id <> p_venue_id or v_request.member_id <> p_member_id
       or v_request.amount_paise <> p_amount_paise or v_request.status <> 'waiting' then
      raise exception 'That request is not waiting for this member and amount' using errcode = '22023';
    end if;
    if v_request.session_id <> v_session.id then
      raise exception 'Seat % is no longer this player: decline the request', (select s.seat from public.seat_session s where s.id = v_request.session_id)
        using errcode = 'RVSTL';
    end if;
    update public.buy_in_request set status = 'approved', decided_at = now(), decided_by_staff_id = private.current_staff_id(p_venue_id)
    where id = v_request.id;
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'buy_in', 'buy_in:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                         and ((v_check.debit = 'member_cash' and a.code = 'member.cash' and a.member_id = p_member_id)
                                              or (v_check.debit <> 'member_cash' and a.code = 'venue.' || v_check.debit and a.member_id is null))),
                         'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'),
                         'amount', (-p_amount_paise)::text)),
    null, 'Buy-in at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, utr, session_id, buy_in_request_id,
                                       ledger_transaction_id, cashier_staff_id, idempotency_key)
  values (p_venue_id, p_member_id, 'buy_in', p_method, p_amount_paise, p_utr, v_session.id, p_buy_in_request_id,
          v_txn, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_id;
  perform private.emit(p_venue_id, 'cage.buy_in',
                       jsonb_build_object('cage_transaction_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise,
                                          'method', p_method, 'table_id', v_session.table_id), 'cage.buy_in:' || v_id);
  return v_id;
end;
$$;

-- The table asks the cage for chips for a seated player: the floor (waitlist.manage), or the dealer
-- tablet at that player's table (#59). Once per request id, and one waiting per seat (RVPND).
create function private.request_buy_in(p_session_id uuid, p_amount_paise bigint, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_device uuid;
  v_id uuid;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id and s.ended_at is null for update;
  if v_session.id is null then
    raise exception 'Ask for chips for a player who is seated' using errcode = '22023';
  end if;
  if not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    select d.id into v_device from public.device d join public.tablet_assignment a on a.device_id = d.id
    where d.id = private.current_device_id() and d.kind = 'dealer_tablet' and a.table_id = v_session.table_id;
    if v_device is null then
      raise exception 'Only the floor or the table''s tablet asks the cage for chips' using errcode = '42501';
    end if;
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 then
    raise exception 'A buy-in is whole ₹50 chips' using errcode = 'RVCHP';
  end if;
  select r.id into v_id from public.buy_in_request r where r.venue_id = v_session.venue_id and r.idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if exists (select 1 from public.buy_in_request r where r.session_id = v_session.id and r.status = 'waiting') then
    raise exception 'A buy-in for this seat is already with the cage' using errcode = 'RVPND';
  end if;
  insert into public.buy_in_request (venue_id, member_id, session_id, amount_paise, requested_by_staff_id, requested_by_device_id, idempotency_key)
  values (v_session.venue_id, v_session.member_id, v_session.id, p_amount_paise,
          case when v_device is null then private.current_staff_id(v_session.venue_id) end, v_device, p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- A cashier declines a waiting request.
create function private.decline_buy_in_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.buy_in_request;
begin
  select * into v_request from public.buy_in_request r where r.id = p_request_id for update;
  if v_request.id is null or not private.has_permission(v_request.venue_id, 'cage.transact') then
    raise exception 'Only a cashier declines a buy-in request' using errcode = '42501';
  end if;
  perform private.assert_writable(v_request.venue_id);
  if v_request.status <> 'waiting' then return; end if;
  update public.buy_in_request set status = 'declined', decided_at = now(), decided_by_staff_id = private.current_staff_id(v_request.venue_id)
  where id = v_request.id;
end;
$$;

-- The cage's queue: waiting buy-in requests from players still in the seat that asked, oldest first,
-- with where they sit and their KYC photo.
create function private.cage_queue(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, table_name text, seat integer, amount_paise bigint,
               requested_at timestamptz, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, m.id, m.full_name, g.name, s.seat, r.amount_paise, r.created_at, k.photo_path
  from public.buy_in_request r
  join public.member m on m.id = r.member_id
  join public.seat_session s on s.id = r.session_id
  join public.game_table g on g.id = s.table_id
  left join public.kyc_record k on k.member_id = m.id
  where r.venue_id = p_venue_id and r.status = 'waiting' and s.ended_at is null and private.has_permission(p_venue_id, 'cage.transact')
  order by r.created_at;
$$;

-- Members the cashier finds by name or mobile number, with what the cage needs: KYC, photo, wallet
-- cash, bonus, markers, where they sit and the table's minimum, and a break running.
create function private.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, t.name, private.is_kyc_complete(m.id), k.photo_path, private.wallet_cash(m.id),
         coalesce((select -sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.bonus'), 0)::bigint,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.receivable'), 0)::bigint,
         g.name, s.seat, tt.buy_in_min_paise, (select r.break_until from private.member_restrictions(m.id, now()) r)
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join public.seat_session s on s.member_id = m.id and s.ended_at is null
  left join public.game_table g on g.id = s.table_id
  left join public.table_type tt on tt.id = g.table_type_id
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'cage.transact')
    and length(trim(coalesce(p_query, ''))) >= 2
    and (m.full_name ilike '%' || trim(p_query) || '%'
         or m.phone like '%' || right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10) || '%' and length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4)
  order by m.full_name
  limit 10;
$$;

revoke execute on function private.buy_in_check(text, bigint, bigint, bigint), private.wallet_cash(uuid),
  private.cage_check(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.cage_buy_in(uuid, uuid, bigint, text, uuid, text, uuid), private.request_buy_in(uuid, bigint, uuid),
  private.decline_buy_in_request(uuid), private.cage_queue(uuid), private.cage_members(uuid, text) from public, anon;
grant execute on function private.cage_buy_in(uuid, uuid, bigint, text, uuid, text, uuid), private.request_buy_in(uuid, bigint, uuid),
  private.decline_buy_in_request(uuid), private.cage_queue(uuid), private.cage_members(uuid, text) to authenticated;

create function public.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid,
                                   p_utr text default null, p_buy_in_request_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.cage_buy_in(p_venue_id, p_member_id, p_amount_paise, p_method, p_idempotency_key, p_utr, p_buy_in_request_id); $$;
create function public.request_buy_in(p_session_id uuid, p_amount_paise bigint, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.request_buy_in(p_session_id, p_amount_paise, p_idempotency_key); $$;
create function public.decline_buy_in_request(p_request_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.decline_buy_in_request(p_request_id); $$;
create function public.cage_queue(p_venue_id uuid)
returns table (request_id uuid, member_id uuid, full_name text, table_name text, seat integer, amount_paise bigint,
               requested_at timestamptz, photo_path text)
language sql stable security invoker set search_path = ''
as $$ select * from private.cage_queue(p_venue_id); $$;
create function public.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.cage_members(p_venue_id, p_query); $$;

revoke execute on function public.cage_buy_in(uuid, uuid, bigint, text, uuid, text, uuid), public.request_buy_in(uuid, bigint, uuid),
  public.decline_buy_in_request(uuid), public.cage_queue(uuid), public.cage_members(uuid, text) from public, anon;
grant execute on function public.cage_buy_in(uuid, uuid, bigint, text, uuid, text, uuid), public.request_buy_in(uuid, bigint, uuid),
  public.decline_buy_in_request(uuid), public.cage_queue(uuid), public.cage_members(uuid, text) to authenticated;
