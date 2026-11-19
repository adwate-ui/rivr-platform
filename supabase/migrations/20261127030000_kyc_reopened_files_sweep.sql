-- The retry for a reopened desk check's files (#931). A reopening lists its face photo and two document photos to go, and the
-- console asks kyc-reopened-files to remove them at once; a file Storage did not remove stayed listed until a super admin
-- asked again or the member's next desk check. Now the kyc-reopened-sweep Edge Function, which pg_cron runs every five
-- minutes with the scheduler's secret as it runs the outbox consumers (decision 0038), removes what is still listed ten
-- minutes after its reopening, a hundred files a run at most, and has them forgotten. It reads and forgets them through the
-- two functions below, with the service role alone. A frozen venue's or member's files stay listed, as they do when a super
-- admin asks. Each listed path lies in its member's own folder (kyc_reopened_file_in_folder), so the sweep removes nothing else.

-- The files still listed ten minutes after their reopening, oldest first, a hundred at most; none of a frozen venue or member.
create function private.reopened_kyc_files_to_sweep()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s.path order by s.reopened_at, s.path), '{}')
  from (
    select f.path, f.reopened_at
    from private.kyc_reopened_file f
    where f.reopened_at < now() - interval '10 minutes'
      and not exists (select 1 from public.control_state c
                      where c.venue_id = f.venue_id and c.released_at is null
                        and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = f.member_id)))
    order by f.reopened_at, f.path
    limit 100
  ) s;
$$;

-- Forgets the swept files Storage removed, of those the sweep could have read. Returns how many it forgot.
create function private.forget_swept_kyc_files(p_paths text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Only what Storage no longer holds: a file it kept stays listed for the next run (security review of #1104).
  delete from private.kyc_reopened_file f where f.path = any (p_paths) and f.reopened_at < now() - interval '10 minutes'
    and not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = f.path);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.reopened_kyc_files_to_sweep()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$ select private.reopened_kyc_files_to_sweep(); $$;

create function public.forget_swept_kyc_files(p_paths text[])
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$ select private.forget_swept_kyc_files(p_paths); $$;

-- The sweep alone, with the service role: nobody signed in or out reads or forgets these.
revoke execute on function private.reopened_kyc_files_to_sweep(), private.forget_swept_kyc_files(text[]),
  public.reopened_kyc_files_to_sweep(), public.forget_swept_kyc_files(text[]) from public, anon, authenticated;
grant execute on function private.reopened_kyc_files_to_sweep(), private.forget_swept_kyc_files(text[]),
  public.reopened_kyc_files_to_sweep(), public.forget_swept_kyc_files(text[]) to service_role;

select private.schedule_outbox_consumer('kyc-reopened-sweep', '*/5 * * * *');
