-- The player app shows no rupee (owner, 29 Oct, #627; decision 0284). Sessions show when, where and how long, and a
-- member can hide a session from their own view: it stays in the club's records, only their list leaves it out.

alter table public.member_preference
  add column hidden_sessions uuid[] not null default '{}';

comment on column public.member_preference.hidden_sessions is
  'Sessions (visit or tournament ids) the member hid from their own Sessions list (#627); the club keeps them.';

-- A member's export (#498) lists every column: which sessions they hid is theirs.
insert into private.member_export_column (table_name, column_name, kind) values ('member_preference', 'hidden_sessions', 'owed');

-- The signed-in member hides one of their sessions from their list, with session history in their tier (rule 8). Only
-- a session of their own, as their list has it, so the list stays as long as their history. Hiding one twice changes
-- nothing.
create function private.hide_my_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'sessions.history') then
    raise exception 'Only a member with session history hides a session' using errcode = '42501';
  end if;
  if p_session_id is null or not exists (select 1 from private.my_sessions() s where s.visit_id = p_session_id) then
    raise exception 'One of your sessions to hide' using errcode = '22023';
  end if;
  insert into public.member_preference (member_id, venue_id, hidden_sessions)
  values (v_member_id, v_venue_id, array[p_session_id])
  on conflict (member_id) do update
    set hidden_sessions = case when p_session_id = any (public.member_preference.hidden_sessions) then public.member_preference.hidden_sessions
                               else public.member_preference.hidden_sessions || p_session_id end;
end;
$$;

create function public.hide_my_session(p_session_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.hide_my_session(p_session_id); $$;

revoke execute on function private.hide_my_session(uuid), public.hide_my_session(uuid) from public, anon;
grant execute on function private.hide_my_session(uuid), public.hide_my_session(uuid) to authenticated;

-- The member's sessions, as 20261028392000_tournaments_in_sessions.sql gives them, without those they hid.
create or replace function public.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text,
               kind text, place integer, entrants integer)
language sql stable security invoker set search_path = ''
as $$
  select s.* from private.my_sessions() s
  where not s.visit_id = any (coalesce((select p.hidden_sessions from public.member_preference p where p.member_id = private.current_member_id()), '{}'));
$$;
