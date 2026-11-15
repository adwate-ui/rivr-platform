-- Player Home and Bonus (redesign of 15 Nov 2026, RD-20). Home has one card above the offers, which shows the notice
-- that started last (@rivr/domain/notices picks it), so a notice comes with when it started. The line under a member's
-- balance follows the venue's "Bonus expires" setting, so the balance comes with the days set. A new column on each; an
-- app built before this reads the columns it knows.

-- The member's club's notices in force now, newest first. As 20261102090100_notices.sql made it, with each one's start.
drop function public.my_notices();
drop function private.my_notices();
create function private.my_notices()
returns table (notice_id uuid, body text, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.body, n.starts_at
  from public.notice n
  where n.venue_id = private.current_member_venue_id() and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
    and private.has_feature(private.current_member_id(), 'notices.view')
  order by n.starts_at desc;
$$;
create function public.my_notices()
returns table (notice_id uuid, body text, starts_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_notices(); $$;

-- The signed-in member's Bonus in force, in paise. As 20261109090000_bonus_chips.sql made it, with the days Bonus lasts
-- at their venue (bonus.expiry_days as it is in force, decision 0579): null with none set, and 0 is never.
drop function public.my_bonus();
drop function private.my_bonus();
create function private.my_bonus()
returns table (bonus_paise bigint, expiry_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select private.bonus_in_force(m.id, now()), (select e.days from private.bonus_expiry(m.venue_id) e)
  from public.member m
  where m.id = private.current_member_id();
$$;
create function public.my_bonus()
returns table (bonus_paise bigint, expiry_days integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_bonus(); $$;

revoke execute on function private.my_notices(), public.my_notices(), private.my_bonus(), public.my_bonus() from public, anon;
grant execute on function private.my_notices(), public.my_notices(), private.my_bonus(), public.my_bonus() to authenticated;
