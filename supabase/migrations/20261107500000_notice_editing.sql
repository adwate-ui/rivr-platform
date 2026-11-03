-- Notices edited and formatted (owner, 3 Nov; decision 0424). A notice keeps its line breaks and may carry links, which
-- the app makes tappable: https only, and never with a user part (https://rivrpoker.com@elsewhere.example hides where it
-- goes). Up to 500 characters. Staff put one up with a start and an end, edit it in place while it is live or still to
-- come, and end it, or take it down before it starts; an ended notice is history. Every change reaches the audit log
-- through notice_audit, as before.

-- The body as stored: Windows line ends made plain; the invisible marks a link could hide behind taken out (the soft
-- hyphen, the zero-width space, direction marks, embeddings, overrides and isolates, the word joiner, the byte order mark),
-- as text pasted from a chat app can carry them unseen, while the joiners Hindi and emoji need stay; and blank space and
-- blank lines trimmed from both ends.
create function private.notice_body_of(p_body text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'\r\n?', E'\n', 'g'), '[\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]', '', 'g'), E' \t\n');
$$;
revoke execute on function private.notice_body_of(text) from public, anon;

-- Something besides blank space, at most 500 characters, every link https and without a user part, no control character,
-- and none of the marks notice_body_of takes out (should anything write the table directly). A browser skips any slashes
-- after https: and reads what comes before an @ as a user, so https:///rivrpoker.com@evil.example would go to
-- evil.example; a control mark before the @, or a right-to-left override, would let a link read as one site and go to
-- another.
alter table public.notice drop constraint notice_body_check,
  add constraint notice_body_check check (
    body ~ '\S' and length(body) <= 500 and body !~* 'http://'
    and body !~* 'https:[/\x5c]*[^/\x5c?#[:space:]]*@'
    and body !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]');

drop function public.post_notice(uuid, text);
drop function private.post_notice(uuid, text);

-- Puts up a notice from p_starts_at (now when null, never earlier) until p_ends_at (null: until ended). Refusals: 42501
-- not staff with settings.manage; 22023 the body breaks its rules, or it ends before it starts; RVFRZ the venue frozen.
create function private.post_notice(p_venue_id uuid, p_body text, p_starts_at timestamptz default null, p_ends_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz := greatest(coalesce(p_starts_at, now()), now());
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'settings.manage'), false) then
    raise exception 'Staff who manage settings put up notices' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_ends_at is not null and p_ends_at <= v_starts_at then
    raise exception 'A notice ends after it starts' using errcode = '22023';
  end if;
  insert into public.notice (venue_id, body, starts_at, ends_at, created_by_staff_id)
  values (p_venue_id, private.notice_body_of(p_body), v_starts_at, p_ends_at, private.current_staff_id(p_venue_id))
  returning id into v_id;
  return v_id;
exception
  when check_violation then
    raise exception 'A notice of 1 to 500 characters, any link https' using errcode = '22023';
end;
$$;

-- Edits a notice in force or still to come, in place: its words, its end (null: until ended) and, while it has not
-- begun, its start (never earlier than now; null keeps it). A live notice keeps its start. Refusals: 42501 no such notice
-- or not staff with settings.manage at its venue; P0002 it has ended; 22023 as post_notice; RVFRZ the venue frozen.
create function private.update_notice(p_notice_id uuid, p_body text, p_starts_at timestamptz default null, p_ends_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select n.venue_id from public.notice n where n.id = p_notice_id);
  v_notice public.notice;
  v_starts_at timestamptz;
begin
  if v_venue_id is null or not coalesce(private.has_permission(v_venue_id, 'settings.manage'), false) then
    raise exception 'Staff who manage settings edit notices' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  -- Locked only once the caller may change it, as end_notice does; taken down meanwhile, it is gone (P0002).
  select * into v_notice from public.notice n where n.id = p_notice_id for update;
  if v_notice.id is null then
    raise exception 'The notice was taken down' using errcode = 'P0002';
  end if;
  if v_notice.ends_at is not null and v_notice.ends_at <= now() then
    raise exception 'An ended notice is not edited' using errcode = 'P0002';
  end if;
  v_starts_at := case when v_notice.starts_at > now() then greatest(coalesce(p_starts_at, v_notice.starts_at), now())
                      else v_notice.starts_at end;
  if p_ends_at is not null and p_ends_at <= greatest(v_starts_at, now()) then
    raise exception 'A notice ends after it starts, and after now' using errcode = '22023';
  end if;
  update public.notice set body = private.notice_body_of(p_body), starts_at = v_starts_at, ends_at = p_ends_at
  where id = p_notice_id;
exception
  when check_violation then
    raise exception 'A notice of 1 to 500 characters, any link https' using errcode = '22023';
end;
$$;

-- Ends a notice at once, as before (20261102090100_notices.sql); one still to come, which cannot end before it starts,
-- is withdrawn instead, and the audit log keeps it. Refusals: 42501 not staff with settings.manage at its venue; RVFRZ
-- the venue frozen.
create or replace function private.end_notice(p_notice_id uuid)
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
  delete from public.notice where id = p_notice_id and starts_at >= now();
end;
$$;

create function public.post_notice(p_venue_id uuid, p_body text, p_starts_at timestamptz default null, p_ends_at timestamptz default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.post_notice(p_venue_id, p_body, p_starts_at, p_ends_at); $$;
create function public.update_notice(p_notice_id uuid, p_body text, p_starts_at timestamptz default null, p_ends_at timestamptz default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.update_notice(p_notice_id, p_body, p_starts_at, p_ends_at); $$;

revoke execute on function private.post_notice(uuid, text, timestamptz, timestamptz), private.update_notice(uuid, text, timestamptz, timestamptz),
  public.post_notice(uuid, text, timestamptz, timestamptz), public.update_notice(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function private.post_notice(uuid, text, timestamptz, timestamptz), private.update_notice(uuid, text, timestamptz, timestamptz),
  public.post_notice(uuid, text, timestamptz, timestamptz), public.update_notice(uuid, text, timestamptz, timestamptz) to authenticated;
