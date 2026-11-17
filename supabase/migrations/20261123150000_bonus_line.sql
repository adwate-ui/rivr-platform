-- The Bonus card's line is the club's to write (#1065, the owner, 17 Nov): those who edit Content set it under Content >
-- App, up to 120 characters, and the member's Bonus card shows it before the expiry sentence, which stays automatic from
-- Settings. Null keeps the app's own line, "Use with your buy-in.". It lives on the venue's configuration, whose audit
-- trigger keeps every change in Activity, and is written only through the call below, which a freeze stops:
-- venue_config itself stays the super admins'.
alter table public.venue_config add column bonus_line text
  check (bonus_line is null or (bonus_line = btrim(bonus_line) and char_length(bonus_line) between 1 and 120));

-- The line as Content shows it to edit: null while the app's own is kept. For those who edit Content.
create function private.content_bonus_line(p_venue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'website.edit'), false) then
    raise exception 'Only those who edit Content read it here' using errcode = '42501';
  end if;
  return (select c.bonus_line from public.venue_config c where c.venue_id = p_venue_id);
end;
$$;

-- Content saves the line: trimmed, blank to keep the app's own, more than 120 characters refused. Returns what is kept.
create function private.set_content_bonus_line(p_venue_id uuid, p_line text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line text := nullif(btrim(coalesce(p_line, '')), '');
begin
  if not coalesce(private.has_permission(p_venue_id, 'website.edit'), false) then
    raise exception 'Only those who edit Content set the Bonus line' using errcode = '42501';
  end if;
  -- The table's own freeze guard checks only a person's direct writes; a call the database runs checks it here.
  perform private.assert_writable(p_venue_id);
  if char_length(v_line) > 120 then
    raise exception 'The Bonus line is 120 characters at most' using errcode = '22023';
  end if;
  update public.venue_config set bonus_line = v_line where venue_id = p_venue_id;
  return v_line;
end;
$$;

create function public.content_bonus_line(p_venue_id uuid)
returns text
language sql stable security invoker set search_path = ''
as $$ select private.content_bonus_line(p_venue_id); $$;
create function public.set_content_bonus_line(p_venue_id uuid, p_line text)
returns text
language sql security invoker set search_path = ''
as $$ select private.set_content_bonus_line(p_venue_id, p_line); $$;

revoke execute on function private.content_bonus_line(uuid), public.content_bonus_line(uuid),
  private.set_content_bonus_line(uuid, text), public.set_content_bonus_line(uuid, text) from public, anon;
grant execute on function private.content_bonus_line(uuid), public.content_bonus_line(uuid),
  private.set_content_bonus_line(uuid, text), public.set_content_bonus_line(uuid, text) to authenticated;

-- The signed-in member's Bonus in force, in paise. As 20261120300000_home_top_slot_and_bonus_line.sql made it, with the
-- club's line for the Bonus card (#1065): null keeps the app's own.
drop function public.my_bonus();
drop function private.my_bonus();
create function private.my_bonus()
returns table (bonus_paise bigint, expiry_days integer, bonus_line text)
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_in_force(m.id, now()), (select e.days from private.bonus_expiry(m.venue_id) e),
         (select c.bonus_line from public.venue_config c where c.venue_id = m.venue_id)
  from public.member m
  where m.id = private.current_member_id();
$$;
create function public.my_bonus()
returns table (bonus_paise bigint, expiry_days integer, bonus_line text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_bonus(); $$;

revoke execute on function private.my_bonus(), public.my_bonus() from public, anon;
grant execute on function private.my_bonus(), public.my_bonus() to authenticated;
