-- A member asks to delete their account from the app (#813, decision 0574). A super admin completes the request with the
-- existing erasure (decision 0207), which keeps its checks. Erasure wipes the number and the member's queued messages, so the
-- number is kept apart, in a private table no export reads, for the one message saying it is done, and forgotten within 48 hours.

insert into public.feature (key, name, description, screens, is_gateable) values
  ('account.delete', 'Delete my account', 'Asking the club to erase the account and its data.', '{player:profile}', false);

create table public.member_erasure_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);
comment on table public.member_erasure_request is 'A member''s own request to delete their account (#813), from asking to the erasure that completes it.';
create unique index member_erasure_request_open_idx on public.member_erasure_request (member_id) where completed_at is null;
create index member_erasure_request_venue_idx on public.member_erasure_request (venue_id, requested_at);
create index member_erasure_request_member_idx on public.member_erasure_request (member_id, venue_id);
create trigger member_erasure_request_touch_updated_at before update on public.member_erasure_request
  for each row execute function private.touch_updated_at();

alter table public.member_erasure_request enable row level security;
-- Read and written only by the functions below.
revoke all on public.member_erasure_request from anon, authenticated;

-- A member's export (#498) lists every column: the request is theirs.
insert into private.member_export_column (table_name, column_name, kind)
select 'member_erasure_request', c, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'requested_at', 'completed_at', 'created_at', 'updated_at']) as c;

-- The number kept to say an erasure is done. Private, as both exports read only public tables. No foreign key: a row lives a day
-- at most and must not hold up a purge.
create table private.erasure_notice_phone (
  member_id uuid primary key,
  venue_id uuid not null,
  phone text not null,
  kept_at timestamptz not null default now()
);
alter table private.erasure_notice_phone enable row level security;
revoke all on private.erasure_notice_phone from public, anon, authenticated;

-- The signed-in member asks. Asking again leaves the open request as it is.
create function private.request_my_erasure()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_requested_at timestamptz;
begin
  select * into v_member from public.member m where m.id = private.current_member_id();
  if v_member.id is null or not private.has_feature(v_member.id, 'account.delete') then
    raise exception 'Only a member asks to delete their account' using errcode = '42501';
  end if;
  -- The venue's freeze only: a member frozen themselves can still ask.
  perform private.assert_writable(v_member.venue_id);
  insert into public.member_erasure_request (venue_id, member_id)
  values (v_member.venue_id, v_member.id)
  on conflict (member_id) where completed_at is null do nothing;
  select r.requested_at into v_requested_at
  from public.member_erasure_request r where r.member_id = v_member.id and r.completed_at is null;
  return v_requested_at;
end;
$$;

-- When the signed-in member asked, while the request is open; no row otherwise.
create function private.my_erasure_request()
returns table (requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.requested_at from public.member_erasure_request r
  where r.member_id = private.current_member_id() and r.completed_at is null;
$$;

-- The venue's open requests, oldest first, for those who erase. Never a member already erased: a restore, or the practice
-- reset's seed, can bring back a request that erasure had closed.
create function private.member_erasure_requests(p_venue_id uuid)
returns table (member_id uuid, full_name text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.member_id, m.full_name, r.requested_at
  from public.member_erasure_request r
  join public.member m on m.id = r.member_id
  where r.venue_id = p_venue_id and r.completed_at is null and m.erased_at is null and private.has_permission(p_venue_id, 'members.erase')
  order by r.requested_at;
$$;

-- As in 20261104320000_no_crm_and_website_launch.sql, then the member's request closed and the one message that says so. The
-- message follows carry_out_erasure, which clears the member's queue.
create or replace function private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz, forfeited_nights bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.erase') then
    raise exception 'Only a super admin erases a member' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('member-erase:' || v_member.venue_id::text));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.erased_at is not null then
    raise exception 'This member was erased already' using errcode = 'RVERD';
  end if;
  if btrim(coalesce(p_full_name, '')) is distinct from v_member.full_name then
    raise exception 'Type the member''s full name exactly to erase them' using errcode = 'RVNAM';
  end if;
  if not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'Give a reason of 3 to 300 characters with nothing of the person in it' using errcode = '22023';
  end if;
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.erase' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten members were erased in the last hour: wait before erasing another' using errcode = 'RVRAT';
  end if;
  v_summary := private.carry_out_erasure(p_member_id, v_reason);
  update public.member_erasure_request r
  set completed_at = now()
  where r.member_id = p_member_id and r.completed_at is null;
  if found and v_member.phone is not null then
    insert into private.erasure_notice_phone (member_id, venue_id, phone) values (p_member_id, v_member.venue_id, v_member.phone);
    perform private.emit(v_member.venue_id, 'member.notice',
      jsonb_build_object('member_id', p_member_id, 'notice', 'account_erased', 'params', '[]'::jsonb),
      'member.notice:account_erased:' || p_member_id);
  end if;
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'points')::bigint, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz, coalesce((v_summary ->> 'nights_thousandths')::bigint, 0);
end;
$$;

-- The number kept to say an erasure is done, for that message alone: every other message reads message_recipient, which
-- finds no number for an erased member. Never for a practice venue.
create function private.erased_member_notice_phone(p_venue_id uuid, p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.phone
  from private.erasure_notice_phone p
  join public.venue v on v.id = p.venue_id and not v.is_practice
  where p.member_id = p_member_id and p.venue_id = p_venue_id;
$$;

-- A number kept for a day is forgotten. The job runs hourly, so none stays near 48 hours; the message itself goes within six.
create function private.forget_erasure_notice_phones()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.erasure_notice_phone p where p.kept_at <= now() - interval '24 hours';
$$;
select cron.schedule('erasure-notice-phones-forget', '25 * * * *', 'select private.forget_erasure_notice_phones()');

-- As in 20261110653100_wall_posts_waiting_count.sql, with the requests to delete an account.
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
                            where i.registered_at is null and t.is_published)),
    -- Wall posts waiting for approval, for those who approve them.
    ('wallPosts', (select count(*) from public.wall_post w
                   where w.venue_id = p_venue_id and w.status = 'pending' and private.has_permission(p_venue_id, 'marketing.publish'))),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$$;

create function public.request_my_erasure()
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.request_my_erasure(); $$;
create function public.my_erasure_request()
returns table (requested_at timestamptz) language sql stable security invoker set search_path = ''
as $$ select * from private.my_erasure_request(); $$;
create function public.member_erasure_requests(p_venue_id uuid)
returns table (member_id uuid, full_name text, requested_at timestamptz) language sql stable security invoker set search_path = ''
as $$ select * from private.member_erasure_requests(p_venue_id); $$;
create function public.erased_member_notice_phone(p_venue_id uuid, p_member_id uuid)
returns text language sql stable security invoker set search_path = ''
as $$ select private.erased_member_notice_phone(p_venue_id, p_member_id); $$;

revoke execute on function private.request_my_erasure(), private.my_erasure_request(), private.member_erasure_requests(uuid),
  public.request_my_erasure(), public.my_erasure_request(), public.member_erasure_requests(uuid) from public, anon;
grant execute on function private.request_my_erasure(), private.my_erasure_request(), private.member_erasure_requests(uuid),
  public.request_my_erasure(), public.my_erasure_request(), public.member_erasure_requests(uuid) to authenticated;
revoke execute on function private.erased_member_notice_phone(uuid, uuid), public.erased_member_notice_phone(uuid, uuid),
  private.forget_erasure_notice_phones() from public, anon, authenticated;
grant execute on function private.erased_member_notice_phone(uuid, uuid), public.erased_member_notice_phone(uuid, uuid) to service_role;
