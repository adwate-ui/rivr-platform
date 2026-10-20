-- Bonus balances (#17; scope-v1 module 5: "bonus is playable, not withdrawable, and expires per
-- promotion rule"). Each grant to a member's bonus has an amount, what is left of it and an end;
-- private.credit_bonus posts one once per request id (which promotions grant bonus is lane D's). Bonus
-- buys chips at the cage (cage_buy_in's method 'bonus'), drawn from the grants in force, the soonest to
-- end first; it is never withdrawn (wallet cash only is). At its end a grant's remainder is reversed by
-- the minute's sweep, with its own ledger entry. The rules are @rivr/domain bonus's and buyIn's, proved
-- equal on packages/testing/golden/bonus.json and cage.json. Refusals: RVBON more than the bonus in force,
-- or a ledger reversal of a bonus movement (bonus moves only through its grants).

create table public.bonus_grant (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  remaining_paise bigint not null,
  expires_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 3 and 200),
  idempotency_key text not null check (length(idempotency_key) > 0),
  ledger_transaction_id uuid not null,
  -- When the sweep ended it, and the entry that reversed what was left (none when nothing was).
  expired_at timestamptz,
  expiry_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (expiry_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  check (remaining_paise between 0 and amount_paise),
  check (expiry_transaction_id is null or expired_at is not null)
);

comment on table public.bonus_grant is 'A grant to a member''s bonus: its amount, what is left, and its end (#17).';

create index bonus_grant_member_idx on public.bonus_grant (member_id, venue_id, expires_at);
create index bonus_grant_open_idx on public.bonus_grant (expires_at) where expired_at is null;
create index bonus_grant_txn_idx on public.bonus_grant (ledger_transaction_id, venue_id);
create index bonus_grant_expiry_txn_idx on public.bonus_grant (expiry_transaction_id, venue_id);
create trigger bonus_grant_touch_updated_at before update on public.bonus_grant
  for each row execute function private.touch_updated_at();
create trigger bonus_grant_audit after insert or update on public.bonus_grant
  for each row execute function private.audit_row_change();

alter table public.bonus_grant enable row level security;
grant select on public.bonus_grant to authenticated;
create policy "members see their own bonus" on public.bonus_grant
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "the cage and ledger staff see the venue's bonus" on public.bonus_grant
  for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')) or venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain bonusSpend in SQL, proved on the same golden file: what each grant gives (in the order
-- given), drawing the soonest to end first, or why not.
create function private.bonus_draws(p_amount_paise bigint, p_remaining bigint[], p_expires timestamptz[], p_at timestamptz)
returns table (result text, taken bigint[])
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_taken bigint[] := array_fill(0::bigint, array[coalesce(array_length(p_remaining, 1), 0)]);
  v_left bigint := p_amount_paise;
  v_index integer;
begin
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 then
    return query select 'not_chips'::text, null::bigint[];
    return;
  end if;
  if p_amount_paise > (select coalesce(sum(u.remaining), 0) from unnest(p_remaining, p_expires) as u (remaining, expires)
                       where u.remaining > 0 and u.expires > p_at) then
    return query select 'bonus_short'::text, null::bigint[];
    return;
  end if;
  for v_index in
    select u.n from unnest(p_remaining, p_expires) with ordinality as u (remaining, expires, n)
    where u.remaining > 0 and u.expires > p_at order by u.expires, u.n
  loop
    v_taken[v_index] := least(v_left, p_remaining[v_index]);
    v_left := v_left - v_taken[v_index];
  end loop;
  return query select 'ok'::text, v_taken;
end;
$$;

-- @rivr/domain bonusExpired in SQL: what expires at `p_at` of each grant, in the order given.
create function private.bonus_expiring(p_remaining bigint[], p_expires timestamptz[], p_at timestamptz)
returns bigint[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(case when u.expires <= p_at and u.remaining > 0 then u.remaining else 0 end order by u.n), '{}'::bigint[])
  from unnest(p_remaining, p_expires) with ordinality as u (remaining, expires, n);
$$;

-- A member's bonus in force at `p_at`: what is left of every grant not yet ended.
create function private.bonus_in_force(p_member_id uuid, p_at timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(g.remaining_paise), 0)::bigint from public.bonus_grant g
  where g.member_id = p_member_id and g.expired_at is null and g.expires_at > p_at;
$$;

-- Credits a member's bonus, from the venue's bonus expense, with an end and a reason, once per request
-- id: a replay posts nothing. For promotions (lane D) and the server; never called by an app.
create function private.credit_bonus(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_reason text, p_expires_at timestamptz,
                                     p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.bonus_grant;
  v_txn uuid;
  v_id uuid;
begin
  select * into v_replay from public.bonus_grant g where g.venue_id = p_venue_id and g.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise then
      raise exception 'That request id was used for another bonus' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_amount_paise is null or p_amount_paise <= 0 or p_expires_at is null or p_expires_at <= now()
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A bonus above nothing, an end to come, and a reason' using errcode = '22023';
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'bonus', 'bonus:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.bonus_expense'
                                         and a.member_id is null), 'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.bonus'),
                         'amount', (-p_amount_paise)::text)),
    'promotions', btrim(p_reason));
  insert into public.bonus_grant (venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id)
  values (p_venue_id, p_member_id, p_amount_paise, p_amount_paise, p_expires_at, btrim(p_reason), p_idempotency_key, v_txn)
  returning id into v_id;
  return v_id;
end;
$$;

-- Every minute: each grant whose end has come is closed, and what was left of it reversed to the
-- venue's bonus expense, by a bonus_expiry entry recorded on the grant. Not the ledger's reversal
-- link: that is the exact opposite, once, and some of the grant may have been played. A frozen venue
-- or member waits until released (the ledger refuses them).
create function private.expire_bonus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.bonus_grant;
  v_txn uuid;
begin
  for v_grant in
    select * from public.bonus_grant g
    where g.expired_at is null and g.expires_at <= now()
      and not exists (select 1 from public.control_state c where c.venue_id = g.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = g.member_id)))
    order by g.expires_at for update skip locked
  loop
    v_txn := null;
    if v_grant.remaining_paise > 0 then
      v_txn := private.post_ledger_transaction(v_grant.venue_id, 'bonus_expiry', 'bonus_expiry:' || v_grant.id,
        jsonb_build_array(
          jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_grant.member_id and a.code = 'member.bonus'),
                             'amount', v_grant.remaining_paise::text),
          jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_grant.venue_id
                                             and a.code = 'venue.bonus_expense' and a.member_id is null), 'amount', (-v_grant.remaining_paise)::text)),
        null, 'Bonus expired');
    end if;
    update public.bonus_grant set remaining_paise = 0, expired_at = now(), expiry_transaction_id = v_txn where id = v_grant.id;
  end loop;
end;
$$;

select cron.schedule('bonus-expiry', '* * * * *', 'select private.expire_bonus()');

-- A buy-in may come from the bonus in force.
alter table public.cage_transaction drop constraint cage_transaction_method_check;
alter table public.cage_transaction add constraint cage_transaction_method_check check (method in ('cash', 'upi', 'wallet', 'bonus'));

-- @rivr/domain buyIn in SQL, now with the bonus in force (#57's check, given one more balance).
create function private.buy_in_check(p_method text, p_amount_paise bigint, p_minimum_paise bigint, p_wallet_paise bigint, p_bonus_paise bigint)
returns table (result text, debit text)
language sql
immutable
set search_path = ''
as $$
  select r.result,
         case when r.result <> 'ok' then '' when p_method = 'cash' then 'cash_drawer' when p_method = 'upi' then 'bank'
              when p_method = 'bonus' then 'member_bonus' else 'member_cash' end
  from (select case when p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 then 'not_chips'
                    when p_amount_paise < p_minimum_paise then 'below_minimum'
                    when p_method = 'wallet' and p_amount_paise > p_wallet_paise then 'wallet_short'
                    when p_method = 'bonus' and p_amount_paise > p_bonus_paise then 'bonus_short'
                    else 'ok' end as result) r;
$$;

-- Draws a bonus buy-in from the member's grants in force, the soonest to end first (#17).
create function private.draw_bonus(p_member_id uuid, p_amount_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_result text;
  v_taken bigint[];
begin
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (select * from public.bonus_grant g where g.member_id = p_member_id and g.expired_at is null for update) g;
  select d.result, d.taken into v_result, v_taken from private.bonus_draws(p_amount_paise, v_remaining, v_expires, now()) d;
  if v_result <> 'ok' then
    raise exception 'More than the bonus in force' using errcode = 'RVBON';
  end if;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
end;
$$;

-- #57's buy-in, with the bonus in force as a method: the grants drawn and the member's bonus posted
-- against chips outstanding.
create or replace function private.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid,
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
  if p_method is null or p_method not in ('cash', 'upi', 'wallet', 'bonus') or (p_method = 'upi') <> (p_utr is not null)
     or (p_utr is not null and p_utr !~ '^[0-9]{12}$') then
    raise exception 'Cash, UPI with its 12-digit UTR, wallet or bonus' using errcode = '22023';
  end if;
  if exists (select 1 from public.cage_transaction c where c.venue_id = p_venue_id and c.utr = p_utr) then
    raise exception 'That UTR already paid for another buy-in' using errcode = 'RVUTR';
  end if;
  select * into v_check from private.buy_in_check(p_method, p_amount_paise,
    (select tt.buy_in_min_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_session.table_id),
    private.wallet_cash(p_member_id), private.bonus_in_force(p_member_id, now()));
  if v_check.result <> 'ok' then
    raise exception 'Refused: %', v_check.result
      using errcode = case v_check.result when 'not_chips' then 'RVCHP' when 'below_minimum' then 'RVMIN' when 'bonus_short' then 'RVBON' else 'RVSHT' end;
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
  if p_method = 'bonus' then
    perform private.draw_bonus(p_member_id, p_amount_paise);
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'buy_in', 'buy_in:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                         and ((v_check.debit = 'member_cash' and a.code = 'member.cash' and a.member_id = p_member_id)
                                              or (v_check.debit = 'member_bonus' and a.code = 'member.bonus' and a.member_id = p_member_id)
                                              or (v_check.debit not in ('member_cash', 'member_bonus') and a.code = 'venue.' || v_check.debit
                                                  and a.member_id is null))),
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

drop function private.buy_in_check(text, bigint, bigint, bigint);

-- Bonus moves only through its grants: reversing a transaction that touches a member's bonus would
-- leave the grants and the ledger apart (bonus in force with none held, or held with none in force),
-- so the ledger's reversal refuses it. Lane 0's function otherwise unchanged.
create or replace function private.reverse_ledger_transaction(
  p_transaction_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.ledger_transaction;
  reversal_id uuid;
begin
  select * into original from public.ledger_transaction t where t.id = p_transaction_id;
  if not found then
    raise exception 'ledger transaction % does not exist', p_transaction_id using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
             where e.transaction_id = p_transaction_id and a.code = 'member.bonus') then
    raise exception 'Bonus moves only through its grants: this transaction is not reversed' using errcode = 'RVBON';
  end if;
  reversal_id := private.post_ledger_transaction(
    original.venue_id, 'reversal', p_idempotency_key,
    (select jsonb_agg(jsonb_build_object('account_id', e.account_id, 'amount', (-e.amount)::text))
     from public.ledger_entry e where e.transaction_id = p_transaction_id),
    null, p_reason, p_transaction_id);
  return reversal_id;
end;
$$;

revoke execute on function private.bonus_draws(bigint, bigint[], timestamptz[], timestamptz), private.bonus_expiring(bigint[], timestamptz[], timestamptz),
  private.bonus_in_force(uuid, timestamptz), private.credit_bonus(uuid, uuid, bigint, text, timestamptz, text), private.expire_bonus(),
  private.buy_in_check(text, bigint, bigint, bigint, bigint), private.draw_bonus(uuid, bigint) from public, anon, authenticated;
grant execute on function private.credit_bonus(uuid, uuid, bigint, text, timestamptz, text) to service_role;
