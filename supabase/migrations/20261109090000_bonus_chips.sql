-- Bonus chips (the owner, 6 Nov 2026; decision 0504). Three changes to the bonus of 20261019093100_bonus.sql:
-- 1. Bonus chips never expire. A grant has no end; those already expired stay expired.
-- 2. The sign-up promotion pays when the member reaches Home. With identity checked at the club that is their selfie,
--    before the desk check, and only while the promotion is live; their desk check later gives nothing more.
-- 3. Staff who open member records redeem bonus chips with the buy-in as they seat the player: drawn from the grants,
--    posted from the member's bonus to chips outstanding, recorded as a bonus_redemption, and told to the member.
-- Members read their balance and history in the Rewards tab; staff read a member's on the record's Bonus tab.

-- 1. No expiry ------------------------------------------------------------------------------------------------------

-- A grant whose end has already come is swept first, so what had expired stays expired; every grant whose end is still
-- to come then has none. One of a frozen venue or member is not swept until released, so it keeps its end, and the
-- minute's sweep (bonus-expiry) stays on to close it then: it touches only grants with an end.
select private.expire_bonus();
alter table public.bonus_grant alter column expires_at drop not null;
comment on column public.bonus_grant.expires_at is 'When the grant ends, for grants given before bonus chips stopped expiring (decision 0504). Null: never.';
update public.bonus_grant set expires_at = null where expired_at is null and expires_at > now();

-- As 20261019093100_bonus.sql made it, with no end (null) allowed: a grant without one never ends.
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
  -- The member's app shows a toast and the push consumer sends a push (push.bonus).
  perform private.emit(p_venue_id, 'bonus.credited',
                       jsonb_build_object('bonus_grant_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise, 'reason', btrim(p_reason)),
                       'bonus.credited:' || v_id);
  return v_id;
end;
$$;

-- @rivr/domain bonusSpend in SQL, as 20261019093100_bonus.sql made it: a grant with no end is always in force, and is
-- drawn after the grants that end (the soonest first), the oldest first.
create or replace function private.bonus_draws(p_amount_paise bigint, p_remaining bigint[], p_expires timestamptz[], p_at timestamptz)
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
                       where u.remaining > 0 and (u.expires is null or u.expires > p_at)) then
    return query select 'bonus_short'::text, null::bigint[];
    return;
  end if;
  for v_index in
    select u.n from unnest(p_remaining, p_expires) with ordinality as u (remaining, expires, n)
    where u.remaining > 0 and (u.expires is null or u.expires > p_at) order by u.expires nulls last, u.n
  loop
    v_taken[v_index] := least(v_left, p_remaining[v_index]);
    v_left := v_left - v_taken[v_index];
  end loop;
  return query select 'ok'::text, v_taken;
end;
$$;

-- A member's bonus in force at `p_at`: what is left of every grant not ended, with those that never end.
create or replace function private.bonus_in_force(p_member_id uuid, p_at timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(g.remaining_paise), 0)::bigint from public.bonus_grant g
  where g.member_id = p_member_id and g.expired_at is null and (g.expires_at is null or g.expires_at > p_at);
$$;

-- As 20261107120000_promotion_engine_on_versions.sql made it, with chips credited as bonus that never ends.
create or replace function private.give_promotion_version(p_candidate jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
  v_event jsonb := p_candidate -> 'event';
  v_member uuid := (p_candidate #>> '{event,memberId}')::uuid;
  v_chips bigint := (p_candidate ->> 'chips')::bigint;
  v_points bigint := (p_candidate ->> 'points')::bigint;
  v_effect jsonb;
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  -- The wheel takes a grant of the old effect `spin`.
  v_effect := case when v_version.reward ->> 'kind' = 'free_spin' then '{"kind": "spin"}'::jsonb else v_version.reward end;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, points, chips,
                                      spins, perk, source_key, period_key, club_day)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_effect,
          v_chips * 100, v_points, v_chips, (p_candidate ->> 'spins')::integer, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz))
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name, null, 'promotion:' || v_id)
    where id = v_id;
  elsif v_points > 0 then
    perform private.credit_points(v_version.venue_id, v_member, v_points, v_version.name, 'promotion:' || v_id);
    update public.promotion_grant set fulfilled_at = now() where id = v_id;
  end if;
  perform private.emit(v_version.venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                          'member_id', v_member, 'effect', v_effect, 'cost_paise', v_chips * 100, 'points', v_points, 'chips', v_chips,
                                          'spins', (p_candidate ->> 'spins')::integer, 'perk', p_candidate ->> 'perk'),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$$;

-- As 20261020145904_promotions_engine.sql made it (promotions made before versions), with a bonus that never ends.
create or replace function private.give_promotion(p_candidate jsonb, p_facts jsonb, p_context jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (p_candidate ->> 'venue_id')::uuid;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_effect jsonb := p_candidate -> 'effect';
  v_id uuid;
begin
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, table_id, trigger, effect, cost_paise, points,
                                      source_key, club_day)
  values (v_venue_id, (p_candidate ->> 'promotion')::uuid, (p_candidate ->> 'rule')::uuid, v_member_id, (p_facts ->> 'table_id')::uuid,
          p_candidate ->> 'trigger', v_effect, (p_candidate ->> 'cost_paise')::bigint, (p_candidate ->> 'points')::bigint, p_context ->> 'key',
          (p_facts ->> 'club_day')::date)
  returning id into v_id;
  if v_effect ->> 'kind' = 'bonus' then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_venue_id, v_member_id, (p_candidate ->> 'cost_paise')::bigint, p_candidate ->> 'name', null,
                                              'promotion:' || v_id)
    where id = v_id;
  end if;
  perform private.emit(v_venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', p_candidate ->> 'promotion', 'member_id', v_member_id,
                                          'effect', v_effect, 'cost_paise', (p_candidate ->> 'cost_paise')::bigint,
                                          'points', (p_candidate ->> 'points')::bigint),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$$;

-- As 20261028370000_rakeback.sql made it, with rakeback that never ends (rakeback is off; kept consistent).
create or replace function private.give_rakeback(p_venue_id uuid, p_week_from timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_grant_id uuid;
  v_given integer := 0;
begin
  for v_due in select * from private.rakeback_due(p_venue_id, p_week_from) order by member_id, stake loop
    begin
      perform private.assert_writable(p_venue_id, 'promotions', v_due.member_id);
      v_grant_id := private.credit_bonus(p_venue_id, v_due.member_id, v_due.due_paise, 'Hourly rakeback', null, v_due.key);
      perform private.emit(p_venue_id, 'rakeback.given',
                           jsonb_build_object('member_id', v_due.member_id, 'week', private.rakeback_week_date(p_week_from), 'stake', v_due.stake,
                                              'amount_paise', v_due.due_paise, 'bonus_grant_id', v_grant_id),
                           'rakeback.given:' || v_grant_id);
      v_given := v_given + 1;
    exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' or sqlstate 'RVMBR' then
      null; -- venue frozen, promotions switched off, member frozen: a later run gives it once released
    end;
  end loop;
  return v_given;
end;
$$;

-- As 20261107120000_promotion_engine_on_versions.sql made it, with a bonus won that never ends.
create or replace function private.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
returns table (spin_id uuid, kind text, amount bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.promotion_grant;
  v_budget bigint;
  v_promotion_left bigint;
  v_prizes jsonb;
  v_ids uuid[];
  v_odds bigint;
  v_roll bigint;
  v_prize public.spin_wheel;
  v_spin_id uuid;
  v_bonus_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions spin the wheel' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('spin_wheel:' || p_venue_id::text, 0));
  select * into v_grant from public.promotion_grant g
  where g.id = p_grant_id and g.venue_id = p_venue_id and g.effect ->> 'kind' = 'spin' and g.fulfilled_at is null
    and exists (select 1 from public.member m where m.id = g.member_id and m.erased_at is null)
  for update of g;
  if not found then
    raise exception 'No spin waiting for that grant' using errcode = 'P0002';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions', v_grant.member_id);
  select b.cap_paise - coalesce((select sum(g.cost_paise) from public.promotion_grant g where g.promotion_id = b.promotion_id
                                   and (b.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_grant.club_day))), 0)
    into v_promotion_left
  from public.promotion_budget b where b.promotion_id = v_grant.promotion_id;
  v_budget := greatest(least(private.spin_budget_left(p_venue_id), v_promotion_left), 0);
  select jsonb_agg(jsonb_build_object('kind', w.kind, 'amount', w.amount, 'weight', w.weight) order by w.created_at, w.id),
         array_agg(w.id order by w.created_at, w.id),
         coalesce(sum(w.weight) filter (where w.kind <> 'bonus' or w.amount <= v_budget), 0)
    into v_prizes, v_ids, v_odds
  from public.spin_wheel w where w.venue_id = p_venue_id and w.removed_at is null;
  if v_odds = 0 then
    raise exception 'No prize on the wheel the spin budget and the promotion''s budget allow' using errcode = 'RVSPN';
  end if;
  v_roll := ('x' || encode(extensions.gen_random_bytes(6), 'hex'))::bit(48)::bigint % v_odds;
  select * into v_prize from public.spin_wheel w where w.id = v_ids[private.spin_prize(v_prizes, v_budget, v_roll)];
  insert into public.spin (venue_id, grant_id, member_id, prize_id, kind, amount, roll, odds, spun_by_staff_id)
  values (p_venue_id, p_grant_id, v_grant.member_id, v_prize.id, v_prize.kind, v_prize.amount, v_roll, v_odds, private.current_staff_id(p_venue_id))
  returning id into v_spin_id;
  if v_prize.kind = 'points' then
    perform private.credit_points(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', 'spin:' || v_spin_id);
  elsif v_prize.kind = 'bonus' then
    v_bonus_id := private.credit_bonus(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', null, 'spin:' || v_spin_id);
    update public.spin set bonus_grant_id = v_bonus_id where id = v_spin_id;
  end if;
  -- A bonus won adds to the grant's cost and chips, so the promotion's budget counts it.
  update public.promotion_grant
  set spins_used = spins_used + 1,
      fulfilled_at = case when spins_used + 1 >= greatest(spins, 1) then now() end,
      bonus_grant_id = coalesce(v_bonus_id, bonus_grant_id),
      cost_paise = cost_paise + case when v_prize.kind = 'bonus' then v_prize.amount else 0 end,
      chips = chips + case when v_prize.kind = 'bonus' then v_prize.amount / 100 else 0 end
  where id = p_grant_id;
  return query select v_spin_id, v_prize.kind, v_prize.amount;
end;
$$;

-- 2. The sign-up promotion at Home ------------------------------------------------------------------------------------

-- As 20261107120000_promotion_engine_on_versions.sql made it, but a member let in by their selfie (at_club_from stamped
-- now, by take_kyc_at_the_club) has reached Home and is weighed then. Their desk check later gives nothing: they were
-- weighed when they joined, while the promotion was or was not live. A reopened check is stamped with the day it began,
-- not now, so it is never weighed. A member verified in the app is weighed at verification, as before. The engine gives
-- live promotions only, and the event's key (signup:<member>) is weighed once.
create or replace function private.signup_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.purging(new.venue_id), false) then
    return null;
  end if;
  if new.status = 'verified' then
    if (tg_op = 'UPDATE' and old.status = 'verified') or new.at_club_from is not null then
      return null;
    end if;
  elsif new.at_club_from is distinct from now() or (tg_op = 'UPDATE' and old.at_club_from is not null) then
    return null;
  end if;
  perform private.evaluate_promotions(new.venue_id, 'signup', jsonb_build_object('member_id', new.member_id, 'key', 'signup:' || new.member_id));
  return null;
end;
$$;

drop trigger kyc_record_signup_promotions on public.kyc_record;
create trigger kyc_record_signup_promotions
  after insert or update of status, at_club_from on public.kyc_record
  for each row
  when (new.status = 'verified' or (new.status = 'started' and new.at_club_from is not null))
  execute function private.signup_promotions();

-- 3. Redeeming while seating ------------------------------------------------------------------------------------------

-- Bonus chips a member redeemed with their buy-in as the floor seated them: the session and table, the ledger entry that
-- moved them from the member's bonus to chips outstanding, and who seated them.
create table public.bonus_redemption (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  table_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 5000 = 0),
  ledger_transaction_id uuid not null,
  staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.bonus_redemption is 'Bonus chips a member redeemed with their buy-in as they were seated (decision 0504).';

create index bonus_redemption_member_idx on public.bonus_redemption (member_id, created_at);
create index bonus_redemption_venue_idx on public.bonus_redemption (venue_id, created_at);
create index bonus_redemption_session_idx on public.bonus_redemption (session_id);
create index bonus_redemption_table_idx on public.bonus_redemption (table_id, venue_id);
create index bonus_redemption_txn_idx on public.bonus_redemption (ledger_transaction_id, venue_id);
create index bonus_redemption_staff_idx on public.bonus_redemption (staff_id, venue_id);
create trigger bonus_redemption_touch_updated_at before update on public.bonus_redemption
  for each row execute function private.touch_updated_at();
create trigger bonus_redemption_audit after insert or update on public.bonus_redemption
  for each row execute function private.audit_row_change();

alter table public.bonus_redemption enable row level security;
grant select on public.bonus_redemption to authenticated;
create policy "members see their own bonus redemptions" on public.bonus_redemption
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who open member records see the venue's bonus redemptions" on public.bonus_redemption
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- The member's data export carries their redemptions, as it carries their grants.
insert into private.member_export_column (table_name, column_name, kind) values
  ('bonus_redemption', 'id', 'owed'), ('bonus_redemption', 'venue_id', 'owed'), ('bonus_redemption', 'member_id', 'owed'),
  ('bonus_redemption', 'session_id', 'owed'), ('bonus_redemption', 'table_id', 'owed'), ('bonus_redemption', 'amount_paise', 'owed'),
  ('bonus_redemption', 'ledger_transaction_id', 'owed'), ('bonus_redemption', 'staff_id', 'owed'), ('bonus_redemption', 'created_at', 'owed'),
  ('bonus_redemption', 'updated_at', 'owed');

-- Redeems bonus chips with the buy-in of the seat just taken, in the seating's transaction, so a refusal also undoes the
-- seat. None (null or 0) does nothing. Posted as bonus_buy_in, not buy_in: no cage shift is open while the cage is hidden.
-- Bonus never earns a buy-in promotion (decision 0472). Promotions switched off at the kill switch stop it too, as chips
-- given wrongly cannot be taken back; and like the cage's buy-ins it is limited to 30 a minute for each staff member and
-- 120 for the venue, alerting the owner (private.assert_rate). Refusals: 42501 not staff who open member records; RVOWN
-- their own record; RVKIL promotions switched off, RVFRZ/RVMBR the venue or member frozen; RVRAT too many a minute;
-- RVCHP not whole 50s; RVBON more than the member's bonus.
create function private.redeem_bonus_at_seat(p_session_id uuid, p_chips integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_amount bigint := p_chips::bigint * 100;
  v_id uuid := gen_random_uuid();
  v_txn uuid;
  v_table_name text;
begin
  if coalesce(p_chips, 0) = 0 then
    return;
  end if;
  select * into v_session from public.seat_session s where s.id = p_session_id;
  if v_session.id is null or not coalesce(private.has_permission(v_session.venue_id, 'members.read'), false) then
    raise exception 'Only staff who open member records redeem bonus chips' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) then
    raise exception 'Staff never redeem their own bonus chips' using errcode = 'RVOWN';
  end if;
  if p_chips < 0 or p_chips % 50 <> 0 then
    raise exception 'Bonus chips are redeemed in whole 50s' using errcode = 'RVCHP';
  end if;
  perform private.assert_rate(v_session.venue_id, 'bonus.redeem');
  perform private.draw_bonus(v_session.member_id, v_amount);
  v_txn := private.post_ledger_transaction(v_session.venue_id, 'bonus_buy_in', 'bonus_buy_in:' || v_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_session.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_session.venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus chips redeemed at the seat');
  insert into public.bonus_redemption (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id)
  values (v_id, v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_amount, v_txn,
          private.current_staff_id(v_session.venue_id));
  select t.name into v_table_name from public.game_table t where t.id = v_session.table_id;
  perform private.emit(v_session.venue_id, 'bonus.redeemed',
                       jsonb_build_object('bonus_redemption_id', v_id, 'member_id', v_session.member_id, 'amount_paise', v_amount,
                                          'table_id', v_session.table_id, 'table_name', v_table_name),
                       'bonus.redeemed:' || v_id);
end;
$$;

-- As 20261102100100_assign_and_seat.sql made it, with bonus chips the member redeems with their buy-in.
drop function public.seat_member(uuid, integer, text, bigint, integer);
drop function private.seat_member(uuid, integer, text, bigint, integer);
create function private.seat_member(p_table_id uuid, p_seat integer, p_phone text default null, p_member_number bigint default null,
                                    p_call_minutes integer default null, p_bonus_chips integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table := private.floor_table(p_table_id);
  v_member_id uuid;
  v_id uuid;
  v_entry public.waitlist_entry;
begin
  if (p_phone is null) = (p_member_number is null) then
    raise exception 'Seat by a mobile number or a membership number' using errcode = '22023';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = v_table.venue_id
    and (m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10) or m.member_number = p_member_number);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  v_id := private.start_seat_session(v_member_id, p_table_id, p_seat);
  if p_call_minutes is not null then
    perform private.set_seat_call_time(v_id, p_call_minutes);
  end if;
  perform private.redeem_bonus_at_seat(v_id, p_bonus_chips);
  -- Seated at this game, so off its waitlist: the floor calls nobody already playing it. A seat they were called to goes
  -- to the next name, as when a member leaves the list (leave_waitlist).
  for v_entry in update public.waitlist_entry e set status = 'left', left_at = now(), left_reason = 'seated'
                 where e.member_id = v_member_id and e.table_type_id = v_table.table_type_id and e.status = 'waiting'
                 returning e.* loop
    if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
  end loop;
  perform private.emit(v_table.venue_id, 'seat.taken',
                       jsonb_build_object('session_id', v_id, 'member_id', v_member_id, 'table_id', v_table.id, 'seat', p_seat), 'seat.taken:' || v_id);
  return v_id;
end;
$$;

create function public.seat_member(p_table_id uuid, p_seat integer, p_phone text default null, p_member_number bigint default null,
                                   p_call_minutes integer default null, p_bonus_chips integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.seat_member(p_table_id, p_seat, p_phone, p_member_number, p_call_minutes, p_bonus_chips); $$;

-- As 20261102100100_assign_and_seat.sql made it, with bonus chips the member redeems with their buy-in.
drop function public.assign_from_waitlist(uuid, uuid, integer, integer);
drop function private.assign_from_waitlist(uuid, uuid, integer, integer);
create function private.assign_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer, p_call_minutes integer,
                                             p_bonus_chips integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (select e.member_id from public.waitlist_entry e where e.id = p_entry_id);
  -- Seated already, the member changes tables in the same session, keeping their call time.
  v_was_seated boolean := exists (select 1 from public.seat_session s where s.member_id = v_member_id and s.ended_at is null);
  v_session_id uuid;
begin
  perform private.call_from_waitlist(p_entry_id, p_table_id, p_seat);
  perform private.seat_from_waitlist(p_entry_id);
  v_session_id := (select s.id from public.seat_session s where s.member_id = v_member_id and s.ended_at is null);
  if not v_was_seated then
    perform private.set_seat_call_time(v_session_id, p_call_minutes);
  end if;
  perform private.redeem_bonus_at_seat(v_session_id, p_bonus_chips);
end;
$$;

create function public.assign_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer, p_call_minutes integer,
                                            p_bonus_chips integer default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.assign_from_waitlist(p_entry_id, p_table_id, p_seat, p_call_minutes, p_bonus_chips); $$;

-- Reads ---------------------------------------------------------------------------------------------------------------

-- A member's bonus history, newest first: chips given (with the promotion's name), chips redeemed (with the table and
-- who seated them, or the cage before it was hidden) and chips that expired before bonus stopped expiring.
create function private.bonus_history(p_member_id uuid, p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text, staff_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.line_id, h.at, h.kind, h.amount_paise, h.reason, h.table_name, h.staff_name from (
    select g.id as line_id, g.created_at as at, 'credited' as kind, g.amount_paise, g.reason, null::text as table_name,
           null::text as staff_name
    from public.bonus_grant g where g.member_id = p_member_id
    union all
    select g.id, g.expired_at, 'expired', e.amount, g.reason, null, null
    from public.bonus_grant g
    -- The sweep's own entry: an erasure's forfeit closes grants too, but is no expiry.
    join public.ledger_transaction t on t.id = g.expiry_transaction_id and t.kind = 'bonus_expiry'
    join public.ledger_entry e on e.transaction_id = t.id
    join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
    where g.member_id = p_member_id
    union all
    select r.id, r.created_at, 'redeemed', r.amount_paise, null, t.name, s.full_name
    from public.bonus_redemption r
    join public.game_table t on t.id = r.table_id
    left join public.staff s on s.id = r.staff_id
    where r.member_id = p_member_id
    union all
    select c.id, c.created_at, 'redeemed', c.amount_paise, null, t.name, s.full_name
    from public.cage_transaction c
    left join public.seat_session ss on ss.id = c.session_id
    left join public.game_table t on t.id = ss.table_id
    left join public.staff s on s.id = c.cashier_staff_id
    where c.member_id = p_member_id and c.kind = 'buy_in' and c.method = 'bonus'
  ) h
  order by h.at desc, h.line_id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$$;

-- The signed-in member's bonus chips in force, in paise (1 chip is ₹1, @rivr/i18n formatChips).
create function private.my_bonus()
returns table (bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_in_force(m.id, now()) from public.member m where m.id = private.current_member_id();
$$;
create function public.my_bonus()
returns table (bonus_paise bigint) language sql stable security invoker set search_path = ''
as $$ select * from private.my_bonus(); $$;

-- The signed-in member's bonus history, newest first, up to p_limit lines. Who seated them is not shown to members.
create function private.my_bonus_history(p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.line_id, h.at, h.kind, h.amount_paise, h.reason, h.table_name from private.bonus_history(private.current_member_id(), p_limit) h
  where private.current_member_id() is not null;
$$;
create function public.my_bonus_history(p_limit integer default 20)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_bonus_history(p_limit); $$;

-- A member's bonus chips in force, in paise, for staff who open member records (the seat sheets and the record's Bonus
-- tab). Nothing for anyone else, or for a member of another venue.
create function private.member_bonus(p_venue_id uuid, p_member_id uuid)
returns table (bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_in_force(m.id, now()) from public.member m
  where m.id = p_member_id and m.venue_id = p_venue_id and coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$$;
create function public.member_bonus(p_venue_id uuid, p_member_id uuid)
returns table (bonus_paise bigint) language sql stable security invoker set search_path = ''
as $$ select * from private.member_bonus(p_venue_id, p_member_id); $$;

-- A member's bonus history, newest first, for staff who open member records.
create function private.member_bonus_history(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text, staff_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.* from private.bonus_history(p_member_id, p_limit) h
  where exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id)
    and coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$$;
create function public.member_bonus_history(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (line_id uuid, at timestamptz, kind text, amount_paise bigint, reason text, table_name text, staff_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_bonus_history(p_venue_id, p_member_id, p_limit); $$;

revoke execute on function private.redeem_bonus_at_seat(uuid, integer), private.bonus_history(uuid, integer) from public, anon, authenticated;
revoke execute on function private.seat_member(uuid, integer, text, bigint, integer, integer),
  public.seat_member(uuid, integer, text, bigint, integer, integer),
  private.assign_from_waitlist(uuid, uuid, integer, integer, integer), public.assign_from_waitlist(uuid, uuid, integer, integer, integer),
  private.my_bonus(), public.my_bonus(), private.my_bonus_history(integer), public.my_bonus_history(integer),
  private.member_bonus(uuid, uuid), public.member_bonus(uuid, uuid),
  private.member_bonus_history(uuid, uuid, integer), public.member_bonus_history(uuid, uuid, integer)
  from public, anon;
grant execute on function private.seat_member(uuid, integer, text, bigint, integer, integer),
  public.seat_member(uuid, integer, text, bigint, integer, integer),
  private.assign_from_waitlist(uuid, uuid, integer, integer, integer), public.assign_from_waitlist(uuid, uuid, integer, integer, integer),
  private.my_bonus(), public.my_bonus(), private.my_bonus_history(integer), public.my_bonus_history(integer),
  private.member_bonus(uuid, uuid), public.member_bonus(uuid, uuid),
  private.member_bonus_history(uuid, uuid, integer), public.member_bonus_history(uuid, uuid, integer)
  to authenticated;

-- Open screens hear a grant or a redemption at once (packages/db provider.tsx), each under its own row-level security.
alter publication supabase_realtime add table public.bonus_grant, public.bonus_redemption;

-- The Rewards tab's bonus chips and their push: core, never gated (packages/contracts/src/features.ts).
insert into public.feature (key, name, description, screens, is_gateable) values
  ('rewards.bonus', 'Bonus chips', 'The member’s bonus chips and their history, in Rewards.', '{player:rewards}', false),
  ('push.bonus', 'Bonus chip notifications', 'Push when bonus chips are added or used.', '{player:profile/notifications}', false);

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
