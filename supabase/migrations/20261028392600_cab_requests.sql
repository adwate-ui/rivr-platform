-- Cab eligibility and requests (#140; scope-v1 module 14). A member with cab.requests in their tier and at least
-- cab.minimum_visits visits this month (private.visits_this_month; four when none is set) sees the cab option, and asks
-- for a pickup or a drop: where, and at what time of day (the next such time in IST). Erasure deletes their requests.
insert into public.setting_key (key, description, scope, value_schema) values
  ('cab.minimum_visits',
   'The visits a member needs this month before the app offers them a cab; none set is four.',
   'venue',
   '{"type":"object","properties":{"visits":{"type":"integer","minimum":1,"maximum":31}},"required":["visits"],"additionalProperties":false}');

create table public.cab_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  kind text not null check (kind in ('pickup', 'drop')),
  address text not null check (length(btrim(address)) between 3 and 200),
  wanted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.cab_request is 'A member''s pickup or drop request (#140): where and when.';

create index cab_request_member_idx on public.cab_request (member_id, venue_id, wanted_at);
create index cab_request_venue_idx on public.cab_request (venue_id, wanted_at);

create trigger cab_request_touch_updated_at before update on public.cab_request
  for each row execute function private.touch_updated_at();
create trigger cab_request_audit after insert or update or delete on public.cab_request
  for each row execute function private.audit_row_change();

alter table public.cab_request enable row level security;
grant select (id, venue_id, member_id, kind, address, wanted_at, created_at, updated_at) on public.cab_request to authenticated;
create policy "members see their own cab requests" on public.cab_request
  for select to authenticated using (member_id = (select private.current_member_id())
                                     and private.has_feature((select private.current_member_id()), 'cab.requests'));
create policy "staff who read members see the venue's cab requests" on public.cab_request
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

insert into private.member_export_column (table_name, column_name, kind)
select 'cab_request', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'kind', 'address', 'wanted_at', 'created_at', 'updated_at']) c (column_name);

-- The visits a member needs this month for a cab at their venue: the setting, else four.
create function private.cab_minimum_visits(p_venue_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((private.setting_at(p_venue_id, 'cab.minimum_visits', '', now()) ->> 'visits')::integer, 4); $$;

-- The signed-in member's cab: whether they may ask for one, their visits this month and the visits it needs; nothing
-- for anyone whose tier has no cab requests.
create function private.my_cab()
returns table (is_eligible boolean, visits integer, minimum_visits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select private.visits_this_month(m.id, now()) >= private.cab_minimum_visits(m.venue_id),
         private.visits_this_month(m.id, now()), private.cab_minimum_visits(m.venue_id)
  from public.member m
  where m.id = private.current_member_id() and m.erased_at is null and private.has_feature(m.id, 'cab.requests');
$$;

-- An eligible member asks for a pickup or a drop: where, and the time of day (`21:30`), the next such time in IST.
-- RVCAB when they have not the visits this month; 22023 for a kind, place or time it cannot take.
create function private.request_cab(p_kind text, p_address text, p_time text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_wanted timestamptz;
  v_id uuid;
begin
  select m.* into v_member from public.member m where m.id = private.current_member_id() and m.erased_at is null;
  if v_member.id is null or not private.has_feature(v_member.id, 'cab.requests') then
    raise exception 'Cab requests are not part of your tier' using errcode = '42501';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if private.visits_this_month(v_member.id, now()) < private.cab_minimum_visits(v_member.venue_id) then
    raise exception 'A cab comes with enough visits this month' using errcode = 'RVCAB';
  end if;
  if p_kind is null or p_kind not in ('pickup', 'drop') or coalesce(p_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'A pickup or a drop, at a time of day as 21:30' using errcode = '22023';
  end if;
  v_wanted := (v_today + p_time::time) at time zone 'Asia/Kolkata';
  if v_wanted < now() then
    v_wanted := v_wanted + interval '1 day';
  end if;
  insert into public.cab_request (venue_id, member_id, kind, address, wanted_at)
  values (v_member.venue_id, v_member.id, p_kind, btrim(coalesce(p_address, '')), v_wanted)
  returning id into v_id;
  return v_id;
exception
  when check_violation then
    raise exception 'Say where, in 3 to 200 characters' using errcode = '22023';
end;
$$;

create function public.my_cab()
returns table (is_eligible boolean, visits integer, minimum_visits integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_cab(); $$;
create function public.request_cab(p_kind text, p_address text, p_time text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.request_cab(p_kind, p_address, p_time); $$;

revoke execute on function private.cab_minimum_visits(uuid) from public, anon, authenticated;
revoke execute on function private.my_cab(), private.request_cab(text, text, text), public.my_cab(), public.request_cab(text, text, text)
  from public, anon;
grant execute on function private.my_cab(), private.request_cab(text, text, text), public.my_cab(), public.request_cab(text, text, text)
  to authenticated;

-- As before (20261028390900_google_review_request.sql), deleting the member's cab requests too.
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
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;
