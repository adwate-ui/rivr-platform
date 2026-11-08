-- One own-record rule for every staff-on-member action (audit of 8 Nov 2026: F-115, F-128). Since staff may hold a member
-- record (20261109110000_staff_sign_up.sql), handing over a redemption refuses the staff member's own, and points by hand
-- match the staff member's record by phone as well as by login, through private.is_own_cage_record, as bonus chips and
-- call time already do.

-- As 20261028390600_a_cancelled_redemption_refunds.sql made it, refusing the staff member's own redemption.
create or replace function private.hand_over_redemption(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption public.redemption;
begin
  select * into v_redemption from public.redemption r where r.id = p_redemption_id for update;
  if v_redemption.id is null or not private.has_permission(v_redemption.venue_id, 'rewards.hand_over') then
    raise exception 'Only rewards.hand_over hands over a redemption' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_redemption.member_id) then
    raise exception 'Staff never hand over their own redemption' using errcode = 'RVOWN';
  end if;
  if v_redemption.cancelled_at is not null then
    raise exception 'That redemption was cancelled' using errcode = 'RVCNL';
  end if;
  if v_redemption.handed_over_at is not null then
    raise exception 'That redemption was handed over already' using errcode = 'RVHND';
  end if;
  perform private.assert_writable(v_redemption.venue_id, 'redemptions', v_redemption.member_id);
  update public.redemption set handed_over_at = now(), handed_over_by_staff_id = private.current_staff_id(v_redemption.venue_id)
  where id = v_redemption.id;
end;
$$;

-- As 20261101100200_points_by_hand.sql made it, with the shared own-record rule.
create or replace function private.points_member(p_member_id uuid, p_points bigint, p_reason text)
returns public.member
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  if not private.has_permission(v_member.venue_id, 'points.give') then
    raise exception 'Only staff who give points give points' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_member.id) then
    raise exception 'Nobody gives themselves points' using errcode = '42501';
  end if;
  if p_points is null or p_points not between 1 and 1000000 or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'Points are 1 to 1,000,000, with a reason of 3 to 200 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  return v_member;
end;
$$;
