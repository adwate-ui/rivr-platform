-- Stakes with a straddle and without a game (owner, 2 Nov; decision 0299): "Straddle option in NEW Stakes" and "Game
-- type is not needed when adding stakes - reserves future flexibility". A stake is its name, its blinds and any
-- compulsory straddle; the game is no longer asked, so a stake made from now has none, and one made before keeps its own.
-- A straddle is whole ₹50 chips above the big blind. A new stake's code comes from its blinds, `100_200`.
alter table public.table_type alter column game drop not null;

drop function public.add_table_type(uuid, text, text, bigint, bigint);
drop function private.add_table_type(uuid, text, text, bigint, bigint);
drop function public.set_table_type(uuid, text, bigint, bigint);
drop function private.set_table_type(uuid, text, bigint, bigint);

-- A straddle, when there is one, is above the big blind. Refusal: 22023.
create function private.assert_straddle(p_big_blind_paise bigint, p_straddle_paise bigint)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_straddle_paise is not null and p_straddle_paise <= p_big_blind_paise then
    raise exception 'A straddle is above the big blind' using errcode = '22023';
  end if;
end;
$$;

-- A new stake: its name, blinds and any straddle in paise (whole ₹50 chips, each above the last); its code from its
-- blinds, `100_200`, with a number after it when one has it already; its buy-in range from its big blind; three hours of
-- call time from now. Refusal: 22023 a blind or straddle that does not fit.
create function private.add_table_type(p_venue_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                       p_straddle_paise bigint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := coalesce(p_small_blind_paise / 100, 0) || '_' || coalesce(p_big_blind_paise / 100, 0);
  v_id uuid;
begin
  perform private.assert_tables_manager(p_venue_id);
  perform private.assert_straddle(p_big_blind_paise, p_straddle_paise);
  if exists (select 1 from public.table_type t where t.venue_id = p_venue_id and t.code = v_code) then
    v_code := v_code || '_' || (select count(*) + 1 from public.table_type t where t.venue_id = p_venue_id and t.code like v_code || '%');
  end if;
  begin
    insert into public.table_type (venue_id, code, name, small_blind_paise, big_blind_paise, straddle_paise, buy_in_min_paise, buy_in_max_paise)
    values (p_venue_id, v_code, trim(p_name), p_small_blind_paise, p_big_blind_paise, p_straddle_paise, p_big_blind_paise * 100,
            p_big_blind_paise * 100)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name and blinds in whole ₹50 chips, the big above the small, and any straddle above both'
      using errcode = '22023';
  end;
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'call_time.minutes', v_code, '{"minutes": 180}', now(), 'A new stake has three hours of call time (#634)');
  return v_id;
end;
$$;

-- A stake's name, blinds and straddle, changed; a table playing it plays them from the next hand. Refusals as above.
create function private.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                       p_straddle_paise bigint default null)
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
  perform private.assert_straddle(p_big_blind_paise, p_straddle_paise);
  begin
    update public.table_type
    set name = trim(p_name), small_blind_paise = p_small_blind_paise, big_blind_paise = p_big_blind_paise, straddle_paise = p_straddle_paise,
        buy_in_min_paise = least(buy_in_min_paise, p_big_blind_paise * 100), buy_in_max_paise = greatest(buy_in_max_paise, p_big_blind_paise * 100)
    where id = v_type.id;
  exception when check_violation or not_null_violation then
    raise exception 'A stake has a name and blinds in whole ₹50 chips, the big above the small, and any straddle above both'
      using errcode = '22023';
  end;
end;
$$;

create function public.add_table_type(p_venue_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                      p_straddle_paise bigint default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_table_type(p_venue_id, p_name, p_small_blind_paise, p_big_blind_paise, p_straddle_paise); $$;
create function public.set_table_type(p_type_id uuid, p_name text, p_small_blind_paise bigint, p_big_blind_paise bigint,
                                      p_straddle_paise bigint default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_table_type(p_type_id, p_name, p_small_blind_paise, p_big_blind_paise, p_straddle_paise); $$;

revoke execute on function private.assert_straddle(bigint, bigint), private.add_table_type(uuid, text, bigint, bigint, bigint),
  private.set_table_type(uuid, text, bigint, bigint, bigint), public.add_table_type(uuid, text, bigint, bigint, bigint),
  public.set_table_type(uuid, text, bigint, bigint, bigint) from public, anon;
grant execute on function private.assert_straddle(bigint, bigint), private.add_table_type(uuid, text, bigint, bigint, bigint),
  private.set_table_type(uuid, text, bigint, bigint, bigint), public.add_table_type(uuid, text, bigint, bigint, bigint),
  public.set_table_type(uuid, text, bigint, bigint, bigint) to authenticated;
