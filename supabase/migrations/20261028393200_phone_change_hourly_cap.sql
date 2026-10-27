-- Phone changes (#545, from the #502 review): at most ten an hour per venue (RVRAT), as erasure. As before
-- (20261028390100_member_phone_change.sql), with the cap before the change.
create or replace function private.change_member_phone(p_member_id uuid, p_phone text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_phone text := btrim(coalesce(p_phone, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.change_phone') then
    raise exception 'Only a super admin changes a member''s number' using errcode = '42501';
  end if;
  if v_member.erased_at is not null then
    raise exception 'This member was erased' using errcode = 'RVERD';
  end if;
  if v_phone !~ '^\+91[6-9][0-9]{9}$' or not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'An Indian mobile number (+91 and ten digits), and a reason of 3 to 300 characters with nothing of the person in it'
      using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if v_member.user_id is not null
     and (exists (select 1 from public.staff s where s.user_id = v_member.user_id)
          or exists (select 1 from public.device d where d.auth_user_id = v_member.user_id)) then
    raise exception 'This member''s login is also a staff member''s: change it where staff are kept' using errcode = 'RVSTF';
  end if;
  if v_phone = v_member.phone then
    return;
  end if;
  -- Auth keeps the number without its plus.
  if exists (select 1 from public.member m where m.venue_id = v_member.venue_id and m.phone = v_phone)
     or exists (select 1 from auth.users u where u.phone = substr(v_phone, 2) and u.id is distinct from v_member.user_id) then
    raise exception 'That number belongs to another member or login' using errcode = 'RVPHN';
  end if;
  -- Ten changes an hour per venue at most, as erasure (#545): each one alerts the owner already.
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.change_phone' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten numbers were changed in the last hour: wait before changing another' using errcode = 'RVRAT';
  end if;
  update public.member set phone = v_phone where id = v_member.id;
  if v_member.user_id is not null then
    update auth.users set phone = substr(v_phone, 2), phone_confirmed_at = now(), phone_change = '', phone_change_token = '', updated_at = now()
    where id = v_member.user_id;
    update auth.identities set identity_data = jsonb_set(identity_data, '{phone}', to_jsonb(substr(v_phone, 2))), updated_at = now()
    where user_id = v_member.user_id and provider = 'phone';
    -- Every session of the login ends (its refresh tokens with it), so a lost or stolen phone is signed out. A token
    -- already issued lasts until it expires, within the hour.
    delete from auth.sessions where user_id = v_member.user_id;
  end if;
  -- The audit row names the change, not the numbers: the member row's own audit has those.
  perform private.audit(v_member.venue_id, 'member.change_phone', 'member', v_member.id::text, null, null, v_reason);
  perform private.raise_alert(v_member.venue_id, 'member.phone_changed', jsonb_build_object('member_number', v_member.member_number));
end;
$$;
