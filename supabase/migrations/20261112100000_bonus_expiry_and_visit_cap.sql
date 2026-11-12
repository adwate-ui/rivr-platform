-- Bonus chips that expire, and a cap on what one visit redeems (the owner, 12 Nov; decision 0579; #908). Both are venue
-- settings only a super admin changes, and neither is set, so nothing changes until the owner sets them.
--
-- bonus.expiry_days: each grant ends N days after it is given (private.credit_bonus dates it), and chips held when expiry is
-- switched on end N days from then (the hourly sweep dates them). 0 is never: the sweep takes the end off chips not yet ended.
-- Changing N changes only grants given after. Spending is unchanged: soonest end first, so the oldest first while N stands.
-- Each expiry is a bonus_expiry ledger entry, as before, and the activity log has every grant's dating and ending.
--
-- bonus.visit_cap: a visit redeems at most x% of the bonus the member held at its first seat, in whole 50s. The first seat
-- notes that bonus on the visit; private.draw_bonus, at the seat or the cage, refuses more (RVVCP).
--
-- @rivr/domain bonusEnd, visitBonusCap and visitBonusLeft are the twins of private.bonus_end, visit_bonus_cap and
-- visit_bonus_left, proved equal on packages/testing/golden/bonus.json (024).

insert into public.setting_key (key, description, scope, value_schema) values
  ('bonus.expiry_days',
   'How many days bonus chips last after they are given; chips held when it is switched on last that long from then. 0 is never. None set is never.',
   'venue',
   '{"type":"object","properties":{"days":{"type":"integer","minimum":0,"maximum":3650}},"required":["days"],"additionalProperties":false}'),
  ('bonus.visit_cap',
   'The share of the bonus a member held at a visit''s first seat that they may redeem in that visit, in whole 50s. None set is all of it.',
   'venue',
   '{"type":"object","properties":{"basis_points":{"type":"integer","minimum":100,"maximum":10000}},"required":["basis_points"],"additionalProperties":false}');

-- As before (20261110656200_store_reviewer_sign_in.sql), with both bonus settings control settings too: only a super admin changes them.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap'))
  execute function private.guard_control_settings();

-- When a grant ends: `days` after it was given, or after expiry was switched on (`since`) for chips held before; never at 0 days.
-- In hours, so a day is 24 of them whatever the session's time zone, as @rivr/domain bonusEnd counts it.
create function private.bonus_end(p_given_at timestamptz, p_days integer, p_since timestamptz)
returns timestamptz language sql immutable set search_path = ''
as $$ select case when p_days = 0 then null else greatest(p_given_at, p_since) + make_interval(hours => p_days * 24) end; $$;

-- The most bonus a visit redeems: `p_basis_points` of what was held at its first seat, rounded down to whole 50s (5,000 paise).
create function private.visit_bonus_cap(p_held_paise bigint, p_basis_points integer)
returns bigint language sql immutable set search_path = ''
as $$ select (p_held_paise * p_basis_points / 10000) / 5000 * 5000; $$;

-- What a visit may still redeem: its cap less what it has redeemed, never below nothing.
create function private.visit_bonus_left(p_cap_paise bigint, p_redeemed_paise bigint)
returns bigint language sql immutable set search_path = ''
as $$ select greatest(0, p_cap_paise - p_redeemed_paise); $$;

-- The venue's bonus expiry in force: its days (0 is never) and since when; no row where none is set.
create function private.bonus_expiry(p_venue_id uuid)
returns table (days integer, since timestamptz)
language sql stable security definer set search_path = ''
as $$
  select (s.value ->> 'days')::integer, s.effective_from from public.setting s
  where s.venue_id = p_venue_id and s.key = 'bonus.expiry_days' and s.subject = '' and s.effective_from <= now()
  order by s.effective_from desc limit 1;
$$;

-- As 20261109090000_bonus_chips.sql made it, with a grant given no end of its own dated by the venue's bonus.expiry_days.
create or replace function private.credit_bonus(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_reason text, p_expires_at timestamptz,
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
  v_expires_at timestamptz := p_expires_at;
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
  if p_amount_paise is null or p_amount_paise <= 0 or p_expires_at <= now()
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A bonus above nothing, no end or one to come, and a reason' using errcode = '22023';
  end if;
  if v_expires_at is null then
    select private.bonus_end(now(), e.days, e.since) into v_expires_at from private.bonus_expiry(p_venue_id) e;
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'bonus', 'bonus:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.bonus_expense'
                                         and a.member_id is null), 'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.bonus'),
                         'amount', (-p_amount_paise)::text)),
    'promotions', btrim(p_reason));
  insert into public.bonus_grant (venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id)
  values (p_venue_id, p_member_id, p_amount_paise, p_amount_paise, v_expires_at, btrim(p_reason), p_idempotency_key, v_txn)
  returning id into v_id;
  -- The member's app shows a toast and the push consumer sends a push (push.bonus).
  perform private.emit(p_venue_id, 'bonus.credited',
                       jsonb_build_object('bonus_grant_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise, 'reason', btrim(p_reason)),
                       'bonus.credited:' || v_id);
  return v_id;
end;
$$;

-- As 20261019093100_bonus.sql made it (hourly since 20261110402000), first dating chips held with no end where the venue's
-- chips expire, from when that was switched on, and taking the end off chips not yet ended where it is switched off (0 days).
create or replace function private.expire_bonus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.bonus_grant;
  v_txn uuid;
begin
  update public.bonus_grant g set expires_at = private.bonus_end(g.created_at, e.days, e.since)
  from public.venue v cross join lateral private.bonus_expiry(v.id) e
  where g.venue_id = v.id and g.expired_at is null and g.expires_at is null and e.days > 0;
  -- Every end after the switch-off goes, though the sweep comes up to an hour later (the money audit of #908).
  update public.bonus_grant g set expires_at = null
  from public.venue v cross join lateral private.bonus_expiry(v.id) e
  where g.venue_id = v.id and g.expired_at is null and g.expires_at > e.since and e.days = 0;
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

-- The bonus held as a visit's first seat began, which bonus.visit_cap takes its share of.
alter table public.visit add column bonus_at_first_seat_paise bigint check (bonus_at_first_seat_paise >= 0);
comment on column public.visit.bonus_at_first_seat_paise is
  'The bonus the member held as the visit''s first seat began, in paise; what bonus.visit_cap takes its share of (decision 0579).';
-- The member's own figure, so their export gives it (decision 0284's export, test 151).
insert into private.member_export_column (table_name, column_name, kind) values ('visit', 'bonus_at_first_seat_paise', 'owed');

-- A visit's first seat notes the bonus held then, before any is redeemed with it; an undone seat leaves the note.
create function private.note_bonus_at_first_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.visit v set bonus_at_first_seat_paise = private.bonus_in_force(new.member_id, now())
  where v.id = new.visit_id and v.bonus_at_first_seat_paise is null;
  return null;
end;
$$;
create trigger seat_session_notes_bonus after insert on public.seat_session
  for each row execute function private.note_bonus_at_first_seat();

-- A visit's only seat undone takes its note with it, so the next first seat notes the bonus held then (the money audit of #908).
create function private.forget_bonus_at_first_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.visit v set bonus_at_first_seat_paise = null
  where v.id = old.visit_id and not exists (select 1 from public.seat_session s where s.visit_id = old.visit_id);
  return null;
end;
$$;
create trigger seat_session_forgets_bonus after delete on public.seat_session
  for each row execute function private.forget_bonus_at_first_seat();

-- What a member's open visit may still redeem under bonus.visit_cap, in paise; null where the venue sets no cap. Before the
-- visit's first seat, the share of what they hold now, which that seat will note.
create function private.bonus_visit_left(p_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with share as (
    select (private.setting_at(m.venue_id, 'bonus.visit_cap', '', now()) ->> 'basis_points')::integer as basis_points
    from public.member m where m.id = p_member_id
  ), open_visit as (
    select v.id, v.bonus_at_first_seat_paise from public.visit v where v.member_id = p_member_id and v.closed_at is null
  )
  select case when s.basis_points is null then null else
    private.visit_bonus_left(
      private.visit_bonus_cap(coalesce((select o.bonus_at_first_seat_paise from open_visit o), private.bonus_in_force(p_member_id, now())), s.basis_points),
      (coalesce((select sum(r.amount_paise) from public.bonus_redemption r join public.seat_session ss on ss.id = r.session_id
                 where ss.visit_id = (select o.id from open_visit o)), 0)
       -- and bonus buy-ins at the cage, hidden since decision 0284 but still there (the money audit of #908).
       + coalesce((select sum(c.amount_paise) from public.cage_transaction c join public.seat_session ss on ss.id = c.session_id
                   where c.kind = 'buy_in' and c.method = 'bonus' and ss.visit_id = (select o.id from open_visit o)), 0))::bigint)
  end
  from share s;
$$;

-- For the console's seat sheets: what the member may still redeem this visit, for staff who open member records; null for no cap.
create function private.member_bonus_visit_left(p_venue_id uuid, p_member_id uuid)
returns table (left_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_visit_left(m.id) from public.member m
  where m.id = p_member_id and m.venue_id = p_venue_id and coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$$;
create function public.member_bonus_visit_left(p_venue_id uuid, p_member_id uuid)
returns table (left_paise bigint) language sql stable security invoker set search_path = ''
as $$ select * from private.member_bonus_visit_left(p_venue_id, p_member_id); $$;

-- As 20261019093100_bonus.sql made it, holding every draw of bonus, at the seat or at the cage, to what the member's visit may
-- still redeem under bonus.visit_cap (RVVCP), once the member's grants are locked, so two draws cannot both pass (the money
-- audit of #908).
create or replace function private.draw_bonus(p_member_id uuid, p_amount_paise bigint)
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
  v_left bigint;
begin
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (select * from public.bonus_grant g where g.member_id = p_member_id and g.expired_at is null for update) g;
  v_left := private.bonus_visit_left(p_member_id);
  if v_left is not null and p_amount_paise > v_left then
    raise exception 'More bonus than this visit allows: % chips left', v_left / 100 using errcode = 'RVVCP';
  end if;
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

revoke execute on function private.bonus_end(timestamptz, integer, timestamptz), private.visit_bonus_cap(bigint, integer),
  private.visit_bonus_left(bigint, bigint), private.bonus_expiry(uuid), private.note_bonus_at_first_seat(), private.forget_bonus_at_first_seat(),
  private.bonus_visit_left(uuid),
  private.member_bonus_visit_left(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.member_bonus_visit_left(uuid, uuid) from public, anon;
grant execute on function private.member_bonus_visit_left(uuid, uuid), public.member_bonus_visit_left(uuid, uuid) to authenticated;
