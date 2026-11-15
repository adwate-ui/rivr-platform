-- A stake's call time is asked for, never assumed (redesign RD-16; owner, 15 Nov). Until now a new stake silently got
-- three hours (20261102100000_stakes_straddle.sql). Now the stake form sends it, the same value Settings shows and
-- changes (the setting call_time.minutes, by the stake's code), and a stake with none cannot be given to a table: the
-- next migration refuses that in add_game_table and set_game_table. Existing stakes keep theirs.

-- The call time a stake has now, in minutes: 0 when it has none.
create function private.stake_call_time(p_venue_id uuid, p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'call_time.minutes', p_code, now()) ->> 'minutes')::integer, 0);
$$;

-- Sets a stake's call time from now. Left out, or the one it has already, changes nothing. A call time is a setting, so
-- writing one needs what Settings needs, settings.manage with its staff-network and enrolled-computer rule, whoever set up
-- the stake. Refusals: 22023 not 1 to 1,440 minutes; 42501 not settings.manage.
create function private.set_stake_call_time(p_venue_id uuid, p_code text, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_minutes is null then return; end if;
  if p_minutes not between 1 and 1440 then
    raise exception 'A stake''s call time is 1 to 1,440 minutes' using errcode = '22023';
  end if;
  if p_minutes = private.stake_call_time(p_venue_id, p_code) then return; end if;
  if not private.has_permission(p_venue_id, 'settings.manage') then
    raise exception 'Only staff who change settings set a stake''s call time' using errcode = '42501';
  end if;
  -- A second change in one transaction replaces the first: a setting's start is the transaction's, and one start holds one value.
  delete from public.setting s
  where s.venue_id = p_venue_id and s.key = 'call_time.minutes' and s.subject = p_code and s.effective_from = now();
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'call_time.minutes', p_code, jsonb_build_object('minutes', p_minutes), now(), 'Set with the stake in Tables setup (RD-16)');
end;
$$;

-- A stake may be given to a table once it has a call time above zero. A stake that is not this venue's is left to the
-- table's own checks. Refusal: RVNCT. The SQL twin of @rivr/domain stakeTableRefusal.
create function private.assert_stake_ready(p_venue_id uuid, p_table_type_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  select t.code into v_code from public.table_type t where t.id = p_table_type_id and t.venue_id = p_venue_id;
  if v_code is not null and private.stake_call_time(p_venue_id, v_code) <= 0 then
    raise exception 'Give the stake a call time before a table plays it' using errcode = 'RVNCT';
  end if;
end;
$$;

-- Blinds and a straddle are at most ₹1,00,00,000 each: far above any game, and far below where a hundred big blinds, which
-- the stake's own columns still hold, would pass what a bigint holds. Refusal: 22023.
create function private.assert_blinds_in_reach(p_small_blind_paise bigint, p_big_blind_paise bigint, p_straddle_paise bigint)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if greatest(coalesce(p_small_blind_paise, 0), coalesce(p_big_blind_paise, 0), coalesce(p_straddle_paise, 0)) > 1000000000 then
    raise exception 'A blind or straddle is at most 1,00,00,000' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function private.stake_call_time(uuid, text), private.set_stake_call_time(uuid, text, integer),
  private.assert_stake_ready(uuid, uuid), private.assert_blinds_in_reach(bigint, bigint, bigint) from public, anon, authenticated;

drop function public.add_table_type(uuid, text, bigint, bigint, bigint);
drop function private.add_table_type(uuid, text, bigint, bigint, bigint);
drop function public.set_table_type(uuid, text, bigint, bigint, bigint);
drop function private.set_table_type(uuid, text, bigint, bigint, bigint);

-- As 20261102100000_stakes_straddle.sql made it, with the call time in place of three hours for everyone: given, the
-- stake has it from now; left out (a console open on an older build), the stake has none and no table plays it yet. Its
-- code, `100_200`, takes a number after it when a stake has it already or any setting is still kept under it, so a new
-- stake never inherits the call time, rake, rakeback or anything else of one deleted.
create function private.add_table_type(p_venue_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                       p_straddle_paise bigint default null, p_call_time_minutes integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := coalesce(p_small_blind_paise / 100, 0) || '_' || coalesce(p_big_blind_paise / 100, 0);
  v_code text := v_base;
  v_number integer := 1;
  v_id uuid;
begin
  perform private.assert_tables_manager(p_venue_id);
  perform private.assert_blinds_in_reach(p_small_blind_paise, p_big_blind_paise, p_straddle_paise);
  perform private.assert_straddle(p_big_blind_paise, p_straddle_paise);
  while exists (select 1 from public.table_type t where t.venue_id = p_venue_id and t.code = v_code)
     or exists (select 1 from public.setting s where s.venue_id = p_venue_id and s.subject = v_code) loop
    v_number := v_number + 1;
    v_code := v_base || '_' || v_number;
  end loop;
  begin
    insert into public.table_type (venue_id, code, name, small_blind_paise, big_blind_paise, straddle_paise, buy_in_min_paise, buy_in_max_paise)
    values (p_venue_id, v_code, trim(p_name), p_small_blind_paise, p_big_blind_paise, p_straddle_paise, p_big_blind_paise * 100,
            p_big_blind_paise * 100)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name and blinds in whole 50s, the big above the small, and any straddle above both'
      using errcode = '22023';
  end;
  perform private.set_stake_call_time(p_venue_id, v_code, p_call_time_minutes);
  return v_id;
end;
$$;

-- As 20261102100000_stakes_straddle.sql made it, with the call time: given, it is the stake's from now; left out, the
-- stake keeps its own.
create function private.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                       p_straddle_paise bigint default null, p_call_time_minutes integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.table_type;
begin
  select * into v_type from public.table_type t where t.id = p_type_id for update;
  perform private.assert_tables_manager(v_type.venue_id);
  perform private.assert_blinds_in_reach(p_small_blind_paise, p_big_blind_paise, p_straddle_paise);
  perform private.assert_straddle(p_big_blind_paise, nullif(coalesce(p_straddle_paise, v_type.straddle_paise), 0));
  begin
    update public.table_type
    set name = trim(p_name), small_blind_paise = p_small_blind_paise, big_blind_paise = p_big_blind_paise,
        straddle_paise = nullif(coalesce(p_straddle_paise, v_type.straddle_paise), 0),
        buy_in_min_paise = least(buy_in_min_paise, p_big_blind_paise * 100), buy_in_max_paise = greatest(buy_in_max_paise, p_big_blind_paise * 100)
    where id = v_type.id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name and blinds in whole 50s, the big above the small, and any straddle above both'
      using errcode = '22023';
  end;
  perform private.set_stake_call_time(v_type.venue_id, v_type.code, p_call_time_minutes);
end;
$$;

create function public.add_table_type(p_venue_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                      p_straddle_paise bigint default null, p_call_time_minutes integer default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_table_type(p_venue_id, p_name, p_small_blind_paise, p_big_blind_paise, p_straddle_paise, p_call_time_minutes); $$;
create function public.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                      p_straddle_paise bigint default null, p_call_time_minutes integer default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_table_type(p_type_id, p_name, p_small_blind_paise, p_big_blind_paise, p_straddle_paise, p_call_time_minutes); $$;

-- Each of the venue's stakes with the call time it has now, for Tables setup: 0 for a stake with none. Staff of the
-- venue only; anyone else gets no rows.
create function private.stake_call_times(p_venue_id uuid)
returns table (table_type_id uuid, call_time_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, private.stake_call_time(t.venue_id, t.code)
  from public.table_type t
  where t.venue_id = p_venue_id and p_venue_id in (select private.staff_venues());
$$;

create function public.stake_call_times(p_venue_id uuid)
returns table (table_type_id uuid, call_time_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.stake_call_times(p_venue_id); $$;

revoke execute on function private.add_table_type(uuid, text, bigint, bigint, bigint, integer),
  private.set_table_type(uuid, text, bigint, bigint, bigint, integer), public.add_table_type(uuid, text, bigint, bigint, bigint, integer),
  public.set_table_type(uuid, text, bigint, bigint, bigint, integer), private.stake_call_times(uuid), public.stake_call_times(uuid) from public, anon;
grant execute on function private.add_table_type(uuid, text, bigint, bigint, bigint, integer),
  private.set_table_type(uuid, text, bigint, bigint, bigint, integer), public.add_table_type(uuid, text, bigint, bigint, bigint, integer),
  public.set_table_type(uuid, text, bigint, bigint, bigint, integer), private.stake_call_times(uuid), public.stake_call_times(uuid) to authenticated;
