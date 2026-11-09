-- Staff see, correct, withdraw and publish again what members are shown (audit 8 Nov, F-027): every upcoming published
-- tournament, with how many asked, whether or not anybody has. Staff and members read one list.

-- When staff withdrew it: null for one never withdrawn, so a draft is not taken for one.
alter table public.tournament add column withdrawn_at timestamptz;

-- What members are shown at a venue, soonest first: the one list, read by staff whole and by Home, which shows its first twenty.
create function private.upcoming_published_tournaments(p_venue_id uuid)
returns setof public.tournament
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.tournament t
  where t.venue_id = p_venue_id and t.is_published and t.starts_at > now()
  order by t.starts_at;
$$;
revoke execute on function private.upcoming_published_tournaments(uuid) from public, anon, authenticated;

-- As 20261029160000_tournament_interest.sql made it, reading the one list.
create or replace function private.my_upcoming_tournaments()
returns table (tournament_id uuid, name text, starts_at timestamptz, standing text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at,
         case when i.registered_at is not null then 'registered' when i.id is not null then 'interested' else 'none' end
  from private.upcoming_published_tournaments(private.current_member_venue_id()) t
  left join public.tournament_interest i on i.tournament_id = t.id and i.member_id = private.current_member_id()
  where private.has_feature(private.current_member_id(), 'tournaments.register')
  order by t.starts_at
  limit 20;
$$;

-- The one list, and for staff two more kinds: one that has started, for the day the floor's list of who asked keeps it, so
-- whoever pays late can still be marked; and one withdrawn and still to come, to publish again.
create function private.published_tournaments(p_venue_id uuid)
returns table (tournament_id uuid, name text, starts_at timestamptz, game text, stake text, description text, is_published boolean, has_started boolean,
               interested integer, registered integer)
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select * from private.upcoming_published_tournaments(p_venue_id)
    union all
    select t.*
    from public.tournament t
    where t.venue_id = p_venue_id
      and ((t.is_published and t.starts_at <= now() and t.starts_at > now() - interval '1 day')
           or (t.withdrawn_at is not null and not t.is_published and t.starts_at > now()))
  )
  select l.id, l.name, l.starts_at, l.game, l.stake, l.description, l.is_published, l.starts_at <= now(),
         count(i.id)::integer, count(i.registered_at)::integer
  from listed l
  left join public.tournament_interest i on i.tournament_id = l.id
  where private.has_permission(p_venue_id, 'tournaments.manage')
  group by l.id, l.name, l.starts_at, l.game, l.stake, l.description, l.is_published
  order by l.starts_at;
$$;

create function private.edit_published_tournament(p_tournament_id uuid, p_name text, p_starts_at timestamptz, p_game text, p_stake text, p_description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id and t.is_published and t.starts_at > now());
begin
  perform private.assert_runs_tournaments(v_venue);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_starts_at <= now()
     or length(btrim(coalesce(p_game, ''))) not between 1 and 40 or length(btrim(coalesce(p_stake, ''))) not between 1 and 40
     or length(btrim(coalesce(p_description, ''))) > 500 then
    raise exception 'A name, a start to come, a game and a stake, and a description of 500 characters at most' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue);
  update public.tournament
  set name = btrim(p_name), starts_at = p_starts_at, game = btrim(p_game), stake = btrim(p_stake), description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_tournament_id;
end;
$$;

-- It leaves the members' list and the website's calendar, and stays on staff's, marked withdrawn, with those who asked.
create function private.withdraw_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id and t.is_published and t.starts_at > now());
begin
  perform private.assert_runs_tournaments(v_venue);
  perform private.assert_writable(v_venue);
  update public.tournament set is_published = false, withdrawn_at = now() where id = p_tournament_id;
end;
$$;

-- Withdrawing undone, while it is still to come.
create function private.publish_tournament_again(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id and t.withdrawn_at is not null and not t.is_published and t.starts_at > now());
begin
  perform private.assert_runs_tournaments(v_venue);
  perform private.assert_writable(v_venue);
  update public.tournament set is_published = true, withdrawn_at = null where id = p_tournament_id;
end;
$$;

create function public.published_tournaments(p_venue_id uuid)
returns table (tournament_id uuid, name text, starts_at timestamptz, game text, stake text, description text, is_published boolean, has_started boolean,
               interested integer, registered integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.published_tournaments(p_venue_id); $$;
create function public.edit_published_tournament(p_tournament_id uuid, p_name text, p_starts_at timestamptz, p_game text, p_stake text, p_description text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.edit_published_tournament(p_tournament_id, p_name, p_starts_at, p_game, p_stake, p_description); $$;
create function public.withdraw_tournament(p_tournament_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.withdraw_tournament(p_tournament_id); $$;
create function public.publish_tournament_again(p_tournament_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.publish_tournament_again(p_tournament_id); $$;

revoke execute on function private.published_tournaments(uuid), private.edit_published_tournament(uuid, text, timestamptz, text, text, text), private.withdraw_tournament(uuid),
  private.publish_tournament_again(uuid), public.published_tournaments(uuid), public.edit_published_tournament(uuid, text, timestamptz, text, text, text),
  public.withdraw_tournament(uuid), public.publish_tournament_again(uuid) from public, anon;
grant execute on function private.published_tournaments(uuid), private.edit_published_tournament(uuid, text, timestamptz, text, text, text), private.withdraw_tournament(uuid),
  private.publish_tournament_again(uuid), public.published_tournaments(uuid), public.edit_published_tournament(uuid, text, timestamptz, text, text, text),
  public.withdraw_tournament(uuid), public.publish_tournament_again(uuid) to authenticated;

-- As 20261110140050_members_cancel_their_order.sql made it, counting only those who asked about one still published: a
-- withdrawn tournament has nothing on the tab to act on.
create or replace function private.staff_queue_counts(p_venue_id uuid)
returns table (queue text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    ('timeRequests', (select count(*) from private.floor_seats(p_venue_id) s where s.time_request_id is not null)),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    -- A member's own cancellation, for a minute, so the console chimes: the bar may already hold its KOT.
    ('fnbCancelled', (select count(*) from private.fnb_orders_tonight(p_venue_id) o
                      where o.cancel_reason = 'Cancelled by the member' and o.cancelled_at > now() - interval '1 minute')),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    -- Approved players the floor can seat now (the owner, 8 Nov).
    ('seating', (select count(*) from private.seating_alerts(p_venue_id) a where a.state = 'ready')),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('rewards', (select count(*) from private.venue_redemptions(p_venue_id) r where r.handed_over_at is null)),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Calls not yet made: a call logged without an offer stays open, handled.
    ('hostQueue', (select count(*) from private.host_queue(p_venue_id) h where h.status = 'open' and h.handled_at is null)),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i
                            join public.tournament t on t.id = i.tournament_id
                            where i.registered_at is null and t.is_published))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;

-- As 20261101100500_role_modules.sql made it, and not on a withdrawn tournament, which a tab left open could otherwise still mark.
-- Refusals: 42501 not tournaments.manage at its venue; 22023 registered already, or withdrawn; RVFRZ the venue frozen.
create or replace function private.mark_tournament_registered(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interest public.tournament_interest;
begin
  select * into v_interest from public.tournament_interest i where i.id = p_interest_id for update;
  if v_interest.id is null or not private.has_permission(v_interest.venue_id, 'tournaments.manage') then
    raise exception 'Only staff who manage tournaments mark a member registered' using errcode = '42501';
  end if;
  if v_interest.registered_at is not null then
    raise exception 'Registered already' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tournament t where t.id = v_interest.tournament_id and t.is_published) then
    raise exception 'That tournament is withdrawn' using errcode = '22023';
  end if;
  perform private.assert_writable(v_interest.venue_id, 'tournament_registration', v_interest.member_id);
  update public.tournament_interest
  set registered_at = now(), registered_by_staff_id = private.current_staff_id(v_interest.venue_id)
  where id = v_interest.id;
end;
$$;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
