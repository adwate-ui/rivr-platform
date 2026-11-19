-- Resetting a member's hours takes a request id (#1015): a double submit, or a retry after a lost reply, wrote two
-- identical Activity lines. The console sends one id per reset; a call with an id already used answers with the moment
-- that reset set and writes nothing again. The id rides in the audit line's `after`, which the Activity screen does not
-- show, and is found there by the line's member (audit_log_entity_idx); the member's row lock makes two calls at once
-- take turns, so the second finds the first's line.
--
-- The function is as 20261118100300_member_hours_reset.sql left it (the live definition), with the id. A new argument,
-- so the two-argument versions go.

drop function public.reset_member_hours(uuid, text);
drop function private.reset_member_hours(uuid, text);

create function private.reset_member_hours(p_member_id uuid, p_reason text, p_request_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_reason text := trim(coalesce(p_reason, ''));
  v_at timestamptz := now();
  v_done timestamptz;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null or not coalesce(private.is_super_admin(v_member.venue_id), false) then
    raise exception 'Only a super admin resets a member''s hours' using errcode = '42501';
  end if;
  -- As a tier change and Bonus by hand: never on the staff member's own record.
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never reset the hours of their own record' using errcode = 'RVOWN';
  end if;
  if p_request_id is null or length(v_reason) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  -- A retry of a reset that went through: the moment it set, and nothing written again.
  select (a.after ->> 'hours_counted_from')::timestamptz into v_done
  from public.audit_log a
  where a.entity = 'member' and a.entity_id = p_member_id::text and a.action = 'member.hours_reset' and a.venue_id = v_member.venue_id
    and a.after ->> 'request_id' = p_request_id::text;
  if v_done is not null then
    return v_done;
  end if;
  perform private.assert_writable(v_member.venue_id, null, p_member_id);
  perform private.weigh_hours_steps(v.id, v_at) from public.visit v where v.member_id = p_member_id and v.closed_at is null;
  update public.member set hours_counted_from = v_at where id = p_member_id;
  perform private.audit(v_member.venue_id, 'member.hours_reset', 'member', p_member_id::text,
                        jsonb_build_object('hours_counted_from', v_member.hours_counted_from),
                        jsonb_build_object('hours_counted_from', v_at, 'request_id', p_request_id), v_reason);
  return v_at;
end;
$$;

create function public.reset_member_hours(p_member_id uuid, p_reason text, p_request_id uuid)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.reset_member_hours(p_member_id, p_reason, p_request_id); $$;

revoke execute on function private.reset_member_hours(uuid, text, uuid), public.reset_member_hours(uuid, text, uuid) from public, anon;
grant execute on function private.reset_member_hours(uuid, text, uuid), public.reset_member_hours(uuid, text, uuid) to authenticated;
