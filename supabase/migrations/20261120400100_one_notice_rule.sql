-- One rule for the notice that shows where there is room for one (redesign correction 20): the card above the offers on
-- a member's Home and the line along the foot of the TVs' boards. Of the notices in force the one that started last
-- shows; of two that started together, the one listed first. @rivr/domain noticeToShow is the rule, and this its twin,
-- proved on packages/testing/golden/noticeToShow.json (supabase/tests/024_golden_twins.test.sql). Until now Home chose
-- in the app and the TV in its own query, which could differ for two notices that started at the same moment.

-- The notices as a JSON list, each with its id and startsAt, in the order they are listed: the id of the one to show,
-- or null with none.
create function private.notice_to_show(p_notices jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select n.value ->> 'id'
  from jsonb_array_elements(coalesce(p_notices, '[]'::jsonb)) with ordinality as n (value, listed)
  order by (n.value ->> 'startsAt')::timestamptz desc, n.listed
  limit 1;
$$;
revoke execute on function private.notice_to_show(jsonb) from public, anon, authenticated;

-- A venue's notices in force now, as they are listed everywhere: the one that started last first, and of two that
-- started together the one made last.
create function private.notices_in_force(p_venue_id uuid)
returns table (notice_id uuid, body text, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.body, n.starts_at
  from public.notice n
  where n.venue_id = p_venue_id and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
  order by n.starts_at desc, n.created_at desc, n.id desc;
$$;
revoke execute on function private.notices_in_force(uuid) from public, anon, authenticated;

-- The member's club's notices in force, as 20261120300000 made the read, listed in that one order: Home's top slot shows
-- the one the rule picks from them.
create or replace function private.my_notices()
returns table (notice_id uuid, body text, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.notice_id, n.body, n.starts_at
  from private.notices_in_force(private.current_member_venue_id()) with ordinality as n (notice_id, body, starts_at, listed)
  where private.has_feature(private.current_member_id(), 'notices.view')
  order by n.listed;
$$;

-- The notice on a TV, as 20261120220000 made the read: its own venue's notice that the rule picks, or null with none
-- in force and for anyone who is not a paired TV.
create or replace function private.tv_notice()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select n.notice_id, n.body, n.starts_at, n.listed
    from private.notices_in_force((select private.current_tv_venue_id())) with ordinality as n (notice_id, body, starts_at, listed)
  )
  select l.body from listed l
  where l.notice_id::text = private.notice_to_show((select jsonb_agg(jsonb_build_object('id', x.notice_id, 'startsAt', x.starts_at) order by x.listed) from listed x));
$$;
