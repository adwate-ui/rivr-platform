-- Erase one member's personal data on request (#424; decision 0207; the owner's plan of 26 Oct). A super admin
-- types the member's full name and a reason; the database checks both, refuses while anything of the member's is
-- open (wallet cash, chips, markers, points or bonus owed, a reward to hand over, the waitlist, a tournament not
-- finished, a waiting request, an unpaid academy booking, a freeze), forfeits their points and bonus to the club,
-- then deletes or anonymises their personal data:
-- * deleted: preferences, notification choices, limits, feature overrides, sign-up attribution, membership card,
--   feedback, KYC reviews, messages queued about them, payout accounts no money record names, and their login
--   (unless a staff record or a device uses it) with what the sign-in service recorded of it;
-- * anonymised: the member row (no name, number or login; erased_at), consent withdrawn, and the KYC record, kept
--   with the PAN alone where TDS was taken (the TDS return names it), else deleted;
-- * kept, naming only the member's id: the ledger, the cage, TDS, invoices as issued, markers, payout accounts a
--   withdrawal or deposit names (marked removed), play and the safer-gambling records;
-- * the audit rows about them lose their personal fields, through a narrow exception to the append-only guard,
--   and the erasure itself is recorded there, with its reason and no personal data.
-- A break still in force leaves a block until it ends: keyed hashes of the number and of the KYC identity, never a
-- name. While it stands, that number does not join the venue and a KYC check of that identity is refused. The
-- practice venue erases the same way and takes its seed again, so a reset cannot bring the data back. Nothing is
-- sent out. The KYC files in Storage go through the member-erase Edge Function. After a restore,
-- private.reapply_member_erasures makes the erasures again (docs/runbooks/backups-and-restore.md).

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['members.erase']) as permission;

-- Erasing a member is super admin business only, as purge is.
alter table public.role_permission drop constraint super_admin_only_permissions;
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage',
                        'members.erase')
);

-- As before (20261026180000_tds_reports_and_shareholding.sql), with erasing a member at the admin computer.
create or replace function private.computer_kind_for(p_permission text)
returns public.device_kind
language sql
immutable
set search_path = ''
as $$
  select case
    when p_permission in ('cage.transact', 'cage.second_approve', 'markers.issue', 'withdrawals.approve') then 'cage'::public.device_kind
    when p_permission in ('settings.manage', 'staff.manage', 'devices.manage', 'tiers.manage', 'venue.configure', 'control.engage',
                          'purge.run', 'exports.full', 'treasury.manage', 'shareholding.manage', 'exports.table', 'members.erase')
      then 'console'::public.device_kind
  end;
$$;

alter table public.member add column erased_at timestamptz;
comment on column public.member.erased_at is
  'When the member''s personal data was erased on request (#424). The row stays, by number, for the money records.';
-- Every member has a number until erased. An erased one holds nothing of the person, and is never renamed.
alter table public.member alter column phone drop not null;
alter table public.member add constraint member_erased_is_anonymous check (
  case when erased_at is null then phone is not null
       else phone is null and user_id is null and full_name = 'Erased member' and qualifying_small_blind is null end
);

-- An erased KYC record keeps the PAN alone, for the TDS returns. A check is refused for a break still in force.
alter table public.kyc_record drop constraint kyc_record_status_check;
alter table public.kyc_record add constraint kyc_record_status_check
  check (status in ('started', 'needs_pan', 'needs_review', 'verified', 'refused', 'erased'));
alter table public.kyc_record drop constraint kyc_record_refusal_check;
alter table public.kyc_record add constraint kyc_record_refusal_check
  check (refusal in ('under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar', 'staff_rejected', 'on_break'));

-- An erased member is never checked again: a new identity on the old number would undo the erasure.
create function private.refuse_erased_member_kyc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.purging(new.venue_id), false)
     and exists (select 1 from public.member m where m.id = new.member_id and m.erased_at is not null) then
    raise exception 'This member was erased' using errcode = 'RVERD';
  end if;
  return new;
end;
$$;
create trigger kyc_record_not_erased before insert on public.kyc_record
  for each row execute function private.refuse_erased_member_kyc();

-- ---------------------------------------------------------------------------------------------------
-- The block an erased member's break leaves.

-- Keyed hashes of the number and of the KYC identity (by private.kyc_reference), never a name, until the break
-- ends. No policies: only the functions below read it.
create table private.member_erasure_block (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  phone_hash text,
  identity_keys text[] not null default '{}',
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone_hash is not null or cardinality(identity_keys) > 0)
);
create index member_erasure_block_venue_idx on private.member_erasure_block (venue_id, ends_at);
comment on table private.member_erasure_block is 'An erased member''s break, by keyed hashes alone, until it ends (#424).';
alter table private.member_erasure_block enable row level security;
revoke all on private.member_erasure_block from public, anon, authenticated, service_role;

-- The keyed hashes a KYC check names a person by, whichever way it was made: the DigiLocker identity key, the
-- Aadhaar reference (both kept hashed already), the PAN, and the last four Aadhaar digits with the date of birth,
-- which an in-person check keeps.
create function private.kyc_identity_keys(p_check public.kyc_record)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    p_check.identity_key, p_check.aadhaar_reference,
    case when p_check.pan is not null then private.kyc_reference('pan:' || p_check.pan) end,
    case when p_check.masked_aadhaar is not null and p_check.date_of_birth is not null
      then private.kyc_reference('aadhaar4:' || right(p_check.masked_aadhaar, 4) || ':' || to_char(p_check.date_of_birth, 'YYYY-MM-DD')) end
  ], null);
$$;

-- Whether a block at the venue stands on this number's hash or on any of these identity hashes.
create function private.is_erasure_blocked(p_venue_id uuid, p_phone_hash text, p_identity_keys text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.member_erasure_block b
                 where b.venue_id = p_venue_id and b.ends_at > now()
                   and (b.phone_hash = p_phone_hash or b.identity_keys && p_identity_keys));
$$;

-- A number under a block does not join the venue, by sign-up or by a member's number changed to it.
create function private.refuse_blocked_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is null or coalesce(private.purging(new.venue_id), false)
     or not exists (select 1 from private.member_erasure_block b where b.venue_id = new.venue_id and b.ends_at > now()) then
    return new;
  end if;
  if private.is_erasure_blocked(new.venue_id, private.kyc_reference('phone:' || new.phone), '{}') then
    raise exception 'On a break: this number cannot join until it ends' using errcode = 'RVBRK';
  end if;
  return new;
end;
$$;
create trigger member_erasure_block before insert or update of phone on public.member
  for each row execute function private.refuse_blocked_number();

-- As before (20261018092600_kyc_in_person.sql), first refusing an identity an erased member's break blocks. The
-- hashes are worked out only where a block stands, as the cage's list asks this of every member.
create or replace function private.kyc_refusal(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when case when exists (select 1 from private.member_erasure_block b where b.venue_id = k.venue_id and b.ends_at > now())
              then private.is_erasure_blocked(k.venue_id, null, private.kyc_identity_keys(k)) else false end
      then 'on_break'
    when k.date_of_birth > (now() at time zone v.time_zone)::date - make_interval(years => private.kyc_minimum_age(k.venue_id))
      then 'under_18'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified' and o.pan = k.pan)
      then 'duplicate_pan'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and o.aadhaar_reference = k.aadhaar_reference)
      then 'duplicate_aadhaar'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and 'manual' in (o.method, k.method)
                   and o.masked_aadhaar = k.masked_aadhaar and o.date_of_birth = k.date_of_birth)
      then 'duplicate_aadhaar'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and (o.member_id = k.same_face_as or o.same_face_as = k.member_id))
      then 'duplicate_face'
  end
  from public.kyc_record k join public.venue v on v.id = k.venue_id
  where k.member_id = p_member_id;
$$;

-- As before (20261027000400_kyc_on_cashfree.sql), never with an erased record, which keeps a PAN for TDS alone.
create or replace function private.kyc_records_clash(p_check public.kyc_record, p_other public.kyc_record)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_other.venue_id = p_check.venue_id and p_other.member_id <> p_check.member_id and p_other.status <> 'erased'
    and (p_other.pan = p_check.pan or p_other.aadhaar_reference = p_check.aadhaar_reference
         or p_other.member_id = p_check.same_face_as or p_other.same_face_as = p_check.member_id
         or p_other.identity_key = p_check.identity_key);
$$;

-- Each night, the blocks whose break has ended go.
create function private.lapse_erasure_blocks()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.member_erasure_block b where b.ends_at <= now();
$$;
select cron.schedule('erasure-blocks-lapse', '40 0 * * *', 'select private.lapse_erasure_blocks()');

-- ---------------------------------------------------------------------------------------------------
-- The audit log's one exception.

-- Inside an erasure, the member it erases: only in the erasure's own transaction, run as the database owner.
create function private.erasing()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case when current_user = 'postgres' and current_setting('rivr.erase', true) = 'on'
              then nullif(current_setting('rivr.erase_member', true), '')::uuid end;
$$;

-- An audit row's before or after without the fields that hold a person's name, number or words, or what staff
-- wrote about them, or the KYC vendor's handle on them. The one list, for the erasure and for the guard.
create function private.strip_erased_fields(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_state) = 'object'
    then p_state - array['full_name', 'phone', 'note', 'resolution', 'reason', 'release_reason', 'lift_reason', 'proposal_reason',
                         'decline_reason', 'reject_reason', 'buyer_name', 'signature_svg', 'vendor_reference', 'digilocker_session_id']
    else p_state end;
$$;

-- Whether an update of an audit row is the erasure's own stripping of a row about the member it erases: every
-- other column the same, and before and after exactly what private.strip_erased_fields leaves of them.
create function private.is_audit_scrub(p_old jsonb, p_new jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    private.erasing()::text in (p_old ->> 'entity_id', p_old -> 'before' ->> 'member_id', p_old -> 'after' ->> 'member_id')
      and p_old - array['before', 'after'] = p_new - array['before', 'after']
      and p_new -> 'before' = private.strip_erased_fields(p_old -> 'before')
      and p_new -> 'after' = private.strip_erased_fields(p_old -> 'after'),
    false);
$$;

-- As before (20261021130000_practice_reset.sql), and an erasure may strip personal fields from the audit rows
-- about its member (#424), never anything else.
create or replace function private.refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Asked only on a delete, which nothing but a purge ever gets past.
  if tg_op = 'DELETE' then
    if coalesce(private.purging((to_jsonb(old) ->> 'venue_id')::uuid), false) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' and tg_relid = 'public.audit_log'::regclass then
    if private.is_audit_scrub(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- The erasure.

-- What must be settled before a member is erased, in the order the screen lists it; empty when nothing is. A
-- tournament not finished counts, busted or not: a run in the money is paid into the wallet at the finish.
create function private.member_erasure_blockers(p_member_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0)
           or exists (select 1 from public.marker k where k.member_id = m.id and k.settled_at is null) then 'markers' end,
    -- Points or bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code in ('member.points', 'member.bonus') and b.amount > 0) then 'rewards' end,
    case when exists (select 1 from public.redemption r where r.member_id = m.id and r.handed_over_at is null) then 'redemptions' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end,
    case when exists (select 1 from public.tournament_entry e join public.tournament t on t.id = e.tournament_id
                      where e.member_id = m.id and e.status <> 'refunded' and t.finished_at is null) then 'tournament' end,
    case when exists (select 1 from public.buy_in_request b where b.member_id = m.id and b.status = 'waiting')
           or exists (select 1 from public.withdrawal_request w where w.member_id = m.id and w.status = 'waiting')
           or exists (select 1 from public.deposit_request d where d.member_id = m.id and d.status = 'waiting') then 'requests' end,
    case when exists (select 1 from public.academy_booking a where a.member_id = m.id and a.status in ('awaiting_payment', 'payment_claimed'))
      then 'academy' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$$;

-- The member's points and bonus go back to the club, as a redemption and an expiry do: points to the points
-- issued, bonus to the bonus expense. The ledger keeps one unit to a transaction, so they are two, of the kind
-- member_erasure_forfeit, in the erasure's own transaction and named in its audit row. The open grants are
-- locked first, so the minute's expiry job cannot take the same bonus back alongside, and then closed, so it
-- never does later. Returns what was forfeited, and the transactions.
create function private.forfeit_member_rewards(p_member public.member)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points bigint;
  v_bonus bigint;
  v_points_txn uuid;
  v_bonus_txn uuid;
begin
  perform 1 from public.bonus_grant g where g.member_id = p_member.id and g.expired_at is null for update;
  v_points := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.points'));
  v_bonus := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'));
  if v_points > 0 then
    v_points_txn := private.post_points(p_member.venue_id, p_member.id, -v_points, 'member_erasure_forfeit', 'Forfeited on erasure',
                                        'member_erasure_forfeit:points:' || p_member.id);
  end if;
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
  return jsonb_build_object('points', greatest(v_points, 0), 'bonus_paise', greatest(v_bonus, 0),
                            'forfeit_transactions', to_jsonb(array_remove(array[v_points_txn, v_bonus_txn], null)));
end;
$$;

-- A break still in force leaves a block on the member's number and KYC identity until it ends. Returns its end,
-- or null with no break. Taken before the number and the KYC record go; making it again adds nothing.
create function private.block_erased_member(p_member public.member)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz := (select r.break_until from private.member_restrictions(p_member.id, now()) r);
  v_identity_keys text[] := coalesce((select private.kyc_identity_keys(k) from public.kyc_record k where k.member_id = p_member.id), '{}');
  v_phone_hash text;
begin
  if v_until is null or (p_member.phone is null and cardinality(v_identity_keys) = 0) then
    return v_until;
  end if;
  v_phone_hash := case when p_member.phone is not null then private.kyc_reference('phone:' || p_member.phone) end;
  insert into private.member_erasure_block (venue_id, phone_hash, identity_keys, ends_at)
  select p_member.venue_id, v_phone_hash, v_identity_keys, v_until
  where not exists (select 1 from private.member_erasure_block b
                    where b.venue_id = p_member.venue_id and b.ends_at = v_until
                      and b.phone_hash is not distinct from v_phone_hash and b.identity_keys = v_identity_keys);
  return v_until;
end;
$$;

-- What erasure deletes outright: what the member chose, said or was given for themselves, messages queued about
-- them (only messaging consumers read the outbox), and payout accounts no withdrawal or deposit names.
create function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

-- What erasure keeps without the person: the member row by number, consent withdrawn, a payout account a money
-- record names marked removed, and the KYC record with the PAN alone where TDS was taken, at the cage or on a
-- tournament prize (else deleted). Each changes only what is not so already, so making it again writes nothing.
create function private.anonymise_member(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payout_account p set removed_at = now() where p.member_id = p_member.id and p.removed_at is null;
  update public.consent c set withdrawn_at = now() where c.member_id = p_member.id and c.withdrawn_at is null;
  if exists (select 1 from public.tds_withholding t where t.member_id = p_member.id)
     or exists (select 1 from public.tournament_payout t where t.member_id = p_member.id and t.tds_paise > 0) then
    update public.kyc_record k
    set status = 'erased', refusal = null, verified_at = null, digilocker_session_id = null, date_of_birth = null, masked_aadhaar = null,
        address = null, vendor_reference = null, photo_path = null, liveness_score = null, face_match_score = null,
        aadhaar_reference = null, same_face_as = null, selfie_claimed_at = null, identity_key = null
    where k.member_id = p_member.id and k.status <> 'erased';
  else
    delete from public.kyc_record k where k.member_id = p_member.id;
  end if;
  update public.member m
  set full_name = 'Erased member', phone = null, user_id = null, qualifying_small_blind = null, qualifying_big_blind = null,
      erased_at = coalesce(m.erased_at, now())
  where m.id = p_member.id
    and (m.full_name <> 'Erased member' or m.phone is not null or m.user_id is not null or m.qualifying_small_blind is not null
         or m.erased_at is null);
end;
$$;

-- The member's login goes, with what the sign-in service recorded of it, unless a staff record or a device signs
-- in with it too.
create function private.remove_member_login(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_member.user_id is null
     or exists (select 1 from public.staff s where s.user_id = p_member.user_id)
     or exists (select 1 from public.device d where d.auth_user_id = p_member.user_id) then
    return;
  end if;
  delete from auth.audit_log_entries e
  where e.payload ->> 'actor_id' = p_member.user_id::text or e.payload -> 'traits' ->> 'user_id' = p_member.user_id::text;
  delete from auth.users u where u.id = p_member.user_id;
end;
$$;

-- The audit rows about the member lose their personal fields (private.strip_erased_fields); private.erasing()
-- lets the append-only guard give way to this alone.
create function private.scrub_member_audit(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('rivr.erase', 'on', true);
  perform set_config('rivr.erase_member', p_member.id::text, true);
  update public.audit_log a
  set before = private.strip_erased_fields(a.before), after = private.strip_erased_fields(a.after)
  where a.venue_id = p_member.venue_id
    and p_member.id::text in (a.entity_id, a.before ->> 'member_id', a.after ->> 'member_id')
    and (a.before is distinct from private.strip_erased_fields(a.before) or a.after is distinct from private.strip_erased_fields(a.after));
  perform set_config('rivr.erase', 'off', true);
  perform set_config('rivr.erase_member', '', true);
end;
$$;

-- Carries an erasure out, for a request or again after a restore: refused while anything is open, then the
-- forfeit, the block, the deletions and anonymising, the login and the audit rows. The erasure goes in the audit
-- log once, with the reason. The practice venue takes its seed again. Returns what was forfeited and the block.
create function private.carry_out_erasure(p_member_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_blockers text[];
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if not found then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  v_blockers := private.member_erasure_blockers(p_member_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Settle these before erasing the member: %', array_to_string(v_blockers, ', ')
      using errcode = 'RVERA', detail = array_to_string(v_blockers, ',');
  end if;
  v_summary := private.forfeit_member_rewards(v_member) || jsonb_build_object('blocked_until', private.block_erased_member(v_member));
  perform private.delete_member_records(v_member);
  perform private.anonymise_member(v_member);
  perform private.remove_member_login(v_member);
  perform private.scrub_member_audit(v_member);
  if not exists (select 1 from public.audit_log a where a.entity = 'member' and a.entity_id = p_member_id::text and a.action = 'member.erase') then
    perform private.audit(v_member.venue_id, 'member.erase', 'member', p_member_id::text, null, v_summary, p_reason);
  end if;
  if (select v.is_practice from public.venue v where v.id = v_member.venue_id) then
    perform private.capture_practice_seed(v_member.venue_id);
  end if;
  return v_summary || jsonb_build_object('venue_id', v_member.venue_id);
end;
$$;

-- Whether a reason may stay in the audit log: 3 to 300 characters naming nothing of the person (no word of their
-- name, no phone or Aadhaar number however spaced, no address with @, no PAN), as a KYC review's reason never does.
-- A date (25-10-2026) is fine.
create function private.is_safe_erasure_reason(p_reason text, p_full_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select length(p_reason) between 3 and 300
    and regexp_replace(p_reason, '[\s.,_-]', '', 'g') !~ '[0-9०-९]{10}'
    and p_reason !~* '\m[a-z]{5}\s?[0-9]{4}\s?[a-z]\M'
    and p_reason !~ '@'
    and not exists (select 1 from regexp_split_to_table(p_full_name, '[^A-Za-z]+') w
                    where length(w) >= 3 and p_reason ~* ('\m' || w || '\M'));
$$;

-- Erases a member on request: a super admin of the member's venue, the full name typed exactly, and a safe
-- reason. One erasure at a time in a venue, and at most ten in an hour.
create function private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
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
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'points')::bigint, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz;
end;
$$;

-- What the erase screen shows a super admin first: whether the member is erased, what must be settled, the
-- points and bonus they would forfeit, and the end of a break whose block would stand. Nothing for anyone else.
create function private.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.points')), 0),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r)
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$$;

-- After a restore (docs/runbooks/backups-and-restore.md): every erasure the audit log records since a time, and
-- every member named, erased again, each on its own. One that cannot be made again is reported, not fatal; making
-- one twice changes nothing. Run by the database owner, never through the API.
create function private.reapply_member_erasures(p_since timestamptz, p_member_ids uuid[] default null)
returns table (member_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  for v_member_id in
    select a.entity_id::uuid from public.audit_log a where a.action = 'member.erase' and a.entity = 'member' and a.occurred_at >= p_since
    union
    select unnest(coalesce(p_member_ids, '{}'::uuid[]))
  loop
    member_id := v_member_id;
    begin
      perform private.carry_out_erasure(v_member_id, coalesce(
        (select a.reason from public.audit_log a
         where a.action = 'member.erase' and a.entity = 'member' and a.entity_id = v_member_id::text order by a.id limit 1),
        'Erased again after a restore'));
      outcome := 'erased';
    exception when others then
      outcome := sqlerrm;
    end;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- What the apps call.

create function public.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz)
language sql volatile security invoker set search_path = ''
as $$ select * from private.erase_member(p_member_id, p_full_name, p_reason); $$;
create function public.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_erasure_preview(p_member_id); $$;

revoke execute on function private.refuse_erased_member_kyc(), private.kyc_identity_keys(public.kyc_record),
  private.is_erasure_blocked(uuid, text, text[]), private.refuse_blocked_number(), private.lapse_erasure_blocks(),
  private.member_erasure_blockers(uuid), private.forfeit_member_rewards(public.member), private.block_erased_member(public.member),
  private.delete_member_records(public.member), private.anonymise_member(public.member), private.remove_member_login(public.member),
  private.scrub_member_audit(public.member), private.carry_out_erasure(uuid, text), private.is_safe_erasure_reason(text, text),
  private.reapply_member_erasures(timestamptz, uuid[]) from public, anon, authenticated;
-- The append-only guard runs as whoever writes, so it may ask; the answer is no but inside an erasure.
revoke execute on function private.erasing(), private.strip_erased_fields(jsonb), private.is_audit_scrub(jsonb, jsonb) from public, anon;
grant execute on function private.erasing(), private.strip_erased_fields(jsonb), private.is_audit_scrub(jsonb, jsonb)
  to authenticated, service_role;
revoke execute on function private.erase_member(uuid, text, text), private.member_erasure_preview(uuid), public.erase_member(uuid, text, text),
  public.member_erasure_preview(uuid) from public, anon;
grant execute on function private.erase_member(uuid, text, text), private.member_erasure_preview(uuid), public.erase_member(uuid, text, text),
  public.member_erasure_preview(uuid) to authenticated;

-- The member table gained a column the practice reset reloads (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
