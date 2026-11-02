-- Notices (owner, 2 Nov; decision 0298): a short line the club puts at the top of members' Home, such as "We're
-- launching soon", written and ended from the console's Settings by staff with settings.manage, without a release.
-- Every member reads their club's live notices (notices.view is not gated by tier). The first is the launch notice,
-- ending when the club opens; the practice venue gets none.
insert into public.feature (key, name, description, screens, is_gateable) values
  ('notices.view', 'Notices', 'The club''s notices at the top of Home, such as when it opens.', '{player:home}', false);

create table public.notice (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  body text not null check (length(btrim(body)) between 1 and 280),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
comment on table public.notice is 'A line the club shows at the top of members'' Home from starts_at until ends_at (decision 0298).';
create index notice_venue_idx on public.notice (venue_id, starts_at);
create index notice_created_by_idx on public.notice (created_by_staff_id);

create trigger notice_touch_updated_at before update on public.notice for each row execute function private.touch_updated_at();
create trigger notice_audit after insert or update or delete on public.notice for each row execute function private.audit_row_change();

-- Read and written through the functions below only.
alter table public.notice enable row level security;

-- The member's club's notices in force now, newest first (notices.view).
create function private.my_notices()
returns table (notice_id uuid, body text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.body
  from public.notice n
  where n.venue_id = private.current_member_venue_id() and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
    and private.has_feature(private.current_member_id(), 'notices.view')
  order by n.starts_at desc;
$$;

-- The venue's notices in force or still to come, for staff with settings.manage.
create function private.venue_notices(p_venue_id uuid)
returns table (notice_id uuid, body text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.body, n.starts_at, n.ends_at
  from public.notice n
  where n.venue_id = p_venue_id and private.has_permission(p_venue_id, 'settings.manage') and (n.ends_at is null or n.ends_at > now())
  order by n.starts_at desc;
$$;

-- Puts up a notice from now, until p_ends_at or until it is ended. Refusals: 42501 not staff with settings.manage;
-- 22023 empty, longer than 280 characters, or an end already past; RVFRZ the venue frozen.
create function private.post_notice(p_venue_id uuid, p_body text, p_ends_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'settings.manage'), false) then
    raise exception 'Staff who manage settings put up notices' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.notice (venue_id, body, ends_at, created_by_staff_id)
  values (p_venue_id, btrim(coalesce(p_body, '')), p_ends_at, private.current_staff_id(p_venue_id))
  returning id into v_id;
  return v_id;
exception
  when check_violation then
    raise exception 'A notice of 1 to 280 characters, ending later than now' using errcode = '22023';
end;
$$;

-- Ends a notice at once. Refusals: 42501 not staff with settings.manage at its venue; RVFRZ the venue frozen.
create function private.end_notice(p_notice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select n.venue_id from public.notice n where n.id = p_notice_id);
begin
  if v_venue_id is null or not coalesce(private.has_permission(v_venue_id, 'settings.manage'), false) then
    raise exception 'Staff who manage settings end notices' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  update public.notice set ends_at = now()
  where id = p_notice_id and (ends_at is null or ends_at > now()) and starts_at < now();
end;
$$;

create function public.my_notices()
returns table (notice_id uuid, body text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_notices(); $$;
create function public.venue_notices(p_venue_id uuid)
returns table (notice_id uuid, body text, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_notices(p_venue_id); $$;
create function public.post_notice(p_venue_id uuid, p_body text, p_ends_at timestamptz default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.post_notice(p_venue_id, p_body, p_ends_at); $$;
create function public.end_notice(p_notice_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.end_notice(p_notice_id); $$;

revoke execute on function private.my_notices(), private.venue_notices(uuid), private.post_notice(uuid, text, timestamptz),
  private.end_notice(uuid), public.my_notices(), public.venue_notices(uuid), public.post_notice(uuid, text, timestamptz),
  public.end_notice(uuid) from public, anon;
grant execute on function private.my_notices(), private.venue_notices(uuid), private.post_notice(uuid, text, timestamptz),
  private.end_notice(uuid), public.my_notices(), public.venue_notices(uuid), public.post_notice(uuid, text, timestamptz),
  public.end_notice(uuid) to authenticated;

-- The launch notice, until the club opens on Sunday 15 November.
insert into public.notice (venue_id, body, starts_at, ends_at)
select v.id, 'We''re launching soon. RIVR opens on Sunday 15 November.', now(), '2026-11-15T00:00:00+05:30'
from public.venue v
where not v.is_practice and now() < '2026-11-15T00:00:00+05:30';
