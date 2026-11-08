-- A refused tier change says which field is wrong (audit F-071): the tier, the reason or the last day, each its own code.

CREATE OR REPLACE FUNCTION private.set_member_tier(p_venue_id uuid, p_member_id uuid, p_tier_id uuid, p_reason text, p_until date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from uuid;
  v_ends_at timestamptz := case when p_until is null then null else ((p_until + 1) + time '06:00') at time zone 'Asia/Kolkata' end;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'members.manage') then
    raise exception 'Only a member manager changes a tier' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Nobody changes their own member record''s tier' using errcode = 'RVOWN';
  end if;
  select m.tier_id into v_from from public.member m where m.id = p_member_id and m.venue_id = p_venue_id for update;
  if v_from is null then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if not exists (select 1 from public.tier t where t.id = p_tier_id and t.venue_id = p_venue_id and not t.is_retired) or p_tier_id = v_from then
    raise exception 'A different tier of this venue' using errcode = 'RVTTR';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'A reason of 3 to 500 characters' using errcode = 'RVTRE';
  end if;
  if v_ends_at is not null and v_ends_at <= now() then
    raise exception 'An end in the future' using errcode = 'RVTEN';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.member set tier_id = p_tier_id where id = p_member_id;
  insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, ends_at, changed_by_staff_id)
  values (p_venue_id, p_member_id, v_from, p_tier_id, btrim(p_reason), v_ends_at, private.current_staff_id(p_venue_id))
  returning id into v_id;
  return v_id;
end;
$function$;
