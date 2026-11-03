-- Lock-screen live status (decision 0323, phase 2; decisions 0360 and 0361). In the player app's native shell a member's
-- phone shows Waiting, Seat ready or Seated on the lock screen: an iPhone as a Live Activity, an Android phone as an
-- ongoing notification. The phone is kept here with its push token; the live-status consumer reads what it should show
-- when it sends (live_status_of), so a late or repeated event never shows anything old, and sends only a change.
-- Waiting and Seat ready go where seat calls go, Seated where call time goes (private.wants_push). Never at the practice
-- venue. A place on a list moves whenever another joins, is approved, sits or leaves: one waitlist.moved event says so,
-- and the consumer refreshes everyone waiting on that list (decision 0360, #778).

create table public.live_status_device (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  -- Where a status goes: an Android phone's Firebase registration token, an iPhone's ActivityKit push-to-start token.
  push_token text not null unique,
  -- An iPhone's running Live Activity's own token, which its updates and its end go to; null while none runs.
  activity_push_token text check (activity_push_token ~ '^[0-9a-f]{64,200}$'),
  -- The phone's own key (sha256, hex), which it keeps: the same phone signed in by another member moves to them with it,
  -- and an iPhone reports a Live Activity's token with it while the app is not running (report_live_status_token).
  device_key_hash text not null unique check (device_key_hash ~ '^[0-9a-f]{64}$'),
  -- What the phone shows, as the consumer last sent it; null when nothing shows.
  shown text check (length(shown) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check (case platform when 'ios' then push_token ~ '^[0-9a-f]{64,200}$'
                           else push_token ~ '^[A-Za-z0-9_:-]+$' and length(push_token) between 20 and 4096 end),
  check (platform = 'ios' or activity_push_token is null)
);

comment on table public.live_status_device is 'The phones a member turned the lock-screen live status on for, in the native app (decision 0323).';

create index live_status_device_venue_id_idx on public.live_status_device (venue_id);
create index live_status_device_member_id_idx on public.live_status_device (member_id);
create trigger live_status_device_touch_updated_at before update on public.live_status_device
  for each row execute function private.touch_updated_at();

-- Nobody reads it but the consumer: members save and remove their phones through the functions below.
alter table public.live_status_device enable row level security;
revoke all on public.live_status_device from anon, authenticated;

-- A member's export says which phones they had; the tokens and what showed stay out of it.
insert into private.member_export_column (table_name, column_name, kind) values
  ('live_status_device', 'id', 'owed'), ('live_status_device', 'venue_id', 'owed'), ('live_status_device', 'member_id', 'owed'),
  ('live_status_device', 'platform', 'owed'), ('live_status_device', 'created_at', 'owed'), ('live_status_device', 'updated_at', 'owed'),
  ('live_status_device', 'push_token', 'withheld'), ('live_status_device', 'activity_push_token', 'withheld'),
  ('live_status_device', 'shown', 'withheld');

create function private.live_status_key_hash(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to('rivr-live-status:' || p_key, 'UTF8'), 'sha256'), 'hex');
$$;

-- The signed-in member's phone, saved with a new key for the phone to keep. The same phone signed in by another member
-- moves to them only when it presents its key, so nobody who merely knows a token takes the phone. A member keeps their
-- five latest phones.
create function private.save_live_status_device(p_platform text, p_token text, p_device_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_key text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if v_member_id is null then
    raise exception 'Only a member has a live status' using errcode = '42501';
  end if;
  insert into public.live_status_device (venue_id, member_id, platform, push_token, device_key_hash)
  values (private.current_member_venue_id(), v_member_id, p_platform, p_token, private.live_status_key_hash(v_key))
  on conflict (push_token) do update
    set venue_id = excluded.venue_id, member_id = excluded.member_id, platform = excluded.platform,
        device_key_hash = excluded.device_key_hash,
        activity_push_token = case when public.live_status_device.member_id = excluded.member_id
                                   then public.live_status_device.activity_push_token end,
        shown = case when public.live_status_device.member_id = excluded.member_id then public.live_status_device.shown end
    where public.live_status_device.member_id = excluded.member_id
       or public.live_status_device.device_key_hash = private.live_status_key_hash(coalesce(p_device_key, ''))
  returning id into v_id;
  if v_id is null then
    raise exception 'That phone is another member''s' using errcode = '42501';
  end if;
  delete from public.live_status_device d
  where d.member_id = v_member_id
    and d.id not in (select k.id from public.live_status_device k where k.member_id = v_member_id order by k.updated_at desc, k.id limit 5);
  return v_key;
end;
$$;

-- The signed-in member turns the live status off for a phone of theirs, or signs out of it.
create function private.remove_live_status_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.live_status_device d where d.push_token = p_token and d.member_id = private.current_member_id();
$$;

-- A phone reports a new token with its key alone, through the live-status-token function (service role): an iPhone gets
-- a Live Activity's token, or a new push-to-start token, while the app's web view is not running (decision 0361). A wrong
-- key changes nothing.
create function private.report_live_status_token(p_device_key text, p_token text, p_activity_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.live_status_device d
  set push_token = coalesce(p_token, d.push_token), activity_push_token = coalesce(p_activity_token, d.activity_push_token)
  where d.device_key_hash = private.live_status_key_hash(p_device_key);
$$;

-- What a member's phone shows now (decision 0323): seated while their call time runs or is paused (Seated goes where call
-- time goes); otherwise their place tonight, seat ready while a call's hold runs, else waiting (both where seat calls go).
-- Times to the second, so the same status reads the same each time.
create function private.live_status_of(p_member_id uuid)
returns table (state text, entry_id uuid, table_name text, seat integer, game text, place integer, starts_at timestamptz,
               ends_at timestamptz, can_order boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select x.state, x.entry_id, x.table_name, x.seat, x.game, x.place, x.starts_at, x.ends_at, x.can_order
  from (
    select 1 as rank, 'seated' as state, null::uuid as entry_id, g.name as table_name, s.seat, t.name as game, null::integer as place,
           ends.at - make_interval(mins => s.call_time_minutes) as starts_at, ends.at as ends_at,
           private.has_feature(s.member_id, 'fnb.table_side') as can_order
    from public.seat_session s
    join public.game_table g on g.id = s.table_id
    join public.table_type t on t.id = g.table_type_id
    cross join lateral (
      select case when s.call_time_minutes > 0 and s.away_since is null and s.call_time_completed_at is null
                       and private.has_feature(s.member_id, 'call_time.view')
                  then date_trunc('second', s.started_at + make_interval(mins => s.call_time_minutes, secs => s.away_seconds)) end as at
    ) ends
    where s.member_id = p_member_id and s.ended_at is null and private.wants_push(p_member_id, 'push.call_time_complete')
    union all
    select 2, case when held.is_held then 'seat_ready' else 'waiting' end, e.id,
           case when held.is_held then called.name else asked.name end, case when held.is_held then e.call_seat end, t.name, r.place,
           case when held.is_held then date_trunc('second', e.called_at) end, case when held.is_held then date_trunc('second', e.hold_until) end,
           false
    from public.waitlist_entry e
    join public.table_type t on t.id = e.table_type_id
    cross join lateral (select coalesce(e.called_at is not null and e.hold_until > now(), false) as is_held) held
    left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
    left join public.game_table called on called.id = e.call_table_id
    left join public.game_table asked on asked.id = e.table_id
    where e.member_id = p_member_id and e.status = 'waiting' and e.joined_at >= private.tonight_began(now())
      and private.wants_push(p_member_id, 'push.seat_ready')
      and not exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null)
  ) x
  order by x.rank, x.starts_at nulls last
  limit 1;
$$;

-- Where an event's statuses go (the consumer, service role): the member's phones, and with a list, the phones of everyone
-- waiting on it tonight, each with what it shows now. Never at the practice venue, and never for an erased member.
create function private.live_status_targets(p_venue_id uuid, p_member_id uuid, p_table_type_id uuid)
returns table (device_id uuid, platform text, push_token text, activity_push_token text, shown text, member_id uuid, state text, entry_id uuid,
               table_name text, seat integer, game text, place integer, starts_at timestamptz, ends_at timestamptz, can_order boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select p_member_id as member_id
    union
    select e.member_id from public.waitlist_entry e
    where p_table_type_id is not null and e.venue_id = p_venue_id and e.table_type_id = p_table_type_id and e.status = 'waiting'
      and e.joined_at >= private.tonight_began(now())
  )
  select d.id, d.platform, d.push_token, d.activity_push_token, d.shown, d.member_id, s.state, s.entry_id, s.table_name, s.seat, s.game, s.place,
         s.starts_at, s.ends_at, s.can_order
  from members x
  join public.live_status_device d on d.member_id = x.member_id and d.venue_id = p_venue_id
  join public.member m on m.id = d.member_id and m.erased_at is null
  join public.venue v on v.id = d.venue_id and not v.is_practice
  left join lateral private.live_status_of(d.member_id) s on true
  order by d.member_id, d.updated_at desc, d.id;
$$;

-- What a phone shows once a status went (the consumer). Nothing showing ends an iPhone's Live Activity, so its token goes.
create function private.note_live_status_shown(p_device_id uuid, p_shown text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.live_status_device d
  set shown = p_shown, activity_push_token = case when p_shown is null then null else d.activity_push_token end
  where d.id = p_device_id;
$$;

-- A phone whose token the push service no longer knows (the app was removed, or the token replaced).
create function private.forget_live_status_device(p_device_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.live_status_device d where d.id = p_device_id;
$$;

-- A list moved (decision 0360): a place joined, was approved, sat or left. A call moves no place (waitlist.called says it).
create function private.emit_waitlist_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.emit(new.venue_id, 'waitlist.moved',
                       jsonb_build_object('entry_id', new.id, 'member_id', new.member_id, 'table_type_id', new.table_type_id),
                       'waitlist.moved:' || new.id || ':' || new.status || ':' || (new.approved_at is not null));
  return null;
end;
$$;

create trigger waitlist_entry_joined_moves after insert on public.waitlist_entry
  for each row execute function private.emit_waitlist_moved();
create trigger waitlist_entry_moves after update of status, approved_at on public.waitlist_entry
  for each row when (old.status is distinct from new.status or (old.approved_at is null) <> (new.approved_at is null))
  execute function private.emit_waitlist_moved();

-- As 20261029160000_tournament_interest.sql made it, deleting the member's live-status phones too.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.learn_attempt x where x.member_id = p_member.id;
  delete from public.learn_card x where x.member_id = p_member.id;
  delete from public.learn_session x where x.member_id = p_member.id;
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.live_status_device x where x.member_id = p_member.id;
  delete from public.winner_card x where x.member_id = p_member.id;
  delete from public.learn_lesson x where x.member_id = p_member.id;
  delete from public.host_queue_item x where x.member_id = p_member.id;
  delete from public.tournament_interest x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.save_live_status_device(p_platform text, p_token text, p_device_key text default null)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.save_live_status_device(p_platform, p_token, p_device_key); $$;
create function public.remove_live_status_device(p_token text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_live_status_device(p_token); $$;
create function public.report_live_status_token(p_device_key text, p_token text default null, p_activity_token text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.report_live_status_token(p_device_key, p_token, p_activity_token); $$;
create function public.live_status_targets(p_venue_id uuid, p_member_id uuid, p_table_type_id uuid default null)
returns table (device_id uuid, platform text, push_token text, activity_push_token text, shown text, member_id uuid, state text, entry_id uuid,
               table_name text, seat integer, game text, place integer, starts_at timestamptz, ends_at timestamptz, can_order boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.live_status_targets(p_venue_id, p_member_id, p_table_type_id); $$;
create function public.note_live_status_shown(p_device_id uuid, p_shown text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.note_live_status_shown(p_device_id, p_shown); $$;
create function public.forget_live_status_device(p_device_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.forget_live_status_device(p_device_id); $$;

revoke execute on function private.live_status_key_hash(text), private.save_live_status_device(text, text, text),
  private.remove_live_status_device(text), private.report_live_status_token(text, text, text), private.live_status_of(uuid),
  private.live_status_targets(uuid, uuid, uuid), private.note_live_status_shown(uuid, text), private.forget_live_status_device(uuid),
  private.emit_waitlist_moved(), public.save_live_status_device(text, text, text), public.remove_live_status_device(text),
  public.report_live_status_token(text, text, text), public.live_status_targets(uuid, uuid, uuid), public.note_live_status_shown(uuid, text),
  public.forget_live_status_device(uuid) from public, anon, authenticated;
grant execute on function private.save_live_status_device(text, text, text), private.remove_live_status_device(text),
  public.save_live_status_device(text, text, text), public.remove_live_status_device(text) to authenticated;
grant execute on function private.report_live_status_token(text, text, text), public.report_live_status_token(text, text, text),
  private.live_status_targets(uuid, uuid, uuid), private.note_live_status_shown(uuid, text),
  private.forget_live_status_device(uuid), public.live_status_targets(uuid, uuid, uuid), public.note_live_status_shown(uuid, text),
  public.forget_live_status_device(uuid) to service_role;

select private.schedule_outbox_consumer('live-status');
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
