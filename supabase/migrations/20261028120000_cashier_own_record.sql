-- A cashier never serves their own member record at the cage (#500; question #494 item 5, the owner's answers of 27 Oct).
-- Deposits, withdrawals and payout accounts already refuse it (private.is_own_kyc_check). Now the cage's check, every
-- cage transaction (buy-ins, cash-outs, repayments), every marker and a cash tournament buy refuse it too, so a cashier
-- who is also a member cannot cash out to their own wallet, issue themselves a marker or enter a tournament unpaid.
-- Another cashier serves them. RVOWN names it.

-- At the cage, a cashier's own record is the member on their login or with their phone at that venue: not one who only
-- shares their name, so a cashier serves a stranger of the same name (the owner's answer of 27 Oct). Deposits,
-- withdrawals and payout accounts keep the name too: another approver handles those.
create function private.is_own_cage_record(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_member_id = private.current_member_id(), false)
    or exists (select 1 from public.member m join public.staff s on s.user_id = (select auth.uid()) and s.venue_id = m.venue_id
               where m.id = p_member_id and s.phone = m.phone);
$$;

revoke execute on function private.is_own_cage_record(uuid) from public, anon, authenticated;

create function private.refuse_own_cage_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A purge or practice reset replays rows as captured.
  if coalesce(private.purging(new.venue_id), false) then
    return new;
  end if;
  if private.is_own_cage_record(new.member_id) then
    raise exception 'A cashier never serves their own member record' using errcode = 'RVOWN';
  end if;
  return new;
end;
$$;

revoke execute on function private.refuse_own_cage_record() from public, anon, authenticated;

create trigger cage_transaction_not_own before insert on public.cage_transaction
  for each row execute function private.refuse_own_cage_record();
create trigger marker_not_own before insert on public.marker
  for each row execute function private.refuse_own_cage_record();

-- As before (20261020090500_kyc_at_the_cage.sql), but a cashier's own member record is refused first, so the cage says so
-- before anything else.
create or replace function private.cage_check(p_venue_id uuid, p_member_id uuid)
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
  if private.is_own_cage_record(p_member_id) then
    raise exception 'A cashier never serves their own member record' using errcode = 'RVOWN';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One buy-in at a time per member, after any break or freeze committed meanwhile.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  perform private.assert_kyc_for_cage(p_member_id);
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

-- As before (20261026235200_tournament_entries.sql), but never a cashier's own member record: a cash buy writes no cage
-- transaction, so the trigger above does not see it. Not on tournament_purchase itself, which the member's own app
-- registration also writes.
create or replace function private.cage_tournament_entry(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'cage.transact') then
    raise exception 'Only a cashier takes tournament buys in cash' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'A cashier never serves their own member record' using errcode = 'RVOWN';
  end if;
  return private.tournament_buy(p_tournament_id, p_member_id, p_purchase, 'cash', p_idempotency_key);
end;
$$;
