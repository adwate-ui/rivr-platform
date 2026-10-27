-- Accommodation rewards, earning (#146; additions "Accommodation rewards"; question #486, the owner's answer of 27 Oct;
-- decision 0246). A member earns hotel nights by the hours they play: when a visit closes, the time played at each
-- table (visit_table_time, the call-time clock's, as points by the hour use it) earns that table type's
-- accommodation.hours_per_night share of a night, rounded down to a thousandth per seat session at each table (as
-- points by the hour are), so hours at different
-- stakes and on different visits add up. Nights are a balance of their own, kept in the ledger as points are: the
-- member's member.nights against the venue's venue.nights_issued, in thousandths of a night. @rivr/domain
-- nightsForTime is proved equal by packages/testing/golden/accommodation.json. Spending nights on the catalogue's
-- hotel-night rewards follows in its own change.
--
-- Only members whose tier has rewards.accommodation earn nights (rule 8). The accounts open the first time a member
-- earns: venue accounts are opened in bootstrap_venue, which lanes copy whole for each new account, and a copy here
-- would race theirs.

insert into public.setting_key (key, description, scope, value_schema) values
  ('accommodation.hours_per_night',
   'Accommodation rewards (decision 0246): the hours played at this table type that earn one hotel night; none set earns none.',
   'table_type',
   '{"type":"object","properties":{"hours":{"type":"integer","minimum":1,"maximum":1000}},"required":["hours"],"additionalProperties":false}');

insert into public.feature (key, name, description, screens, is_gateable) values
  ('rewards.accommodation', 'Hotel nights', 'Hotel nights earned by the hours played, at stakes with an hours-per-night rate.', '{player:rewards}', true);

-- @rivr/domain nightsForTime: a table type's hours a night, as thousandths of a night for the seconds played,
-- rounded down. 3600 seconds an hour; 1000 thousandths a night.
create function private.nights_for_time(p_seconds bigint, p_hours_per_night integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select p_seconds * 1000 / (p_hours_per_night * 3600::bigint);
$$;

-- Posts nights, in thousandths, between the member and the venue's nights issued: positive credits the member. Opens
-- either account the first time it is used.
create function private.post_nights(p_venue_id uuid, p_member_id uuid, p_thousandths bigint, p_kind text, p_memo text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_account uuid;
  v_issued_account uuid;
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  insert into public.ledger_account (venue_id, code, name, kind, unit, member_id, is_players_money) values
    (p_venue_id, 'member.nights', 'Hotel nights', 'liability', 'nights', p_member_id, false),
    (p_venue_id, 'venue.nights_issued', 'Hotel nights issued', 'expense', 'nights', null, false)
  on conflict do nothing;
  select a.id into v_member_account from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id = p_member_id and a.code = 'member.nights';
  select a.id into v_issued_account from public.ledger_account a
  where a.venue_id = p_venue_id and a.member_id is null and a.code = 'venue.nights_issued';
  return private.post_ledger_transaction(p_venue_id, p_kind, p_idempotency_key,
    jsonb_build_array(jsonb_build_object('account_id', v_member_account, 'amount', (-p_thousandths)::text),
                      jsonb_build_object('account_id', v_issued_account, 'amount', p_thousandths::text)),
    null, p_memo);
end;
$$;

-- Earns a closed visit its hotel nights, once: its time at each table at that table type's hours a night in force
-- when the visit closed, summed and credited to the member, who must have rewards.accommodation. Returns the
-- thousandths earned.
create function private.earn_visit_nights(p_visit_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_thousandths bigint;
  v_txn uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.closed_at is null or not private.has_feature(v_visit.member_id, 'rewards.accommodation') then
    return 0;
  end if;
  select coalesce(sum(private.nights_for_time(t.o_played, (r.rate ->> 'hours')::integer)), 0) into v_thousandths
  from private.visit_table_time(p_visit_id) t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join lateral (select private.setting_at(v_visit.venue_id, 'accommodation.hours_per_night', tt.code, v_visit.closed_at) as rate) r
  where r.rate is not null;
  if v_thousandths > 0 then
    v_txn := private.post_nights(v_visit.venue_id, v_visit.member_id, v_thousandths, 'nights_earned', 'Hotel nights for the visit',
                                 'nights.visit:' || p_visit_id);
    perform private.emit(v_visit.venue_id, 'nights.earned',
                         jsonb_build_object('member_id', v_visit.member_id, 'visit_id', p_visit_id, 'thousandths', v_thousandths,
                                            'ledger_transaction_id', v_txn),
                         'nights.earned:' || p_visit_id);
  end if;
  return v_thousandths;
end;
$$;

-- As before (20261026100000_door_kiosk.sql), now also earning the visit its hotel nights.
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
  perform private.earn_visit_nights(v_visit.id);
  perform private.weigh_hours_played(v_visit.id);
  return v_visit.id;
end;
$$;

-- As before (20261026160000_tv_rewards_and_my_rewards.sql), with the member's hotel nights, in thousandths.
drop function public.my_rewards();
drop function private.my_rewards();
create function private.my_rewards()
returns table (points bigint, tier_name text, nights bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.points'), 0)::bigint,
         t.name,
         coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.nights'), 0)::bigint
  from public.member m join public.tier t on t.id = m.tier_id
  where m.id = private.current_member_id();
$$;
create function public.my_rewards()
returns table (points bigint, tier_name text, nights bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_rewards(); $$;

revoke execute on function private.nights_for_time(bigint, integer), private.post_nights(uuid, uuid, bigint, text, text, text),
  private.earn_visit_nights(uuid), private.my_rewards(), public.my_rewards() from public, anon, authenticated;
grant execute on function private.my_rewards(), public.my_rewards() to authenticated;
