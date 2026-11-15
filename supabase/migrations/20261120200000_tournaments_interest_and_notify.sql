-- Tournaments are interest only (redesign of 15 Nov 2026, issue 969; docs/spec/redesign-2026-11-15.md slice 9; decision
-- 0630): the club creates one with a name, a start and a game, members ask to be told, staff send the notification once,
-- and a past tournament keeps how many entered. The old module goes: templates, blind structures, entries, purchases,
-- payouts and tickets, the clock's functions, the ticket-lapse job, and the cash limits that only a tournament purchase
-- still reached. Every function below that stays is as the newest migration before this one left it, less what named
-- the removed things.
--
-- What stays on purpose:
--   * the ledger's tournament accounts and private.day_tournament_fees, which the night's invoice reads: nothing can post
--     to them now, so the fee is always nothing;
--   * the audit log's rows of the dropped tables, and their names in private.is_shareable_audit_row;
--   * the website calendar's view, with its two money columns always empty.

-- A tournament purchase or payout at the club is a record of money taken or paid: such a record carries a duty to keep
-- it, and a person decides what becomes of it. One made since the club's fresh start of 12 Nov is real and stops the
-- migration; older ones are staging's test rows (one purchase of 28 Oct, read 15 Nov 2026) and go with the tables, as
-- 20261117210000_card_social_cage_and_older_screens_removed.sql took a high hand and a marker. Production has no
-- tournament, interest, entry, purchase, payout or ticket at all (read 15 Nov 2026).
do $$
begin
  if exists (select 1 from public.tournament_purchase p join public.venue v on v.id = p.venue_id
             where not v.is_practice and p.created_at >= '2026-11-12 00:00+05:30')
     or exists (select 1 from public.tournament_payout p join public.venue v on v.id = p.venue_id
                where not v.is_practice and p.created_at >= '2026-11-12 00:00+05:30') then
    raise exception 'The club holds a tournament purchase or payout made since 12 Nov, a record of money taken or paid: decide what becomes of it before the tournament module goes';
  end if;
end;
$$;

select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'tournament-ticket-lapse';

drop trigger tournament_starting on public.tournament;
drop trigger tournament_tv_signal on public.tournament;
drop trigger tournament_tv_signal_change on public.tournament;

drop function public.mark_tournament_registered(uuid);
drop function public.unmark_tournament_registered(uuid);
drop function public.edit_published_tournament(uuid, text, timestamptz, text, text, text);
drop function public.publish_tournament_again(uuid);
drop function public.published_tournaments(uuid);
drop function public.tournament_interest_list(uuid);
drop function public.publish_tournament(uuid, text, timestamptz, text, text, text);
drop function public.my_tonight();
drop function private.mark_tournament_registered(uuid);
drop function private.unmark_tournament_registered(uuid);
drop function private.edit_published_tournament(uuid, text, timestamptz, text, text, text);
drop function private.publish_tournament_again(uuid);
drop function private.published_tournaments(uuid);
drop function private.publish_tournament(uuid, text, timestamptz, text, text, text);
drop function private.my_tonight();
drop function private.lapse_tournament_tickets();

-- The tables of the old module, with their triggers and policies.
drop table public.tournament_ticket;
drop table public.tournament_payout;
drop table public.tournament_purchase;
drop table public.tournament_entry;

-- What only those tables' triggers ran, and the cash limits, which a tournament purchase was the last to reach.
drop function private.emit_tournament_starting();
drop function private.signal_tournament_change();
drop function private.refuse_after_finish();
drop function private.enforce_cash_limits();
drop function private.assert_cash_within_limits(uuid, uuid, bigint);
drop function private.aml_cash_in(uuid, uuid, timestamptz);
drop function private.cash_limit_hit(bigint, bigint, bigint, bigint, bigint);
drop function private.tournament_level_now(public.tournament);
drop function private.tournament_clock_at(jsonb, integer);
drop function private.tournament_elapsed(timestamptz, timestamptz, interval, timestamptz);

-- A tournament keeps its name, start, game and whether members see it. Constraints and indexes on a dropped column go with it.
alter table public.tournament
  drop column buy_in_paise, drop column guarantee_paise, drop column template_id, drop column format, drop column fee_paise,
  drop column starting_stack, drop column levels, drop column last_registration_level, drop column max_buys, drop column add_on_paise,
  drop column add_on_fee_paise, drop column add_on_chips, drop column places_paid, drop column clock_started_at, drop column clock_paused_at,
  drop column clock_shift, drop column tables, drop column seats_per_table, drop column bounty_paise, drop column bounty_kind,
  drop column payout_shares, drop column finished_at, drop column overlay_paise, drop column deal_method, drop column deal_stacks,
  drop column satellite_target_id, drop column day_two_id, drop column stake, drop column description;

drop table public.tournament_template;
drop table public.blind_structure;
drop function private.blind_levels_problem(jsonb);
drop function private.tournament_shares_whole(integer[]);

-- When the notification went, to how many and who sent it; and how many entered, typed once it has started.
alter table public.tournament
  add column notified_at timestamptz,
  add column notified_count integer,
  add column notified_by_staff_id uuid,
  add column entries integer,
  add constraint tournament_notified_whole
    check ((notified_at is null) = (notified_count is null) and (notified_at is null) = (notified_by_staff_id is null)),
  add constraint tournament_notified_count_check check (notified_count >= 1),
  add constraint tournament_entries_check check (entries between 0 and 100000),
  add constraint tournament_notified_by_fkey foreign key (notified_by_staff_id, venue_id) references public.staff (id, venue_id);
create index tournament_notified_by_idx on public.tournament (notified_by_staff_id, venue_id);

-- Nobody is registered any more: a member asks to be told, and that is all.
alter table public.tournament_interest drop column registered_at, drop column registered_by_staff_id;

-- A member's export lists no column that went.
delete from private.member_export_column c
where c.table_name in ('tournament_entry', 'tournament_purchase', 'tournament_payout', 'tournament_ticket')
   or (c.table_name = 'tournament_interest' and c.column_name in ('registered_at', 'registered_by_staff_id'));

-- As 20261117210000_card_social_cage_and_older_screens_removed.sql left it: with no tournament payout, no member's KYC
-- record is held for a tax deduction.
create or replace function private.anonymise_member(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.consent c set withdrawn_at = now() where c.member_id = p_member.id and c.withdrawn_at is null;
  delete from public.kyc_record k where k.member_id = p_member.id;
  update public.member m
  set full_name = 'Erased member', known_as = null, phone = null, user_id = null, qualifying_small_blind = null,
      qualifying_big_blind = null, erased_at = coalesce(m.erased_at, now())
  where m.id = p_member.id
    and (m.full_name <> 'Erased member' or m.known_as is not null or m.phone is not null or m.user_id is not null
         or m.qualifying_small_blind is not null or m.erased_at is null);
end;
$$;

-- As it was, less a place in a tournament or a held ticket, which nobody can have.
create or replace function private.member_erasure_blockers(p_member_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0) then 'markers' end,
    -- Bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code = 'member.bonus' and b.amount > 0) then 'bonus' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$$;

-- As it was, less a tournament entry as a sign of history.
create or replace function private.store_reviewer_has_history(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.venue v on not v.is_practice
    where u.id::text = p_user_id
      and private.setting_at(v.id, 'auth.store_reviewer', '', now()) ->> 'phone' = '+' || u.phone
      and (exists (select 1 from public.staff s where s.user_id = u.id or s.phone = '+' || u.phone)
           or exists (select 1 from public.member m
                      where m.venue_id = v.id and m.phone = '+' || u.phone
                        and (exists (select 1 from public.visit x where x.member_id = m.id)
                             or exists (select 1 from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
                                        where a.member_id = m.id))))
  );
$$;

-- As it was, less the count of members waiting to be marked registered: nothing about a tournament waits on staff now.
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
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;
drop function private.tournament_interest_list(uuid);

-- Home's tonight, less the next tournament's buy-in and guarantee: Home lists the tournaments from my_upcoming_tournaments.
create function private.my_tonight()
returns table (is_kyc_complete boolean, jackpot_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_kyc_complete(me.member_id),
         case when private.has_feature(me.member_id, 'floor.live_view') then private.main_pool(me.venue_id) end
  from (select private.current_member_id() as member_id, private.current_member_venue_id() as venue_id) me
  where me.member_id is not null;
$$;
create function public.my_tonight()
returns table (is_kyc_complete boolean, jackpot_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tonight(); $$;
revoke execute on function private.my_tonight(), public.my_tonight() from public, anon;
grant execute on function private.my_tonight(), public.my_tonight() to authenticated;

-- The website's calendar keeps its columns; a tournament has no buy-in or guarantee to show.
create or replace function private.public_tournament_calendar_rows()
returns table (venue_slug text, name text, starts_at timestamptz, buy_in_paise bigint, guarantee_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, t.name, t.starts_at, null::bigint, null::bigint
  from public.tournament t join public.venue v on v.id = t.venue_id
  where t.is_published and not v.is_practice and t.starts_at >= now() - interval '12 hours';
$$;

-- As 20261110600050_published_tournaments_for_staff.sql made it: asked, or not.
create or replace function private.my_upcoming_tournaments()
returns table (tournament_id uuid, name text, starts_at timestamptz, standing text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at, case when i.id is not null then 'interested' else 'none' end
  from private.upcoming_published_tournaments(private.current_member_venue_id()) t
  left join public.tournament_interest i on i.tournament_id = t.id and i.member_id = private.current_member_id()
  where private.has_feature(private.current_member_id(), 'tournaments.register')
  order by t.starts_at
  limit 20;
$$;

-- Whether a member who asked about a tournament is told of it: not erased, not on a break, their tier has tournaments, and
-- their own Tournaments switch in Profile is on. One rule for the notification staff send and for a withdrawal or a move.
create function private.hears_of_tournaments(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.member m where m.id = p_member_id and m.erased_at is null)
    and (select r.break_until from private.member_restrictions(p_member_id, now()) r) is null
    and private.has_feature(p_member_id, 'tournaments.register')
    and private.wants_push(p_member_id, 'push.tournament_starting');
$$;
revoke execute on function private.hears_of_tournaments(uuid) from public, anon, authenticated;

-- As 20261110653000_tournament_changes_told.sql made it, telling whoever hears of tournaments: nobody has paid for a place now.
create or replace function private.tell_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice text;
  -- The name they asked about, if this change also renames it.
  v_params jsonb := jsonb_build_array(private.tournament_name_for_members(old.name));
begin
  -- Only what members could see and has not started.
  if not old.is_published or old.starts_at <= now() then
    return null;
  end if;
  if not new.is_published then
    v_notice := 'tournament_withdrawn';
  elsif date_trunc('minute', new.starts_at) <> date_trunc('minute', old.starts_at)
        and isfinite(new.starts_at) and new.starts_at < now() + interval '5 years' then
    v_notice := 'tournament_moved';
    v_params := v_params || to_jsonb(to_jsonb(new.starts_at) #>> '{}');
  else
    return null;
  end if;
  -- Three changes told in an hour is the most, so saving again and again cannot flood members or hold up seat calls in the queue. Refused,
  -- not dropped, so a real change is never lost without staff knowing.
  if (select count(distinct e.occurred_at) from public.outbox_event e
      where e.venue_id = new.venue_id and e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = new.id::text
        and e.occurred_at > now() - interval '1 hour') >= 3 then
    raise exception 'Members were told of this tournament three times in the last hour' using errcode = 'RVRAT';
  end if;
  perform private.emit(i.venue_id, 'member.notice',
    jsonb_build_object('member_id', i.member_id, 'tournament_id', i.tournament_id, 'notice', v_notice, 'params', v_params),
    'member.notice:' || v_notice || ':' || i.tournament_id || ':' || i.member_id || ':' || extract(epoch from now())::bigint)
  from public.tournament_interest i
  where i.tournament_id = new.id and private.hears_of_tournaments(i.member_id);
  return null;
end;
$$;

-- Creates an upcoming tournament (tournaments.manage): members see it at once. Returns its id.
-- Refusals: 42501 not tournaments.manage here; 22023 no name, game or start to come; RVFRZ the venue frozen.
create function private.publish_tournament(p_venue_id uuid, p_name text, p_starts_at timestamptz, p_game text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_runs_tournaments(p_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_starts_at <= now()
     or not isfinite(p_starts_at) or p_starts_at > now() + interval '5 years'
     or length(btrim(coalesce(p_game, ''))) not between 1 and 40 then
    raise exception 'A name, a start to come and a game' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.tournament (venue_id, name, starts_at, game, is_published)
  values (p_venue_id, btrim(p_name), p_starts_at, btrim(p_game), true)
  returning id into v_id;
  return v_id;
end;
$$;

-- The venue's tournaments as staff see them (tournaments.manage): every one to come, and the latest 200 that have started,
-- soonest first; how many asked, when the notification went and to how many, and the entries typed. A withdrawn one is gone.
create function private.venue_tournaments(p_venue_id uuid)
returns table (tournament_id uuid, name text, starts_at timestamptz, game text, is_past boolean, interested integer,
               notified_at timestamptz, notified integer, entries integer)
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select * from private.upcoming_published_tournaments(p_venue_id)
    union all
    (select t.* from public.tournament t
     where t.venue_id = p_venue_id and t.is_published and t.starts_at <= now()
     order by t.starts_at desc
     limit 200)
  )
  select l.id, l.name, l.starts_at, l.game, l.starts_at <= now(),
         (select count(*) from public.tournament_interest i where i.tournament_id = l.id)::integer,
         l.notified_at, l.notified_count, l.entries
  from listed l
  where private.has_permission(p_venue_id, 'tournaments.manage')
  order by l.starts_at;
$$;

-- Who asked to be told of one tournament (tournaments.manage), the latest first.
create function private.tournament_interested(p_tournament_id uuid)
returns table (member_id uuid, full_name text, member_number bigint, asked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, m.member_number, i.created_at
  from public.tournament_interest i
  join public.member m on m.id = i.member_id
  where i.tournament_id = p_tournament_id and private.has_permission(i.venue_id, 'tournaments.manage')
  order by i.created_at desc, m.member_number
  limit 1000;
$$;

-- Staff send the notification, once: one member.notice to each member who asked and hears of tournaments, which the push
-- and WhatsApp consumers read (the practice venue's events reach neither). Returns how many were told.
-- Refusals: 42501 not tournaments.manage at its venue; 22023 not to come, withdrawn, or notified already; RVNOB nobody who
-- asked hears of tournaments, and the one send is kept; RVFRZ the venue frozen.
create function private.notify_tournament(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament;
  v_member_id uuid;
  v_count integer := 0;
begin
  select * into v_tournament from public.tournament t where t.id = p_tournament_id for update;
  perform private.assert_runs_tournaments(v_tournament.venue_id);
  if not v_tournament.is_published or v_tournament.starts_at <= now() or v_tournament.notified_at is not null then
    raise exception 'A tournament to come, not yet notified' using errcode = '22023';
  end if;
  perform private.assert_writable(v_tournament.venue_id);
  for v_member_id in
    select i.member_id from public.tournament_interest i
    where i.tournament_id = v_tournament.id and private.hears_of_tournaments(i.member_id)
    order by i.created_at
  loop
    perform private.emit(v_tournament.venue_id, 'member.notice',
      jsonb_build_object('member_id', v_member_id, 'tournament_id', v_tournament.id, 'notice', 'tournament_starts',
                         'params', jsonb_build_array(private.tournament_name_for_members(v_tournament.name),
                                                     to_jsonb(v_tournament.starts_at) #>> '{}')),
      'member.notice:tournament_starts:' || v_tournament.id || ':' || v_member_id);
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then
    raise exception 'Nobody who asked has tournament notifications on' using errcode = 'RVNOB';
  end if;
  update public.tournament
  set notified_at = now(), notified_count = v_count, notified_by_staff_id = private.current_staff_id(v_tournament.venue_id)
  where id = v_tournament.id;
  return v_count;
end;
$$;

-- How many entered a tournament that has started, typed by staff: no entry is recorded as it is made.
-- Refusals: 42501 not tournaments.manage at its venue, or no such tournament started; 22023 not 0 to 100,000; RVFRZ frozen.
create function private.set_tournament_entries(p_tournament_id uuid, p_entries integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id and t.is_published and t.starts_at <= now());
begin
  perform private.assert_runs_tournaments(v_venue);
  if p_entries is null or p_entries not between 0 and 100000 then
    raise exception 'Entries from 0 to 100,000' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue);
  update public.tournament set entries = p_entries where id = p_tournament_id;
end;
$$;

create function public.publish_tournament(p_venue_id uuid, p_name text, p_starts_at timestamptz, p_game text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.publish_tournament(p_venue_id, p_name, p_starts_at, p_game); $$;
create function public.venue_tournaments(p_venue_id uuid)
returns table (tournament_id uuid, name text, starts_at timestamptz, game text, is_past boolean, interested integer,
               notified_at timestamptz, notified integer, entries integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_tournaments(p_venue_id); $$;
create function public.tournament_interested(p_tournament_id uuid)
returns table (member_id uuid, full_name text, member_number bigint, asked_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tournament_interested(p_tournament_id); $$;
create function public.notify_tournament(p_tournament_id uuid)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.notify_tournament(p_tournament_id); $$;
create function public.set_tournament_entries(p_tournament_id uuid, p_entries integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_entries(p_tournament_id, p_entries); $$;

revoke execute on function private.publish_tournament(uuid, text, timestamptz, text), private.venue_tournaments(uuid), private.tournament_interested(uuid),
  private.notify_tournament(uuid), private.set_tournament_entries(uuid, integer), public.publish_tournament(uuid, text, timestamptz, text),
  public.venue_tournaments(uuid), public.tournament_interested(uuid), public.notify_tournament(uuid), public.set_tournament_entries(uuid, integer)
  from public, anon;
grant execute on function private.publish_tournament(uuid, text, timestamptz, text), private.venue_tournaments(uuid), private.tournament_interested(uuid),
  private.notify_tournament(uuid), private.set_tournament_entries(uuid, integer), public.publish_tournament(uuid, text, timestamptz, text),
  public.venue_tournaments(uuid), public.tournament_interested(uuid), public.notify_tournament(uuid), public.set_tournament_entries(uuid, integer)
  to authenticated;

-- Sessions, as 20261118100100_stake_reads_carry_the_straddle.sql left them, with a tournament as it now is:
-- each past tournament the member asked to be told of, on its day, with the entries staff typed. Who played is recorded
-- nowhere, so it has no place and no time, and a month's sessions and hours count cash sessions alone (decision 0630).
create or replace function private.my_sessions()
returns table (session_id uuid, visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint,
               paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint,
               month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer, straddle_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v
    where v.member_id = private.current_member_id() and v.closed_at is not null
      and private.has_feature(v.member_id, 'sessions.history')
  ),
  played as (
    select m.id as visit_id, t.o_table_id as table_id, sum(t.o_played)::bigint as seconds
    from mine m
    cross join lateral private.visit_table_time(m.id) t
    group by m.id, t.o_table_id
  ),
  -- When the member sat at each table that visit: from their first seat there to the last time they left it (a move
  -- keeps one seat session across tables; private.session_tables splits it).
  stints as (
    select m.id as visit_id, t.o_table_id as table_id, min(greatest(t.o_from, m.opened_at)) as opened_at,
           max(least(t.o_to, m.closed_at)) as closed_at
    from mine m
    join public.seat_session s on s.visit_id = m.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < m.closed_at
    group by m.id, t.o_table_id
  ),
  -- Each table a session of its own (the owner, 9 Nov). A table sat at for under a minute in a visit of more than one
  -- (a move made by mistake and undone) is none, but a visit always keeps the table it was played at longest.
  kept as (
    select st.visit_id, st.table_id, st.opened_at, st.closed_at, coalesce(p.seconds, 0)::bigint as seconds,
           row_number() over (partition by st.visit_id order by coalesce(p.seconds, 0) desc, st.opened_at) = 1 as is_longest
    from stints st
    left join played p on p.visit_id = st.visit_id and p.table_id = st.table_id
  ),
  tabled as (
    select k.visit_id, k.table_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, tt.straddle_paise, k.seconds
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where k.seconds >= 60 or k.is_longest
  ),
  me as (
    select private.current_member_id() as member_id
    where private.has_feature(private.current_member_id(), 'sessions.history')
  ),
  tournaments as (
    select t.id, t.name, t.starts_at, t.entries
    from me
    join public.tournament_interest i on i.member_id = me.member_id
    join public.tournament t on t.id = i.tournament_id and t.is_published and t.starts_at <= now()
    where private.has_feature(me.member_id, 'tournaments.register')
  ),
  sessions as (
    select md5(m.id::text || ':' || l.table_id::text)::uuid as session_id, m.id as visit_id, l.opened_at, l.closed_at, l.name,
           l.small_blind_paise, l.big_blind_paise, l.seconds,
           0::bigint as buy_in, 0::bigint as bonus, 0::bigint as cashed, 0::bigint as tds,
           0::bigint as paid, 0::bigint as net,
           null::text as receipt, private.club_month(l.opened_at) as month,
           null::text as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants, l.straddle_paise as straddle
    from mine m
    join tabled l on l.visit_id = m.id
    union all
    select t.id, t.id, t.starts_at, t.starts_at, t.name, 0::bigint, 0::bigint, 0::bigint,
           0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, null::text, private.club_month(t.starts_at), null::text,
           'tournament'::text, null::integer, t.entries, null::bigint
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) filter (where s.kind = 'cash') over w)::integer,
         (sum(s.seconds) over w)::bigint, (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants, s.straddle
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

-- As it was, a month's sessions counting cash sessions alone.
create or replace function public.my_sessions()
returns table (session_id uuid, visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint,
               paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint,
               month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer, straddle_paise bigint)
language sql
stable
set search_path = ''
as $$
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.table_name, s.small_blind_paise, s.big_blind_paise, s.played_seconds,
         s.buy_in_paise, s.bonus_paise, s.cash_out_paise, s.tds_paise, s.paid_paise, s.net_paise, s.receipt, s.month,
         (count(*) filter (where s.kind = 'cash') over w)::integer, (sum(s.played_seconds) over w)::bigint, (sum(s.net_paise) over w)::bigint,
         s.tds_basis, s.kind, s.place, s.entrants, s.straddle_paise
  from private.my_sessions() s
  cross join lateral (select coalesce((select p.hidden_sessions from public.member_preference p where p.member_id = private.current_member_id()), '{}')
                      as ids) h
  where not (s.session_id = any (h.ids) or s.visit_id = any (h.ids))
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;

-- What the two features are now, as the tier matrix names them.
update public.feature set name = 'Tournaments', description = 'Upcoming tournaments, Notify me, and past ones in Sessions.' where key = 'tournaments.register';
update public.feature set description = 'When the club sends word of a tournament, or one moves or is withdrawn.' where key = 'push.tournament_starting';
