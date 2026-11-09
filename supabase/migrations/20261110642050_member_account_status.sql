-- The members whose account is not simply active (8 Nov audit, I-74, F-121): erased, frozen by the kill switch, or on a break
-- until a day. Erased comes before frozen, and frozen before a break, as each is what stops them first. A member freeze is for
-- staff who engage controls alone, wherever it shows (#493 P5; 20261028130000_control_reasons_for_super_admins.sql), so anyone
-- else reads a frozen member as they otherwise stand.
create function private.member_account_statuses(p_venue_id uuid)
returns table (member_id uuid, status text, until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         case when m.erased_at is not null then 'erased' when f.is_frozen then 'frozen' else 'on_break' end,
         case when m.erased_at is null and not f.is_frozen then b.ends_at end
  from public.member m
  cross join lateral (select coalesce(private.has_permission(p_venue_id, 'control.engage'), false)
                             and exists (select 1 from public.control_state c
                                         where c.member_id = m.id and c.venue_id = m.venue_id and c.level = 'member_freeze' and c.released_at is null) as is_frozen) f
  cross join lateral (select max(s.ends_at) as ends_at from public.self_exclusion s where s.member_id = m.id and s.starts_at <= now() and s.ends_at > now()) b
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    and (m.erased_at is not null or f.is_frozen or b.ends_at is not null);
$$;

create function public.member_account_statuses(p_venue_id uuid)
returns table (member_id uuid, status text, until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_account_statuses(p_venue_id); $$;

revoke execute on function private.member_account_statuses(uuid), public.member_account_statuses(uuid) from public, anon;
grant execute on function private.member_account_statuses(uuid), public.member_account_statuses(uuid) to authenticated;
