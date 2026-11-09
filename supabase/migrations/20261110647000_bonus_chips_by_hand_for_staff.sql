-- Bonus chips by hand for admins and floor managers too (the owner, 9 Nov; super admins only since 20261109170000). A permission
-- of its own, as cashiers give points but never bonus chips. With more people giving them, the owner's rule of 8 Nov holds: below
-- a super admin each person adds at most the club's bonus.daily_staff_cap in a club day, 10,000 from the start, as points by hand
-- have theirs (20261104330000_points_daily_cap.sql). Past it nothing is added and the owner hears that someone tried, once a staff
-- member a night. Super admins are not capped, and only they change the limit. None set is no cap.
--
-- As with points, a refusal with an error would take its alert back with it, so a refused addition answers no grant (null) and keeps
-- the alert. A retry of an addition that went through is answered with it, before the limit is counted.

insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['bonus.give']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['bonus.give']) as permission;
insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['bonus.give']) as permission;

insert into public.setting_key (key, description, scope, value_schema) values
  ('bonus.daily_staff_cap',
   'The most bonus chips one staff member adds by hand in a club day; an addition past it is refused and the owner hears of it. Super admins are not capped. None set is no cap.',
   'venue',
   '{"type":"object","properties":{"chips":{"type":"integer","minimum":50,"maximum":1000000}},"required":["chips"],"additionalProperties":false}');

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'bonus.daily_staff_cap', '', '{"chips": 10000}'::jsonb, now(), 'Bonus chips by hand for admins and floor managers, 9 Nov'
from public.venue v
where not v.is_practice
on conflict (venue_id, key, subject, effective_from) do nothing;

-- As before (20261108110000_kyc_at_the_club.sql), with bonus.daily_staff_cap a control setting too: someone who adds bonus chips
-- must not raise their own limit.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap'))
  execute function private.guard_control_settings();

-- The bonus chips, in paise, a person added by hand at the venue since the club day began.
create function private.bonus_given_tonight(p_venue_id uuid, p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(g.amount_paise), 0)::bigint
  from public.bonus_grant g
  join public.ledger_transaction t on t.id = g.ledger_transaction_id
  where g.venue_id = p_venue_id and g.idempotency_key like 'bonus.hand:%' and t.created_by_user_id = p_user_id
    and t.occurred_at >= private.tonight_began(now());
$$;
revoke execute on function private.bonus_given_tonight(uuid, uuid) from public, anon, authenticated;

-- As in 20261109170000_give_bonus_chips.sql, for bonus.give and with the daily limit.
create or replace function private.give_bonus_chips(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
  v_key text := 'bonus.hand:' || p_request_id;
  v_is_retry boolean;
  v_cap bigint;
  v_is_capped boolean;
  v_staff uuid;
  v_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'bonus.give') then
    raise exception 'Only super admins, admins and floor managers add bonus chips' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never add bonus chips to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, 'promotions', p_member_id);
  v_cap := (private.setting_at(v_venue_id, 'bonus.daily_staff_cap', '', now()) ->> 'chips')::bigint;
  v_is_capped := v_cap is not null and not private.is_super_admin(v_venue_id);
  -- One person's additions wait for each other, so two at once, to different members, cannot both fit under the limit, and a
  -- retry that waited here finds the first one done.
  if v_is_capped then
    perform pg_advisory_xact_lock(hashtextextended('bonus.daily_cap:' || v_venue_id::text || ':' || (select auth.uid())::text, 0));
  end if;
  v_is_retry := exists (select 1 from public.bonus_grant g where g.venue_id = v_venue_id and g.idempotency_key = v_key);
  if v_is_capped and not v_is_retry
     and private.bonus_given_tonight(v_venue_id, (select auth.uid())) + p_chips::bigint * 100 > v_cap * 100 then
    v_staff := private.current_staff_id(v_venue_id);
    if not exists (select 1 from public.alert a where a.venue_id = v_venue_id and a.kind = 'bonus.daily_cap'
                   and a.detail ->> 'staff_id' = v_staff::text and a.created_at >= private.tonight_began(now())) then
      perform private.raise_alert(v_venue_id, 'bonus.daily_cap', jsonb_build_object('staff_id', v_staff, 'cap', v_cap));
    end if;
    return null;
  end if;
  v_id := private.credit_bonus(v_venue_id, p_member_id, p_chips::bigint * 100, btrim(p_reason), null, v_key);
  if not v_is_retry then
    perform private.audit(v_venue_id, 'bonus.give', 'member', p_member_id::text, null,
                          jsonb_build_object('chips', p_chips, 'bonus_grant_id', v_id), btrim(p_reason));
  end if;
  return v_id;
end;
$$;

-- As in 20261101130000_one_person_one_approval.sql, with bonus.give: a new login that adds bonus chips is a second count under the
-- limit, and could add them to the record of whoever made it, so the owner hears of each. Admins still appoint Floor staff.
create or replace function private.alert_dual_control_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.is_active
     and (tg_op = 'INSERT' or old.role is distinct from new.role or not old.is_active or old.phone is distinct from new.phone)
     and exists (select 1 from public.role_permission rp where rp.role = new.role
                 and rp.permission in ('treasury.manage', 'cage.second_approve', 'control.engage', 'promotions.manage', 'bonus.give')) then
    perform private.raise_alert(new.venue_id, 'staff.role_granted',
                                jsonb_build_object('staff_id', new.id, 'role', new.role, 'by_staff_id', private.current_staff_id(new.venue_id)));
  end if;
  return null;
end;
$$;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
