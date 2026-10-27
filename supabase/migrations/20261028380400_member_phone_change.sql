-- A member's phone number is changed by a super admin, never by the member (#502; question #496 item 1, the owner's
-- answer of 27 Oct; decision 0248). The number is the member's login: whoever changes it can sign in as them. So only a
-- super admin changes it (members.change_phone), with a reason, the change is audited, and the owner is alerted. The
-- login's number changes with it, so the member signs in with the new number from then on. The sign-in hook
-- (supabase/functions/auth-send-code) refuses the code Auth would send for a member's own change through PUT /user.

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['members.change_phone']) as permission;

alter table public.role_permission drop constraint super_admin_only_permissions;
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage',
                        'members.erase', 'promotions.approve', 'members.change_phone')
);

-- Changes a member's number, and their login's. Refusals: 42501 not a super admin of the member's venue; 22023 a
-- number that is not an Indian mobile, or a reason of under 3 or over 300 characters; RVPHN another member of the
-- venue, or another login, holds the number; RVERD the member was erased; RVFRZ/RVMBR the venue or the member frozen.
create function private.change_member_phone(p_member_id uuid, p_phone text, p_reason text)
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
  if v_phone !~ '^\+91[6-9][0-9]{9}$' or length(v_reason) not between 3 and 300 then
    raise exception 'An Indian mobile number (+91 and ten digits) and a reason of 3 to 300 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if v_phone = v_member.phone then
    return;
  end if;
  -- Auth keeps the number without its plus.
  if exists (select 1 from public.member m where m.venue_id = v_member.venue_id and m.phone = v_phone)
     or exists (select 1 from auth.users u where u.phone = substr(v_phone, 2) and u.id is distinct from v_member.user_id) then
    raise exception 'That number belongs to another member or login' using errcode = 'RVPHN';
  end if;
  update public.member set phone = v_phone where id = v_member.id;
  if v_member.user_id is not null then
    update auth.users set phone = substr(v_phone, 2), phone_confirmed_at = now(), phone_change = '', phone_change_token = '', updated_at = now()
    where id = v_member.user_id;
    update auth.identities set identity_data = jsonb_set(identity_data, '{phone}', to_jsonb(substr(v_phone, 2))), updated_at = now()
    where user_id = v_member.user_id and provider = 'phone';
  end if;
  -- The audit row names the change, not the numbers: the member row's own audit has those.
  perform private.audit(v_member.venue_id, 'member.change_phone', 'member', v_member.id::text, null, null, v_reason);
  perform private.raise_alert(v_member.venue_id, 'member.phone_changed', jsonb_build_object('member_number', v_member.member_number));
end;
$$;

create function public.change_member_phone(p_member_id uuid, p_phone text, p_reason text)
returns void
language sql volatile security invoker set search_path = ''
as $$ select private.change_member_phone(p_member_id, p_phone, p_reason); $$;

revoke execute on function private.change_member_phone(uuid, text, text), public.change_member_phone(uuid, text, text) from public, anon;
grant execute on function private.change_member_phone(uuid, text, text), public.change_member_phone(uuid, text, text) to authenticated;
