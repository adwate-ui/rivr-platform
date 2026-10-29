-- Tournaments as the owner runs them now (29 Oct, #636; decision 0284): the app lists the club's upcoming tournaments
-- and a member registers interest, with tournaments.register; they pay at the venue, and the floor marks them
-- registered from the console. The tournament module itself (entries, buy-ins, the clock) stays hidden.

create table public.tournament_interest (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  tournament_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  registered_at timestamptz,
  registered_by_staff_id uuid,
  updated_at timestamptz not null default now(),
  unique (tournament_id, member_id),
  foreign key (tournament_id, venue_id) references public.tournament (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (registered_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((registered_at is null) = (registered_by_staff_id is null))
);

comment on table public.tournament_interest is
  'A member''s interest in an upcoming tournament (#636), and when the floor marked them registered once they paid at the venue.';

create index tournament_interest_venue_idx on public.tournament_interest (venue_id, tournament_id);
create index tournament_interest_member_idx on public.tournament_interest (member_id, venue_id);
create index tournament_interest_staff_idx on public.tournament_interest (registered_by_staff_id, venue_id);
create trigger tournament_interest_touch_updated_at before update on public.tournament_interest
  for each row execute function private.touch_updated_at();
create trigger tournament_interest_audit after insert or update or delete on public.tournament_interest
  for each row execute function private.audit_row_change();

alter table public.tournament_interest enable row level security;
-- A member reads their own, with tournament registration; the floor reads their venue's.
create policy tournament_interest_member_read on public.tournament_interest for select to authenticated
  using (member_id = (select private.current_member_id()) and (select private.has_feature(private.current_member_id(), 'tournaments.register')));
create policy tournament_interest_floor_read on public.tournament_interest for select to authenticated
  using (venue_id in (select private.venues_where('waitlist.manage')));
grant select on public.tournament_interest to authenticated;

-- A member's export (#498) lists every column: their interest is theirs.
insert into private.member_export_column (table_name, column_name, kind)
select 'tournament_interest', c, 'owed'
from unnest(array['id', 'venue_id', 'tournament_id', 'member_id', 'created_at', 'registered_at', 'registered_by_staff_id', 'updated_at']) c;

-- The member's venue's upcoming published tournaments, soonest first, and where they stand on each: no interest yet,
-- interested, or registered. None without tournaments.register in their tier. No buy-in: the app shows no rupee.
create function private.my_upcoming_tournaments()
returns table (tournament_id uuid, name text, starts_at timestamptz, standing text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.starts_at,
         case when i.registered_at is not null then 'registered' when i.id is not null then 'interested' else 'none' end
  from public.tournament t
  left join public.tournament_interest i on i.tournament_id = t.id and i.member_id = private.current_member_id()
  where t.venue_id = private.current_member_venue_id() and t.is_published and t.starts_at > now()
    and private.has_feature(private.current_member_id(), 'tournaments.register')
  order by t.starts_at
  limit 20;
$$;

-- The signed-in member registers interest in an upcoming tournament, once. Refusals: 42501 not a member with
-- tournaments.register; 22023 no such upcoming tournament at their venue; RVFRZ/RVMBR a freeze.
create function private.register_tournament_interest(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'tournaments.register') then
    raise exception 'Only a member with tournament registration registers interest' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournament t where t.id = p_tournament_id and t.venue_id = v_venue_id and t.is_published and t.starts_at > now()) then
    raise exception 'An upcoming tournament at the club' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, 'tournament_registration', v_member_id);
  insert into public.tournament_interest (venue_id, tournament_id, member_id) values (v_venue_id, p_tournament_id, v_member_id)
  on conflict (tournament_id, member_id) do nothing;
end;
$$;

-- The floor's list (waitlist.manage): each member interested in a tournament still to start, or started in the last
-- day, soonest first, then in the order they asked.
create function private.tournament_interest_list(p_venue_id uuid)
returns table (interest_id uuid, tournament_id uuid, tournament_name text, starts_at timestamptz, member_id uuid, full_name text,
               member_number bigint, created_at timestamptz, registered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.id, t.name, t.starts_at, m.id, m.full_name, m.member_number, i.created_at, i.registered_at
  from public.tournament_interest i
  join public.tournament t on t.id = i.tournament_id
  join public.member m on m.id = i.member_id
  where i.venue_id = p_venue_id and private.has_permission(p_venue_id, 'waitlist.manage') and t.starts_at > now() - interval '1 day'
  order by t.starts_at, i.created_at;
$$;

-- The floor marks a member registered once they paid at the venue. Refusals: 42501 not waitlist.manage at its venue;
-- 22023 registered already; RVFRZ the venue frozen.
create function private.mark_tournament_registered(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interest public.tournament_interest;
begin
  select * into v_interest from public.tournament_interest i where i.id = p_interest_id for update;
  if v_interest.id is null or not private.has_permission(v_interest.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor marks a member registered' using errcode = '42501';
  end if;
  if v_interest.registered_at is not null then
    raise exception 'Registered already' using errcode = '22023';
  end if;
  perform private.assert_writable(v_interest.venue_id, 'tournament_registration', v_interest.member_id);
  update public.tournament_interest
  set registered_at = now(), registered_by_staff_id = private.current_staff_id(v_interest.venue_id)
  where id = v_interest.id;
end;
$$;

create function public.my_upcoming_tournaments()
returns table (tournament_id uuid, name text, starts_at timestamptz, standing text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_upcoming_tournaments(); $$;
create function public.register_tournament_interest(p_tournament_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.register_tournament_interest(p_tournament_id); $$;
create function public.tournament_interest_list(p_venue_id uuid)
returns table (interest_id uuid, tournament_id uuid, tournament_name text, starts_at timestamptz, member_id uuid, full_name text,
               member_number bigint, created_at timestamptz, registered_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tournament_interest_list(p_venue_id); $$;
create function public.mark_tournament_registered(p_interest_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.mark_tournament_registered(p_interest_id); $$;

revoke execute on function private.my_upcoming_tournaments(), private.register_tournament_interest(uuid),
  private.tournament_interest_list(uuid), private.mark_tournament_registered(uuid), public.my_upcoming_tournaments(),
  public.register_tournament_interest(uuid), public.tournament_interest_list(uuid), public.mark_tournament_registered(uuid)
  from public, anon;
grant execute on function private.my_upcoming_tournaments(), private.register_tournament_interest(uuid),
  private.tournament_interest_list(uuid), private.mark_tournament_registered(uuid), public.my_upcoming_tournaments(),
  public.register_tournament_interest(uuid), public.tournament_interest_list(uuid), public.mark_tournament_registered(uuid)
  to authenticated;

-- Erasure (#131), as before (20261028395200_host_queue.sql), deleting the member's tournament interest too.
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
