-- Bonus reversed, and a use added after the fact (#1077, the owner, 18 Nov). Generated from the live definitions by gen1077.py.
-- - A super admin reverses a Bonus given, with a reason: its whole amount comes back (less any part already expired, which
--   went back then), from what is left of it first, then from the member's other Bonus soonest to end first; what they
--   cannot give is owed, so the balance goes below nothing (private.bonus_takes, the twin of @rivr/domain bonusTake). The
--   ledger only adds: one transaction taking it back, once (its idempotency key).
-- - A super admin adds a Bonus use a seat missed, for any seat of the member's past its Undo: whole 50s, a reason, no visit
--   cap, counted on the seat's club day (bonus_redemption.used_at); beyond the balance it is owed.
-- - Bonus given while some is owed pays it first (private.bonus_pay_off, the twin of bonusPayOff); none is used at a buy-in
--   while any is owed. What members and staff see is the Bonus in force less what is owed (private.bonus_balance); what
--   draws, caps and expiry move is unchanged (private.bonus_in_force).
-- - The owner, 19 Nov: reports count a reversal on its own day, below nothing, and past days never change; a promotion's
--   Bonus reversed frees the promotion; members see no reason for a reversal or a use added; Bonus owed is written off as
--   the member is erased. Activity keeps both; each is a business event in the outbox. Members read neither reason: not in
--   their history, the ledger's memo or the columns they may select.

-- A grant reversed: when, by which transaction, why and by whom; all or none.
alter table public.bonus_grant
  add column reversed_at timestamptz,
  add column reversal_transaction_id uuid,
  add column reversal_reason text,
  add column reversed_by_staff_id uuid,
  add column reversal_paise bigint,
  add constraint bonus_grant_reversal_transaction_id_venue_id_fkey foreign key (reversal_transaction_id, venue_id)
    references public.ledger_transaction (id, venue_id),
  add constraint bonus_grant_reversed_by_staff_id_venue_id_fkey foreign key (reversed_by_staff_id, venue_id) references public.staff (id, venue_id),
  add constraint bonus_grant_reversal_check check ((reversed_at is null) = (reversal_transaction_id is null)
                                                   and (reversed_at is null) = (reversal_reason is null)
                                                   and (reversed_at is null) = (reversal_paise is null)),
  add constraint bonus_grant_reversal_paise_check check (reversal_paise is null or reversal_paise > 0),
  add constraint bonus_grant_reversal_reason_check check (reversal_reason is null or length(btrim(reversal_reason)) between 3 and 200);
comment on column public.bonus_grant.reversed_at is
  'When a super admin reversed this Bonus (#1077): reversal_transaction_id took back reversal_paise, which reports count on that day.';

-- A use added after the fact: why, and when it was used (the seat's start), which reports count it on. Null for a use as
-- it happened: then created_at is when.
alter table public.bonus_redemption
  add column reason text,
  add column used_at timestamptz,
  add constraint bonus_redemption_reason_check check (reason is null or length(btrim(reason)) between 3 and 200),
  add constraint bonus_redemption_added_check check ((reason is null) = (used_at is null));
comment on column public.bonus_redemption.used_at is
  'For a use added after the fact (#1077): when it was used, the seat''s start; null for one recorded as it happened (created_at).';

-- What a member owes of Bonus: added when a reversal or a use takes more than they held, paid off by Bonus given since.
-- Only ever added to: the sum is what is owed.
create table public.bonus_owed (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  kind text not null check (kind in ('reversal', 'use', 'paid', 'written_off')),
  amount_paise bigint not null check (amount_paise <> 0),
  bonus_grant_id uuid references public.bonus_grant (id),
  bonus_redemption_id uuid references public.bonus_redemption (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((kind in ('paid', 'written_off')) = (amount_paise < 0)),
  check (case kind when 'use' then bonus_redemption_id is not null and bonus_grant_id is null
                   when 'written_off' then bonus_redemption_id is null and bonus_grant_id is null
                   else bonus_grant_id is not null and bonus_redemption_id is null end)
);
comment on table public.bonus_owed is
  'Bonus a member owes (#1077): a reversal or a use beyond what they held adds; Bonus given since pays (paid), and an erasure writes it off (written_off), below nothing. Only added to.';
create index bonus_owed_member_id_idx on public.bonus_owed (member_id);
create index bonus_owed_venue_id_idx on public.bonus_owed (venue_id);
alter table public.bonus_owed enable row level security;
create policy "members see what they owe" on public.bonus_owed for select to authenticated
  using (member_id = (select private.current_member_id()));
create policy "the cage and ledger staff see what the venue's members owe" on public.bonus_owed for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')) or venue_id in (select private.venues_where('ledger.read')));
revoke all on public.bonus_owed from anon, authenticated;
grant select on public.bonus_owed to authenticated;
-- One row for each source: a grant reversed, a grant that paid, a use added.
create unique index bonus_owed_reversal_key on public.bonus_owed (bonus_grant_id) where kind = 'reversal';
create unique index bonus_owed_paid_key on public.bonus_owed (bonus_grant_id) where kind = 'paid';
create unique index bonus_owed_use_key on public.bonus_owed (bonus_redemption_id) where kind = 'use';
create unique index bonus_owed_written_off_key on public.bonus_owed (member_id) where kind = 'written_off';
-- Only added to: changed or removed by nothing but a venue's purge (private.refuse_change), as the audit log.
create trigger bonus_owed_append_only before update or delete on public.bonus_owed for each row execute function private.refuse_change();
create trigger bonus_owed_no_truncate before truncate on public.bonus_owed for each statement execute function private.refuse_change();
create trigger bonus_owed_touch_updated_at before update on public.bonus_owed for each row execute function private.touch_updated_at();
create trigger bonus_owed_audit after insert on public.bonus_owed for each row execute function private.audit_row_change();

-- Members never read why the club reversed their Bonus or added a use (the owner, 19 Nov), over the API or Realtime (which
-- sends only the columns a role may read): every other column, as before. A column added to either table later is granted
-- here too, or no one signed in reads it.
revoke select on public.bonus_grant from authenticated;
grant select (id, venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id,
              expired_at, expiry_transaction_id, created_at, updated_at, reversed_at, reversal_transaction_id, reversed_by_staff_id,
              reversal_paise)
  on public.bonus_grant to authenticated;
revoke select on public.bonus_redemption from authenticated;
grant select (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id, created_at, updated_at, used_at)
  on public.bonus_redemption to authenticated;

-- The member's data export carries all of it; the reasons as staff notes (decision 0240), since the member is not told them.
insert into private.member_export_column (table_name, column_name, kind)
select 'bonus_grant', c, 'owed' from unnest(array['reversed_at', 'reversal_transaction_id', 'reversed_by_staff_id', 'reversal_paise']) c
union all select 'bonus_grant', 'reversal_reason', 'note'
union all select 'bonus_redemption', 'used_at', 'owed'
union all select 'bonus_redemption', 'reason', 'note'
union all select 'bonus_owed', c, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'kind', 'amount_paise', 'bonus_grant_id', 'bonus_redemption_id', 'created_at', 'updated_at']) c;

-- A promotion's Bonus reversed frees the promotion (the owner, 19 Nov): its grant is 'reversed', which the limits, the
-- budget and MIS no longer count, as a refused one; the member may earn it again.
alter table public.promotion_grant drop constraint promotion_grant_status_check;
alter table public.promotion_grant add constraint promotion_grant_status_check check (status in ('waiting', 'given', 'refused', 'reversed'));
alter table public.promotion_grant drop constraint promotion_grant_waiting_is_unpaid_bonus;
alter table public.promotion_grant add constraint promotion_grant_waiting_is_unpaid_bonus
  check (status in ('given', 'reversed') or (bonus_grant_id is null and cost_paise > 0));

-- Bonus taken back: the twin of @rivr/domain bonusTake (packages/testing/golden/bonus.json). From the grant p_first (1 for
-- the first; null for a use) as far as it goes, whether or not it has ended, then the other grants in force soonest to end
-- first (the oldest first among equals), each as far as it goes; the rest is owed.
create function private.bonus_takes(p_amount_paise bigint, p_remaining bigint[], p_expires timestamptz[], p_at timestamptz, p_first integer)
returns table (taken bigint[], owed bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_taken bigint[] := array_fill(0::bigint, array[coalesce(array_length(p_remaining, 1), 0)]);
  v_left bigint := p_amount_paise;
  v_index integer;
begin
  if p_amount_paise is null or p_amount_paise < 0 then
    raise exception 'Bonus taken back is never below nothing' using errcode = '22023';
  end if;
  if p_first is not null and (p_first < 1 or p_first > coalesce(array_length(p_remaining, 1), 0)) then
    raise exception 'No grant % to take back from', p_first using errcode = '22023';
  end if;
  for v_index in
    select u.n from unnest(p_remaining, p_expires) with ordinality as u (remaining, expires, n)
    where u.n = p_first or (u.remaining > 0 and (u.expires is null or u.expires > p_at))
    order by u.n is not distinct from p_first desc, u.expires nulls last, u.n
  loop
    v_taken[v_index] := least(v_left, p_remaining[v_index]);
    v_left := v_left - v_taken[v_index];
  end loop;
  return query select v_taken, v_left;
end;
$$;

-- Bonus given while some is owed: the twin of @rivr/domain bonusPayOff. It pays what is owed first; the member keeps the rest.
create function private.bonus_pay_off(p_given_paise bigint, p_owed_paise bigint)
returns table (paid bigint, kept bigint)
language sql
immutable
set search_path = ''
as $$
  select x.paid, p_given_paise - x.paid from (select greatest(0::bigint, least(p_given_paise, coalesce(p_owed_paise, 0))) as paid) x;
$$;

-- What a member owes of Bonus, nothing when nothing.
create function private.bonus_owed_by(p_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(o.amount_paise), 0)::bigint from public.bonus_owed o where o.member_id = p_member_id;
$$;

-- The balance members and staff see: the Bonus in force less what is owed, below nothing while more is owed.
create function private.bonus_balance(p_member_id uuid, p_at timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_in_force(p_member_id, p_at) - private.bonus_owed_by(p_member_id);
$$;
revoke all on function private.bonus_takes(bigint, bigint[], timestamptz[], timestamptz, integer), private.bonus_pay_off(bigint, bigint),
  private.bonus_owed_by(uuid), private.bonus_balance(uuid, timestamptz) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.credit_bonus(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_reason text, p_expires_at timestamp with time zone, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_replay public.bonus_grant;
  v_txn uuid;
  v_id uuid;
  v_expires_at timestamptz := p_expires_at;
  v_paid bigint;
  v_kept bigint;
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
  -- One member's Bonus changes wait for each other (#1077): what is owed is read once, by one of them.
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
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
  -- What is owed is paid first (#1077, private.bonus_pay_off); the member keeps the rest to use. The ledger takes the whole.
  select o.paid, o.kept into v_paid, v_kept from private.bonus_pay_off(p_amount_paise, private.bonus_owed_by(p_member_id)) o;
  insert into public.bonus_grant (venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id)
  values (p_venue_id, p_member_id, p_amount_paise, v_kept, v_expires_at, btrim(p_reason), p_idempotency_key, v_txn)
  returning id into v_id;
  if v_paid > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_grant_id) values (p_venue_id, p_member_id, 'paid', -v_paid, v_id);
  end if;
  -- The member's app shows a toast and the push consumer sends a push (push.bonus).
  perform private.emit(p_venue_id, 'bonus.credited',
                       jsonb_build_object('bonus_grant_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise, 'reason', btrim(p_reason)),
                       'bonus.credited:' || v_id);
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.draw_bonus(p_member_id uuid, p_amount_paise bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_result text;
  v_taken bigint[];
  v_left bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
  -- No Bonus is used at a buy-in while any is owed (#1077): new Bonus pays it first.
  if private.bonus_owed_by(p_member_id) > 0 then
    raise exception 'Bonus is owed: none to use until new Bonus pays it' using errcode = 'RVBON';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
        from public.bonus_grant g where g.member_id = p_member_id and g.expired_at is null for update) g;
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
$function$;

-- A super admin reverses a Bonus given (the owner, 18 Nov): the whole of it, less what already expired, even if part was
-- spent; never on their own record; once. Refused with nothing left to take back. Gives what it took back; nothing when
-- asked again.
create function private.reverse_bonus(p_grant_id uuid, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.bonus_grant;
  v_expired bigint;
  v_amount bigint;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_taken bigint[];
  v_owed bigint;
  v_txn uuid;
begin
  select * into v_grant from public.bonus_grant g where g.id = p_grant_id;
  if v_grant.id is null or not private.is_super_admin(v_grant.venue_id) then
    raise exception 'Only super admins reverse Bonus' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_grant.member_id) or coalesce(private.is_own_kyc_check(v_grant.member_id), false) then
    raise exception 'Staff never reverse Bonus on their own record' using errcode = 'RVOWN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 200
     or exists (select 1 from public.member m where m.id = v_grant.member_id and m.erased_at is not null) then
    raise exception 'A reason of 3 to 200 characters, for a member still here' using errcode = '22023';
  end if;
  perform private.assert_writable(v_grant.venue_id, 'promotions', v_grant.member_id);
  perform private.assert_rate(v_grant.venue_id, 'bonus.reverse');
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_grant.member_id::text, 0));
  -- An erasure that came first has closed the record; one that comes later waits for this.
  perform 1 from public.member m where m.id = v_grant.member_id and m.erased_at is null for share;
  if not found then
    raise exception 'The member was erased' using errcode = '22023';
  end if;
  select * into v_grant from public.bonus_grant g where g.id = p_grant_id for update;
  -- Once: asked again, it is done.
  if v_grant.reversed_at is not null then
    return null;
  end if;
  -- What expired of it went back then; the rest comes back now.
  v_expired := coalesce((select e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
                         where e.transaction_id = v_grant.expiry_transaction_id), 0);
  v_amount := v_grant.amount_paise - v_expired;
  if v_amount <= 0 then
    raise exception 'Nothing of it left to take back: it expired' using errcode = 'RVNIL';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (    select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_grant.member_id and g.expired_at is null for update) g;
  select t.taken, t.owed into v_taken, v_owed
  from private.bonus_takes(v_amount, v_remaining, v_expires, now(), array_position(v_ids, v_grant.id)) t;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
  v_txn := private.post_ledger_transaction(v_grant.venue_id, 'bonus_reversal', 'bonus_reversal:' || v_grant.id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_grant.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_grant.venue_id
                                         and a.code = 'venue.bonus_expense' and a.member_id is null), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus reversed');
  update public.bonus_grant
  set reversed_at = now(), reversal_transaction_id = v_txn, reversal_reason = btrim(p_reason), reversal_paise = v_amount,
      reversed_by_staff_id = private.current_staff_id(v_grant.venue_id)
  where id = v_grant.id;
  -- A promotion's Bonus reversed frees the promotion (the owner, 19 Nov): its limits, its budget and MIS no longer count it.
  update public.promotion_grant set status = 'reversed' where bonus_grant_id = v_grant.id and status = 'given';
  if v_owed > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_grant_id)
    values (v_grant.venue_id, v_grant.member_id, 'reversal', v_owed, v_grant.id);
  end if;
  perform private.audit(v_grant.venue_id, 'bonus.reverse', 'member', v_grant.member_id::text, null,
                        jsonb_build_object('bonus_grant_id', v_grant.id, 'chips', v_amount / 100, 'owed_chips', v_owed / 100), btrim(p_reason));
  perform private.emit(v_grant.venue_id, 'bonus.reversed',
                       jsonb_build_object('bonus_grant_id', v_grant.id, 'member_id', v_grant.member_id, 'amount_paise', v_amount, 'owed_paise', v_owed),
                       'bonus.reversed:' || v_grant.id);
  return v_amount;
end;
$$;
create function public.reverse_bonus(p_grant_id uuid, p_reason text)
returns bigint
language sql
set search_path = ''
as $$ select private.reverse_bonus(p_grant_id, p_reason); $$;
revoke all on function private.reverse_bonus(uuid, text) from public, anon;
grant execute on function private.reverse_bonus(uuid, text) to authenticated;
revoke all on function public.reverse_bonus(uuid, text) from public, anon;
grant execute on function public.reverse_bonus(uuid, text) to authenticated;

-- The seats a missed Bonus use may be added to (#1077): any of the member's, from any visit (the owner, 19 Nov), past its
-- Undo, the newest first; for super admins alone.
create function private.bonus_use_seats(p_venue_id uuid, p_member_id uuid)
returns table (session_id uuid, table_name text, seat integer, started_at timestamptz, ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, t.name, s.seat, s.started_at, s.ended_at
  from public.visit v
  join public.seat_session s on s.visit_id = v.id
  join public.game_table t on t.id = s.table_id
  where v.member_id = p_member_id and v.venue_id = p_venue_id and (select private.is_super_admin(p_venue_id))
    and not private.is_undoable(s.started_at)
  order by s.started_at desc, s.id;
$$;
-- The console reads the newest p_limit (1 to 500), and more as Show earlier asks, as a member's Bonus history.
create function public.bonus_use_seats(p_venue_id uuid, p_member_id uuid, p_limit integer default 10)
returns table (session_id uuid, table_name text, seat integer, started_at timestamptz, ended_at timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.bonus_use_seats(p_venue_id, p_member_id) limit greatest(least(coalesce(p_limit, 10), 500), 1); $$;
revoke all on function private.bonus_use_seats(uuid, uuid) from public, anon;
grant execute on function private.bonus_use_seats(uuid, uuid) to authenticated;
revoke all on function public.bonus_use_seats(uuid, uuid, integer) from public, anon;
grant execute on function public.bonus_use_seats(uuid, uuid, integer) to authenticated;

-- A super admin adds a Bonus use a seat missed (the owner, 18 Nov): whole 50s, a reason, no visit cap, on the seat's own
-- time; beyond the balance it is owed. Never on their own record; once for each request id.
create function private.add_bonus_use(p_session_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_amount bigint := p_chips::bigint * 100;
  v_replay public.bonus_redemption;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_taken bigint[];
  v_owed bigint;
  v_txn uuid;
  v_table_name text;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id;
  if v_session.id is null or not private.is_super_admin(v_session.venue_id) then
    raise exception 'Only super admins add a missed Bonus use' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) or coalesce(private.is_own_kyc_check(v_session.member_id), false) then
    raise exception 'Staff never add a Bonus use to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, 'promotions', v_session.member_id);
  perform private.assert_rate(v_session.venue_id, 'bonus.use_add');
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_session.member_id::text, 0));
  -- Under the member's lock, so the same request at once is answered as one, and an erasure is seen.
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is not null then
    if v_replay.session_id <> p_session_id or v_replay.amount_paise <> v_amount then
      raise exception 'That request id was used for another Bonus use' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  perform 1 from public.member m where m.id = v_session.member_id and m.erased_at is null for share;
  if not found or not exists (select 1 from private.bonus_use_seats(v_session.venue_id, v_session.member_id) u where u.session_id = p_session_id) then
    raise exception 'A seat of the member''s, past its Undo' using errcode = '22023';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (    select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_session.member_id and g.expired_at is null for update) g;
  select t.taken, t.owed into v_taken, v_owed from private.bonus_takes(v_amount, v_remaining, v_expires, now(), null) t;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
  v_txn := private.post_ledger_transaction(v_session.venue_id, 'bonus_buy_in', 'bonus_buy_in:' || p_request_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_session.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_session.venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus use added');
  insert into public.bonus_redemption (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id, reason, used_at)
  values (p_request_id, v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_amount, v_txn,
          private.current_staff_id(v_session.venue_id), btrim(p_reason), v_session.started_at);
  if v_owed > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_redemption_id)
    values (v_session.venue_id, v_session.member_id, 'use', v_owed, p_request_id);
  end if;
  select t.name into v_table_name from public.game_table t where t.id = v_session.table_id;
  perform private.audit(v_session.venue_id, 'bonus.use_add', 'member', v_session.member_id::text, null,
                        jsonb_build_object('chips', p_chips, 'bonus_redemption_id', p_request_id, 'session_id', p_session_id,
                                           'table_name', v_table_name, 'owed_chips', v_owed / 100), btrim(p_reason));
  perform private.emit(v_session.venue_id, 'bonus.use_added',
                       jsonb_build_object('bonus_redemption_id', p_request_id, 'member_id', v_session.member_id, 'amount_paise', v_amount,
                                          'session_id', p_session_id, 'owed_paise', v_owed),
                       'bonus.use_added:' || p_request_id);
  return p_request_id;
end;
$$;
create function public.add_bonus_use(p_session_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language sql
set search_path = ''
as $$ select private.add_bonus_use(p_session_id, p_chips, p_reason, p_request_id); $$;
revoke all on function private.add_bonus_use(uuid, integer, text, uuid) from public, anon;
grant execute on function private.add_bonus_use(uuid, integer, text, uuid) to authenticated;
revoke all on function public.add_bonus_use(uuid, integer, text, uuid) from public, anon;
grant execute on function public.add_bonus_use(uuid, integer, text, uuid) to authenticated;

-- What members and staff read: the balance below nothing while some is owed; a reversal in the history (no reason for the
-- member); reports with a reversal on its own day.
CREATE OR REPLACE FUNCTION private.my_bonus()
 RETURNS TABLE(bonus_paise bigint, expiry_days integer, bonus_line text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.bonus_balance(m.id, now()), (select e.days from private.bonus_expiry(m.venue_id) e),
         (select c.bonus_line from public.venue_config c where c.venue_id = m.venue_id)
  from public.member m
  where m.id = private.current_member_id();
$function$;

CREATE OR REPLACE FUNCTION private.member_bonus(p_venue_id uuid, p_member_id uuid)
 RETURNS TABLE(bonus_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.bonus_balance(m.id, now()) from public.member m
  where m.id = p_member_id and m.venue_id = p_venue_id and coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$function$;

CREATE OR REPLACE FUNCTION private.members_column_sql(p_key text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_key
    when 'name' then 'm.full_name'
    when 'number' then 'm.member_number'
    when 'mobile' then 'm.phone'
    when 'tier' then '(select t.name from public.tier t where t.id = m.tier_id)'
    when 'status' then 'coalesce(st.status, ''active'')'
    -- As private.members_of_tier words it: verified only once the check is complete, by the rule private.is_kyc_complete
    -- holds (a photo, and of age by the venue's day), written here over the record itself, as a call for each of
    -- fifty thousand members takes seconds. The venue's time zone and its least age are read once. $1 is the venue.
    when 'kyc' then '(select case when k.status = ''verified'' then
                                    case when k.photo_path is not null
                                              and k.date_of_birth <= (now() at time zone (select v.time_zone from public.venue v where v.id = $1))::date
                                                                     - make_interval(years => (select private.kyc_minimum_age($1)))
                                         then ''verified'' else ''not_done'' end
                                  when k.status = ''needs_review'' then ''in_review'' when k.status = ''refused'' then ''refused''
                                  when k.status = ''started'' and k.at_club_from is not null then ''at_desk'' else ''not_done'' end
                     from (select 1) one left join public.kyc_record k on k.member_id = m.id)'
    -- Counted hours, in minutes: from the moment a reset set (20261118100300).
    when 'played' then '(select coalesce(sum(private.counted_minutes(s, now(), coalesce(m.hours_counted_from, ''-infinity''::timestamptz))), 0)::bigint
                         from public.seat_session s where s.member_id = m.id)'
    when 'city' then '(select pr.city from public.member_preference pr where pr.member_id = m.id)'
    when 'since' then 'm.created_at'
    when 'tonight' then 'coalesce(tn.kind, ''not_here'')'
    when 'visits' then '(select count(*)::integer from public.visit v where v.member_id = m.id)'
    when 'bonus' then 'private.bonus_balance(m.id, now())'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.bonus_history(p_member_id uuid, p_limit integer)
 RETURNS TABLE(line_id uuid, at timestamp with time zone, kind text, amount_paise bigint, reason text, table_name text, staff_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select r.id, coalesce(r.used_at, r.created_at), 'redeemed', r.amount_paise, r.reason, t.name, s.full_name
    from public.bonus_redemption r
    join public.game_table t on t.id = r.table_id
    left join public.staff s on s.id = r.staff_id
    where r.member_id = p_member_id
    union all
    -- A Bonus reversed (#1077): what came back, under the grant's id as an expiry's line, with the reason and who reversed it.
    select g.id, g.reversed_at, 'reversed', e.amount, g.reversal_reason, null, rs.full_name
    from public.bonus_grant g
    join public.ledger_entry e on e.transaction_id = g.reversal_transaction_id
    join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
    left join public.staff rs on rs.id = g.reversed_by_staff_id
    where g.member_id = p_member_id and g.reversed_at is not null
  ) h
  order by h.at desc, h.line_id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$function$;

CREATE OR REPLACE FUNCTION private.my_bonus_history(p_limit integer)
 RETURNS TABLE(line_id uuid, at timestamp with time zone, kind text, amount_paise bigint, reason text, table_name text, hand text, rank text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- No reason the club gave for a reversal or a use added (the owner, 19 Nov): staff see them on the record.
  select h.line_id, h.at, h.kind, h.amount_paise, case when h.kind in ('reversed', 'redeemed') then null else h.reason end,
         h.table_name, hit.hand, hit.rank
  from private.bonus_history(private.current_member_id(), p_limit) h
  -- A grant's id is its line's, given or expired; only the line that gave it names the hand.
  left join public.high_hand_hit hit on hit.bonus_grant_id = h.line_id and h.kind = 'credited'
  where private.current_member_id() is not null
  order by h.at desc, h.line_id;
$function$;

CREATE OR REPLACE FUNCTION private.report_figures(p_venue_id uuid, p_report text, p_from date, p_to date)
 RETURNS TABLE(figure text, amount bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  select s.from_at, s.to_at into v_from, v_to from private.report_span(p_from, p_to) s;
  if p_report = 'players' then
    return query
    select f.figure, f.amount::bigint from (values
      ('check_ins', (select count(*) from public.visit v where v.venue_id = p_venue_id and v.opened_at >= v_from and v.opened_at < v_to)),
      ('played', (select count(distinct st.member_id) from private.table_stints(p_venue_id, p_from, p_to) st)),
      ('new_members', (select count(*) from public.member m where m.venue_id = p_venue_id and m.created_at >= v_from and m.created_at < v_to)),
      ('session_seconds', (select coalesce(avg(greatest(0, extract(epoch from (coalesce(ss.ended_at, now()) - ss.started_at)) - ss.away_seconds)), 0)::bigint
                           from public.seat_session ss where ss.venue_id = p_venue_id and ss.started_at >= v_from and ss.started_at < v_to))
    ) as f(figure, amount);
  elsif p_report = 'waitlist' then
    return query
    select f.figure, f.amount::bigint
    from (select count(*) as joined, count(*) filter (where w.got_seat) as seated,
                 coalesce(avg(w.waited) filter (where w.got_seat), 0)::bigint as wait, coalesce(max(w.waited) filter (where w.got_seat), 0)::bigint as longest
          from private.waitlist_joins(p_venue_id, p_from, p_to) w) t
    cross join lateral (values ('joined', t.joined), ('seated', t.seated), ('wait_seconds', t.wait), ('longest_seconds', t.longest)) as f(figure, amount);
  elsif p_report = 'fnb' then
    return query
    select f.figure, f.amount::bigint
    from (select count(*) as orders, coalesce(sum(o.items) filter (where not o.is_void), 0) as items,
                 coalesce(avg(o.accept_seconds), 0)::bigint as accept, coalesce(avg(o.serve_seconds), 0)::bigint as serve
          from private.fnb_orders_over(p_venue_id, p_from, p_to) o) t
    cross join lateral (values ('orders', t.orders), ('items', t.items), ('accept_seconds', t.accept), ('serve_seconds', t.serve)) as f(figure, amount);
  elsif p_report = 'bonus' then
    return query
    select f.figure, f.amount::bigint from (values
      ('given', (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                 where g.venue_id = p_venue_id and g.created_at >= v_from and g.created_at < v_to)
                - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                   where g.venue_id = p_venue_id and g.reversed_at >= v_from and g.reversed_at < v_to)),
      ('by_hand', (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                   where g.venue_id = p_venue_id and g.created_at >= v_from and g.created_at < v_to and g.idempotency_key like 'bonus.hand:%')
                  - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                   where g.venue_id = p_venue_id and g.reversed_at >= v_from and g.reversed_at < v_to and g.idempotency_key like 'bonus.hand:%')),
      ('used', (select coalesce(sum(r.amount_paise), 0) from public.bonus_redemption r
                where r.venue_id = p_venue_id and coalesce(r.used_at, r.created_at) >= v_from and coalesce(r.used_at, r.created_at) < v_to)),
      ('outstanding', (select coalesce(sum(g.remaining_paise), 0) from public.bonus_grant g where g.venue_id = p_venue_id and g.expired_at is null)
                      - (select coalesce(sum(o.amount_paise), 0) from public.bonus_owed o where o.venue_id = p_venue_id))
    ) as f(figure, amount);
  else
    raise exception 'No such report' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.report_chart(p_venue_id uuid, p_report text, p_from date, p_to date)
 RETURNS TABLE(bucket timestamp with time zone, amount bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  if p_report is null or p_report not in ('tables', 'players', 'waitlist', 'fnb', 'bonus') then
    raise exception 'No such report' using errcode = '22023';
  end if;
  return query
  with span as materialized (
    select s.from_at, s.to_at from private.report_span(p_from, p_to) s
  ),
  seated as materialized (
    select st.member_id, st.from_at, st.to_at from private.table_stints(p_venue_id, p_from, p_to) st where p_report = 'tables'
  ),
  events as materialized (
    select v.opened_at as at, 1::bigint as amount from public.visit v, span s
    where p_report = 'players' and v.venue_id = p_venue_id and v.opened_at >= s.from_at and v.opened_at < s.to_at
    union all
    select w.joined_at, 1 from public.waitlist_entry w, span s
    where p_report = 'waitlist' and w.venue_id = p_venue_id and w.joined_at >= s.from_at and w.joined_at < s.to_at and w.left_reason is distinct from 'declined'
    union all
    select o.created_at, 1 from public.fnb_order o
    where p_report = 'fnb' and o.venue_id = p_venue_id and o.club_day between p_from and p_to
    union all
    select g.created_at, g.amount_paise from public.bonus_grant g, span s
    where p_report = 'bonus' and g.venue_id = p_venue_id and g.created_at >= s.from_at and g.created_at < s.to_at
    union all
    -- A reversal on its own day, below nothing (the owner, 19 Nov).
    select g.reversed_at, -g.reversal_paise from public.bonus_grant g, span s
    where p_report = 'bonus' and g.venue_id = p_venue_id and g.reversed_at >= s.from_at and g.reversed_at < s.to_at
  )
  select b.from_at,
         (case when p_report = 'tables'
               then (select count(distinct se.member_id) from seated se where se.from_at < b.to_at and se.to_at > b.from_at)
               else coalesce((select sum(e.amount) from events e where e.at >= b.from_at and e.at < b.to_at), 0) end)::bigint
  from private.report_buckets(p_from, p_to) b
  order by b.from_at;
end;
$function$;

CREATE OR REPLACE FUNCTION private.bonus_report(p_venue_id uuid, p_from date, p_to date)
 RETURNS TABLE(source text, label text, members bigint, grants bigint, given_paise bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.assert_table_span(p_venue_id, p_from, p_to);
  return query
  with given as (
    -- Each grant on the day it was given, and what a reversal took back of it on its own day, below nothing, on a line of
    -- its own (the owner, 19 Nov), as the Bonus given list names it.
    select g.member_id, e.amount_paise,
           case when not e.is_given then 'reversed' when p.id is not null then 'promotion' when g.idempotency_key like 'bonus.hand:%' then 'hand'
                else 'other' end as source,
           case when not e.is_given then null when p.id is not null then p.name when g.idempotency_key like 'bonus.hand:%' then null
                else g.reason end as label
    from public.bonus_grant g cross join private.report_span(p_from, p_to) s
    cross join lateral (values (g.amount_paise, true, g.created_at), (-g.reversal_paise, false, g.reversed_at)) as e (amount_paise, is_given, at)
    left join public.promotion_grant pg on pg.bonus_grant_id = g.id
    left join public.promotion p on p.id = pg.promotion_id
    where g.venue_id = p_venue_id and e.at >= s.from_at and e.at < s.to_at
  )
  select gv.source, gv.label, count(distinct gv.member_id)::bigint, count(*)::bigint, sum(gv.amount_paise)::bigint
  from given gv
  group by gv.source, gv.label
  order by sum(gv.amount_paise) desc, gv.source, gv.label
  limit 200;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_spec(p_list text, OUT o_source text, OUT o_columns jsonb, OUT o_search text[], OUT o_order text, OUT o_choices text[])
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select s.source, s.columns, s.search, s.sorted, s.choices
  from (values
    -- Open Feedback tickets (F-013), as private.open_feedback gives them, oldest first.
    ('feedback_open',
     $src$
       select f.id, m.id as member_id, m.full_name, m.member_number, v.closed_at as visit_closed_at, f.score, f.note, f.created_at, f.topic, f.ratings, f.nps,
              (select string_agg(distinct g.name, ', ' order by g.name)
               from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = f.visit_id) as tables,
              (select extract(epoch from min(s.started_at) - v.opened_at)::integer from public.seat_session s where s.visit_id = f.visit_id) as wait_seconds
       from public.feedback f
       join public.member m on m.id = f.member_id
       left join public.visit v on v.id = f.visit_id
       where f.venue_id = $1 and f.is_ticket and f.resolved_at is null and (select private.has_permission($1, 'feedback.manage'))
     $src$,
     '{"member": "full_name", "age": "extract(epoch from now() - created_at) / 3600.0", "rating": "coalesce(score, 0)", "visit": "tables", "note": "note"}'::jsonb,
     array['full_name', 'note', 'topic'], 'created_at, id', array['rating']),
    -- The ID checks' queue, as private.kyc_review_queue gives it: those to review first, then the unfinished and the
    -- refused of the last 90 days.
    ('kyc_review',
     $src$
       select k.member_id, m.full_name, k.status, k.method,
              case
                when k.status <> 'needs_review' then null
                when k.pan_recheck in ('pan_invalid', 'name_differs', 'date_of_birth_differs') then 'recheck_' || k.pan_recheck
                when k.method = 'pan' then 'pan_alone'
                when k.date_of_birth is null and k.pan is null and k.aadhaar_reference is null then 'nothing_kept'
                when k.date_of_birth is null then 'no_date_of_birth'
                when private.kyc_clashes(k.member_id) then 'clash'
              end as waiting_because,
              k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score, k.vendor_reference, k.refusal,
              array(select om.full_name from public.kyc_record o join public.member om on om.id = o.member_id
                    where private.kyc_records_clash(k, o) order by om.full_name) as clashes_with,
              k.updated_at
       from public.kyc_record k join public.member m on m.id = k.member_id
       where k.venue_id = $1 and k.status in ('needs_review', 'needs_pan', 'refused')
         and (k.status = 'needs_review' or k.updated_at > now() - interval '90 days')
         and (select private.has_permission($1, 'kyc.review'))
     $src$,
     '{"name": "full_name", "status": "status"}'::jsonb,
     array['full_name'], '(status = ''needs_review'') desc, updated_at, member_id', array['status']),
    -- A club day's orders, as private.fnb_orders_tonight gives tonight's: the day and the state are the screen's choice
    -- (today, and the orders still open, unless the view says otherwise). Open orders come oldest first; the rest newest.
    ('fnb_orders',
     $src$
       select listed.* from (
         select o.id as order_id, o.kot_number, g.name as table_name, o.seat, m.full_name as member_name, m.member_number, o.lines, o.is_comp, o.source,
                o.created_at, o.kot_sent_at, o.kot_sent_by, o.accepted_at, o.delivered_at,
                floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer as age_seconds,
                o.cancelled_at, o.cancel_reason, o.on_way_at,
                o.kot_sent_at is null and o.cancelled_at is null and o.accepted_at is null and o.delivered_at is null and exists (
                  select 1 from public.outbox_event e
                  join public.outbox_delivery d on d.event_id = e.id and d.venue_id = e.venue_id and d.consumer = 'bar_printer'
                  where e.venue_id = o.venue_id and e.event_type = 'fnb.ordered' and e.idempotency_key = 'fnb.ordered:' || o.id
                    and (d.status = 'failed' or d.status = 'delivered')) as kot_print_failed,
                coalesce((select case when s.leaving_at is null then 'seated' else 'leaving' end
                          from public.seat_session s
                          where s.venue_id = o.venue_id and s.member_id = o.member_id and s.ended_at is null), 'left') as seat_state,
                case when o.cancelled_at is not null then 'void' when o.delivered_at is not null then 'delivered'
                     when o.accepted_at is null then 'to_accept' else 'preparing' end as state
         from public.fnb_order o
         join public.game_table g on g.id = o.table_id
         join public.member m on m.id = o.member_id
         where o.venue_id = $1 and o.club_day = coalesce(nullif($2 #>> '{scope,day}', '')::date, private.club_day_now())
           and (select private.may_serve_fnb($1))) listed
       where case coalesce($2 #>> '{scope,state}', 'open') when 'open' then listed.state in ('to_accept', 'preparing')
                                                            when 'all' then true else listed.state = $2 #>> '{scope,state}' end
     $src$,
     '{"kot": "kot_number", "table": "table_name", "member": "member_name", "age": "age_seconds / 3600.0", "state": "state"}'::jsonb,
     array['member_name', 'table_name', 'kot_number', 'lines'],
     'case when state in (''to_accept'', ''preparing'') then created_at end, created_at desc, kot_number desc', array['state', 'table']),
    -- Everyone at the door today (#641, #72): today's players, each with their tier, their ID check and which of the
    -- door's lists they are on. In the club with a visit open; expected while on a waitlist and not yet in.
    -- KYC_STATUS stands for the ID check's words as the Members list has them (private.members_column_sql).
    ('door',
     replace($src$
       select listed.* from (
         select tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
                t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
                case when tp.status = 'waiting' and ov.id is null then 'expected' else tp.status end as status,
                case when ov.id is not null or tp.status = 'playing' then 'in_club' when tp.status = 'waiting' then 'expected'
                     when tp.status = 'left' then 'left' else 'not_arrived' end as list,
                tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables,
                coalesce((select sum((x ->> 'seconds')::bigint) from jsonb_array_elements(tp.tables) x), 0)::bigint as played_seconds,
                (select string_agg(x ->> 'table', ', ') from jsonb_array_elements(tp.tables) x) as table_names,
                KYC_STATUS as kyc_status,
                coalesce(ov.opened_at, (select min(e.joined_at) from public.waitlist_entry e where e.member_id = tp.member_id and e.status = 'waiting')) as since,
                (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
                 where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = private.club_day_now())::bigint
                 - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                    where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.reversed_at) = private.club_day_now())::bigint as bonus_paise,
                -- The member's mobile for floor and up (#1073, members.phone); none for anyone else.
                case when (select private.has_permission($1, 'members.phone')) then m.phone end as phone
         from private.todays_players($1) tp
         join public.member m on m.id = tp.member_id
         join public.tier t on t.id = m.tier_id
         left join public.visit ov on ov.member_id = tp.member_id and ov.closed_at is null) listed
       where coalesce($2 #>> '{scope,list}', 'all') in ('all', listed.list)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"player": "full_name", "number": "member_number", "tier": "tier_name", "status": "status", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "list": "list", "arrived": "(checked_in_at is not null)", "bonus": "bonus_paise / 100",
       "status:sort": "array_position(array[''waiting'', ''expected'', ''playing'', ''in_room'', ''left'', ''never_arrived''], status)"}'::jsonb,
     array['full_name', 'member_number'], 'full_name, member_id', array['status', 'tier', 'kyc', 'list', 'arrived']),
    -- The Waitlist as one list (redesign RD-31; the owner, 15 Nov): every place on every table's list, as
    -- private.waitlist_board gives them, each with its table. Each table keeps its own list and its own order: the
    -- places come table by table, in place order. The screen may ask for one table's list alone.
    ('waitlist',
     $src$
       select b.entry_id, b.table_type_id, b.member_id, b.full_name, b.joined_at, b.place, b.added_by_floor, b.priority_reason, b.call_table_name,
              b.call_seat, b.hold_until, b.away_until, b.asked_table_id, b.on_way_at, b.needs_id_check, g.name as table_name, g.position as table_position
       from private.waitlist_board($1) b
       join public.game_table g on g.id = b.asked_table_id
       where coalesce(nullif($2 #>> '{scope,table}', '')::uuid, b.asked_table_id) = b.asked_table_id
     $src$,
     '{"player": "full_name", "table": "table_name", "place": "place", "waited": "extract(epoch from now() - joined_at) / 3600.0"}'::jsonb,
     array['full_name'], 'table_position, table_name, place', array['table']),
    -- Bonus a promotion calculated, waiting for a super admin (decision 0670), the oldest first. A super admin's own
    -- record's are not theirs to decide, so not listed; nor an erased member's.
    ('bonus_waiting',
     $src$
       select g.id as grant_id, g.member_id, m.full_name, m.member_number, g.promotion_id, coalesce(v.name, p.name) as promotion_name,
              g.cost_paise as amount_paise, g.trigger, coalesce((g.event ->> 'at')::timestamptz, g.created_at) as event_at,
              (g.event ->> 'stepMinutes')::integer as step_minutes, t.name as table_name, g.club_day,
              sess.visit_id, sess.sessions, sess.seated_at, sess.left_at, sess.away_seconds, sess.played_seconds, sess.visit_opened_at, sess.visit_closed_at
       from public.promotion_grant g
       join public.member m on m.id = g.member_id and m.erased_at is null
       join public.promotion p on p.id = g.promotion_id
       left join public.promotion_version v on v.id = g.promotion_version_id
       left join public.game_table t on t.id = g.table_id
       -- A play-time step's visit (#1061): its seats, when they sat and left, time away and time played, for the correction.
       left join lateral (
         select vi.id as visit_id, vi.opened_at as visit_opened_at, vi.closed_at as visit_closed_at,
                jsonb_agg(jsonb_build_object('id', s.id, 'table', st.name, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                                             'awaySeconds', a.away) order by s.started_at) as sessions,
                min(s.started_at) as seated_at,
                case when bool_and(s.ended_at is not null) then max(s.ended_at) end as left_at,
                sum(a.away)::bigint as away_seconds,
                sum(greatest(0, floor(extract(epoch from coalesce(s.ended_at, now()) - s.started_at)) - a.away))::bigint as played_seconds
         from public.visit vi
         join public.seat_session s on s.visit_id = vi.id
         join public.game_table st on st.id = s.table_id
         -- Time away with any still running: a player away now is away until they come back.
         cross join lateral (select s.away_seconds + coalesce(floor(extract(epoch from now() - s.away_since))::integer, 0) as away) a
         where vi.venue_id = g.venue_id
           and vi.id = case when g.trigger = 'hours_step' and split_part(g.source_key, ':', 2) ~ '^[0-9a-f-]{36}$'
                            then split_part(g.source_key, ':', 2)::uuid end
         group by vi.id) sess on true
       where g.venue_id = $1 and g.status = 'waiting' and (select private.is_super_admin($1))
         and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false)
     $src$,
     '{"member": "full_name", "number": "member_number", "promotion": "promotion_name", "amount": "amount_paise / 100", "why": "trigger",
       "when": "club_day", "when:sort": "event_at"}'::jsonb,
     array['full_name', 'member_number', 'promotion_name'], 'event_at, full_name, grant_id', array['promotion', 'why']),
    -- Bonus given in a report's span (#1063, the owner, 17 Nov): each grant, newest first, with where it came from and who
    -- gave it: by hand, the staff member; a promotion, its name and the super admin who approved it; a high hand, who
    -- logged it; anything else, its reason alone. For staff who read reports; never the practice venue. The span is the
    -- screen's own choice, scope from and to as whole dates (YYYY-MM-DD), 92 club days at most counted from `from`.
    ('bonus_given',
     $src$
       select g.id as grant_id, g.created_at as given_at, m.id as member_id, m.full_name, m.member_number, g.amount_paise, g.reason,
              case when h.id is not null then 'high_hand' when pg.id is not null then 'promotion'
                   when g.idempotency_key like 'bonus.hand:%' then 'by_hand' else 'other' end as source,
              coalesce(pv.name, p.name) as promotion_name,
              coalesce(hs.full_name, ds.full_name, case when g.idempotency_key like 'bonus.hand:%' then gs.full_name end) as staff_name
       from public.bonus_grant g
       join public.member m on m.id = g.member_id
       left join public.high_hand_hit h on h.bonus_grant_id = g.id
       left join public.staff hs on hs.id = h.logged_by_staff_id
       left join public.promotion_grant pg on pg.bonus_grant_id = g.id
       left join public.promotion p on p.id = pg.promotion_id
       left join public.promotion_version pv on pv.id = pg.promotion_version_id
       left join public.promotion_bonus_decision d on d.id = pg.decision_id
       left join public.staff ds on ds.id = d.decided_by_staff_id
       left join public.ledger_transaction lt on lt.id = g.ledger_transaction_id
       left join public.staff gs on gs.user_id = lt.created_by_user_id and gs.venue_id = g.venue_id
       cross join (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
       where g.venue_id = $1 and (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and private.club_day_of(g.created_at) between s.from_day and least(s.to_day, s.from_day + 91)
       union all
       -- A reversal on its own day, below nothing, by whom and why (the owner, 19 Nov); its row is its transaction.
       select g.reversal_transaction_id, g.reversed_at, m.id, m.full_name, m.member_number, -g.reversal_paise, g.reversal_reason, 'reversed',
              coalesce(pv.name, p.name), rs.full_name
       from public.bonus_grant g
       join public.member m on m.id = g.member_id
       left join public.promotion_grant pg on pg.bonus_grant_id = g.id
       left join public.promotion p on p.id = pg.promotion_id
       left join public.promotion_version pv on pv.id = pg.promotion_version_id
       left join public.staff rs on rs.id = g.reversed_by_staff_id
       cross join (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
       where g.venue_id = $1 and g.reversed_at is not null and (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and private.club_day_of(g.reversed_at) between s.from_day and least(s.to_day, s.from_day + 91)
     $src$,
     '{"when": "given_at", "member": "full_name", "number": "member_number", "amount": "amount_paise / 100", "by": "staff_name",
       "source": "source", "reason": "reason"}'::jsonb,
     array['full_name', 'member_number', 'staff_name', 'promotion_name', 'reason'], 'given_at desc, grant_id', array['source']),
    -- Every visit in a report's span (decision 0682): each member who came in on each club day, as the door's Today's
    -- players gives the day, for staff who read reports (and members, as private.todays_players asks); never the practice
    -- venue. One on a list from the app who never came in is no visit. The span is the screen's own choice, scope from and
    -- to as whole dates (YYYY-MM-DD), 92 club days at most counted from `from`: anything else is no day at all. Newest first.
    ('player_visits',
     replace($src$
       select tp_day.club_day, tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
              t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
              tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables,
              coalesce((select sum((x ->> 'seconds')::bigint) from jsonb_array_elements(tp.tables) x), 0)::bigint as played_seconds,
              (select string_agg(x ->> 'table', ', ') from jsonb_array_elements(tp.tables) x) as table_names,
              KYC_STATUS as kyc_status,
              (select coalesce(sum(g.amount_paise), 0) from public.bonus_grant g
               where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.created_at) = tp_day.club_day)::bigint
               - (select coalesce(sum(g.reversal_paise), 0) from public.bonus_grant g
                  where g.venue_id = $1 and g.member_id = tp.member_id and private.club_day_of(g.reversed_at) = tp_day.club_day)::bigint as bonus_paise
       from (select s.from_day + n as club_day
             from (select case when $2 #>> '{scope,from}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,from}')::date end as from_day,
                          case when $2 #>> '{scope,to}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then ($2 #>> '{scope,to}')::date end as to_day) s
             -- least() passes over a null, and todays_players takes no day as today: a date missing is no day at all.
             cross join generate_series(0, least(s.to_day - s.from_day, 91)) n
             where s.from_day is not null and s.to_day is not null) tp_day
       cross join lateral private.todays_players($1, tp_day.club_day) tp
       join public.member m on m.id = tp.member_id
       join public.tier t on t.id = m.tier_id
       where (select private.has_permission($1, 'reports.read'))
         and not exists (select 1 from public.venue v where v.id = $1 and v.is_practice)
         and (tp.checked_in_at is not null or jsonb_array_length(tp.tables) > 0)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"date": "club_day", "player": "full_name", "number": "member_number", "tier": "tier_name", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "bonus": "bonus_paise / 100"}'::jsonb,
     array['full_name', 'member_number'], 'club_day desc, full_name, member_id', array['tier'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$function$;

-- A promotion freed by a reversal: its limits and budget leave the grant out, as a refused one.
CREATE OR REPLACE FUNCTION private.promotion_tally(p_promotion_id uuid, p_member_id uuid, p_period_key text, p_table_id uuid, p_day date, p_limits jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'chipsGiven', coalesce(sum(g.chips) filter (where g.is_counted and g.is_held), 0),
    'grantsGiven', count(*) filter (where g.is_counted and g.is_held),
    'membersToday', count(distinct g.member_id) filter (where g.club_day = p_day and g.is_held),
    'isMemberGrantedToday', coalesce(bool_or(g.member_id = p_member_id and g.club_day = p_day and g.is_held), false),
    'periodGiven', count(*) filter (where g.member_id = p_member_id and g.is_held and g.is_in_period),
    -- Every grant of the member's period, refused ones too: the next takes the slot after them all, so a refusal that is not
    -- the latest never stands in its way (decision 0670).
    'periodSlots', count(*) filter (where g.member_id = p_member_id and g.is_in_period),
    'grantsAtTableToday', case when p_table_id is not null then count(*) filter (where g.club_day = p_day and g.table_id = p_table_id and g.is_held) end)
  -- A grant held counts toward the limits and the budget: given, or waiting for a super admin; a refused one does not, nor
  -- one whose Bonus was reversed (the owner, 19 Nov: the promotion is freed).
  from (select x.*, p_limits ->> 'budgetPeriod' is distinct from 'month'
                    or date_trunc('month', x.club_day) = date_trunc('month', p_day) as is_counted,
               x.status not in ('refused', 'reversed') as is_held,
               coalesce(x.period_key = p_period_key or starts_with(x.period_key, p_period_key || '#'), false) as is_in_period
        from public.promotion_grant x where x.promotion_id = p_promotion_id) g;
$function$;

CREATE OR REPLACE FUNCTION private.promotion_candidate(p_promotion promotion, p_trigger text, p_facts jsonb, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_day date := (p_facts ->> 'club_day')::date;
  v_given public.promotion_grant;
  v_rule public.promotion_rule;
  v_reward record;
  v_budget public.promotion_budget;
begin
  select * into v_given from public.promotion_grant g
  where g.promotion_id = p_promotion.id and g.member_id = v_member_id and g.source_key = p_context ->> 'key';
  if v_given.id is not null then
    return jsonb_build_object('promotion', p_promotion.id, 'stacks', p_promotion.stacks, 'cost_paise', v_given.cost_paise, 'is_given', true);
  end if;
  select r.* into v_rule from public.promotion_rule r
  cross join lateral private.rule_in_window(r.conditions, p_trigger, p_context) w
  where r.promotion_id = p_promotion.id and r.trigger = p_trigger and w.o_counts
    and private.promotion_applies(w.o_conditions, p_facts || w.o_facts || jsonb_build_object(
      'granted_today', (select count(*) from public.promotion_grant g where g.status not in ('refused', 'reversed') and g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.status not in ('refused', 'reversed') and g.promotion_id = p_promotion.id and g.club_day = v_day
                                 and g.table_id = (p_facts ->> 'table_id')::uuid)))
  order by r.position limit 1;
  if v_rule.id is null then
    return null;
  end if;
  select * into v_reward from private.promotion_reward(v_rule.effect,
    case when p_context ->> 'method' = 'bonus' then 0 else (p_context ->> 'amount_paise')::bigint end);
  if not found then
    return null;
  end if;
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  return jsonb_build_object('promotion', p_promotion.id, 'name', p_promotion.name, 'venue_id', p_promotion.venue_id, 'rule', v_rule.id,
    'trigger', v_rule.trigger, 'effect', v_rule.effect, 'stacks', p_promotion.stacks, 'cost_paise', v_reward.cost_paise,
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.status not in ('refused', 'reversed') and g.promotion_id = p_promotion.id
                                               and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.status not in ('refused', 'reversed') and g.promotion_id = p_promotion.id
                                         and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.status not in ('refused', 'reversed') and g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$function$;

-- Activity: a reversal and a use added are Bonus.
CREATE OR REPLACE FUNCTION private.activity_kind(p_action text, p_entity text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_entity = 'control_state' then 'controls'
    when p_action like 'export.%' or p_entity = 'export_archive' then 'exports'
    when p_entity in ('staff', 'staff_credential', 'staff_shift', 'staff_attendance') then 'staff'
    when p_action in ('bonus.give', 'high_hand.pay', 'bonus.approve', 'bonus.refuse', 'bonus.reverse', 'bonus.use_add')
         or p_entity in ('bonus_grant', 'bonus_redemption', 'bonus_owed', 'high_hand_hit', 'promotion_bonus_decision') then 'bonus_chips'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$function$;

-- Erasure: Bonus owed holds nothing back and is written off then (the owner, 19 Nov); a reversal's reason goes with the rest
-- of the person.
CREATE OR REPLACE FUNCTION private.member_erasure_blockers(p_member_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0) then 'markers' end,
    -- Bonus owed to the club beyond what a reversal or a use left owed (a liability above zero no Bonus record explains):
    -- never forfeited, so set right first. What a reversal or a use left owed holds nothing back: it is written off as the
    -- member is erased (the owner, 19 Nov; #1077).
    case when exists (select 1 from balance b where b.code = 'member.bonus' and b.amount > private.bonus_owed_by(p_member_id)) then 'bonus' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$function$;

CREATE OR REPLACE FUNCTION private.forfeit_member_bonus(p_member member)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_bonus bigint;
  v_bonus_txn uuid;
  v_owed bigint;
  v_owed_txn uuid;
begin
  -- One member's Bonus changes wait for each other (#1077): a reversal or a use added at the same moment waits for this.
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member.id::text, 0));
  perform 1 from public.bonus_grant g where g.member_id = p_member.id and g.expired_at is null for update;
  -- Bonus owed is written off as the member is erased (the owner, 19 Nov): nothing of it is asked of them.
  v_owed := private.bonus_owed_by(p_member.id);
  if v_owed > 0 then
    v_owed_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:owed:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'),
                           'amount', (-v_owed)::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.bonus_expense' and a.member_id is null),
                           'amount', v_owed::text)),
      null, 'Bonus owed written off on erasure');
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise) values (p_member.venue_id, p_member.id, 'written_off', -v_owed);
  end if;
  v_bonus := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'));
  if v_bonus > 0 then
    v_bonus_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:bonus:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'),
                           'amount', v_bonus::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.bonus_expense' and a.member_id is null),
                           'amount', (-v_bonus)::text)),
      null, 'Forfeited on erasure');
  end if;
  -- As the expiry job does, a grant with nothing left names no transaction.
  update public.bonus_grant g
  set remaining_paise = 0, expired_at = now(), expiry_transaction_id = case when g.remaining_paise > 0 then v_bonus_txn end
  where g.member_id = p_member.id and g.expired_at is null;
  return jsonb_build_object('bonus_paise', greatest(v_bonus, 0),
                            'forfeit_transactions', to_jsonb(array_remove(array[v_owed_txn, v_bonus_txn], null)));
end;
$function$;

CREATE OR REPLACE FUNCTION private.strip_erased_fields(p_state jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when jsonb_typeof(p_state) = 'object'
    then p_state - array['full_name', 'phone', 'note', 'resolution', 'reason', 'release_reason', 'lift_reason', 'proposal_reason',
                         'decline_reason', 'reject_reason', 'buyer_name', 'signature_svg', 'vendor_reference', 'digilocker_session_id',
                         'address', 'cancel_reason', 'known_as', 'aadhaar_name', 'retake_reason', 'reversal_reason']
    else p_state end;
$function$;

-- Erasure takes the member's Bonus lock before the member's row, as every Bonus change does.
CREATE OR REPLACE FUNCTION private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
 RETURNS TABLE(venue_id uuid, forfeited_bonus_paise bigint, blocked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.erase') then
    raise exception 'Only a super admin erases a member' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('member-erase:' || v_member.venue_id::text));
  -- The member's Bonus lock before their row, the order every Bonus change takes them in (#1077): a reversal, a use
  -- added or a credit at the same moment waits instead of deadlocking.
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.erased_at is not null then
    raise exception 'This member was erased already' using errcode = 'RVERD';
  end if;
  if btrim(coalesce(p_full_name, '')) is distinct from v_member.full_name then
    raise exception 'Type the member''s full name exactly to erase them' using errcode = 'RVNAM';
  end if;
  if not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'Give a reason of 3 to 300 characters with nothing of the person in it' using errcode = '22023';
  end if;
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.erase' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten members were erased in the last hour: wait before erasing another' using errcode = 'RVRAT';
  end if;
  v_summary := private.carry_out_erasure(p_member_id, v_reason);
  update public.member_erasure_request r
  set completed_at = now()
  where r.member_id = p_member_id and r.completed_at is null;
  if found and v_member.phone is not null then
    insert into private.erasure_notice_phone (member_id, venue_id, phone) values (p_member_id, v_member.venue_id, v_member.phone);
    perform private.emit(v_member.venue_id, 'member.notice',
      jsonb_build_object('member_id', p_member_id, 'notice', 'account_erased', 'params', '[]'::jsonb),
      'member.notice:account_erased:' || p_member_id);
  end if;
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz;
end;
$function$;

CREATE OR REPLACE FUNCTION private.carry_out_erasure(p_member_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member;
  v_blockers text[];
  v_summary jsonb;
begin
  -- The member's Bonus lock before their row, the order every Bonus change takes them in (#1077): a reversal, a use
  -- added or a credit at the same moment waits instead of deadlocking.
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if not found then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  v_blockers := private.member_erasure_blockers(p_member_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Settle these before erasing the member: %', array_to_string(v_blockers, ', ')
      using errcode = 'RVERA', detail = array_to_string(v_blockers, ',');
  end if;
  v_summary := private.forfeit_member_bonus(v_member) || jsonb_build_object('blocked_until', private.block_erased_member(v_member));
  perform private.delete_member_records(v_member);
  perform private.anonymise_member(v_member);
  perform private.remove_member_login(v_member);
  perform private.scrub_member_audit(v_member);
  if not exists (select 1 from public.audit_log a where a.entity = 'member' and a.entity_id = p_member_id::text and a.action = 'member.erase') then
    perform private.audit(v_member.venue_id, 'member.erase', 'member', p_member_id::text, null, v_summary, p_reason);
  end if;
  return v_summary || jsonb_build_object('venue_id', v_member.venue_id);
end;
$function$;

-- The erasure preview names the Bonus erasure will forfeit: what the member holds once what they owe is written off.
CREATE OR REPLACE FUNCTION private.member_erasure_preview(p_member_id uuid)
 RETURNS TABLE(is_erased boolean, blockers text[], bonus_paise bigint, blocked_until timestamp with time zone, kyc_files integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(private.bonus_owed_by(m.id) - private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r),
         (select count(*)::integer from storage.objects o
          where o.bucket_id = 'kyc' and o.name like m.venue_id::text || '/' || m.id::text || '/%')
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$function$;
