-- Member erasure (#424; decision 0207): the KYC files, and seeds.
-- * The console erases through the database itself: erasing is admin-computer work (decision 0110), and only the
--   browser's own request carries the computer and its network. The member-erase Edge Function then removes the
--   erased member's KYC folder with the service role. private.erased_member_kyc_folder names that folder, asked as
--   the caller, for an erased member and an active super admin of their venue only, so the function removes
--   nothing else and tells no one else who was erased. It asks the role, not the computer: the erasure, which
--   needs the admin computer, is already made. The erase section's preview counts the files still there, so
--   removing them can be asked again, after a failure or a restore.
-- * Staging runs every seed file on every deploy, and a seed's KYC row for a member a tester erased there would
--   stop the deploy. With no request at all (a seed, a job) the row is skipped; a person or a service is refused.

-- As before (20261027130000_member_erasure.sql), skipping a write that comes with no request.
create or replace function private.refuse_erased_member_kyc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(private.purging(new.venue_id), false)
     or not exists (select 1 from public.member m where m.id = new.member_id and m.erased_at is not null) then
    return new;
  end if;
  if (select auth.role()) is null then
    return null;
  end if;
  raise exception 'This member was erased' using errcode = 'RVERD';
end;
$$;

-- As before (20261027130000_member_erasure.sql), with the KYC files still in Storage.
drop function public.member_erasure_preview(uuid);
drop function private.member_erasure_preview(uuid);
create function private.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz, kyc_files integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.points')), 0),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r),
         (select count(*)::integer from storage.objects o
          where o.bucket_id = 'kyc' and o.name like m.venue_id::text || '/' || m.id::text || '/%')
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$$;
create function public.member_erasure_preview(p_member_id uuid)
returns table (is_erased boolean, blockers text[], points bigint, bonus_paise bigint, blocked_until timestamptz, kyc_files integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_erasure_preview(p_member_id); $$;

-- An erased member's KYC folder in Storage (<venue>/<member>/), for the member-erase Edge Function to remove,
-- asked by an active super admin of their venue (their role, as private.can_grant_role asks it, not the computer);
-- null for anyone else, and for a member not erased.
create function private.erased_member_kyc_folder(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.venue_id::text || '/' || m.id::text || '/'
  from public.member m
  where m.id = p_member_id and m.erased_at is not null
    and exists (select 1 from public.staff s
                where s.user_id = (select auth.uid()) and s.venue_id = m.venue_id and s.is_active and s.role = 'super_admin'
                  and not exists (select 1 from public.control_state c
                                  where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null));
$$;
create function public.erased_member_kyc_folder(p_member_id uuid)
returns text
language sql stable security invoker set search_path = ''
as $$ select private.erased_member_kyc_folder(p_member_id); $$;

revoke execute on function private.member_erasure_preview(uuid), public.member_erasure_preview(uuid) from public, anon;
grant execute on function private.member_erasure_preview(uuid), public.member_erasure_preview(uuid) to authenticated;
revoke execute on function private.erased_member_kyc_folder(uuid), public.erased_member_kyc_folder(uuid) from public, anon;
grant execute on function private.erased_member_kyc_folder(uuid), public.erased_member_kyc_folder(uuid) to authenticated;
