-- One request, one write (A3 of the Fix Tracker; the 28 Oct audit, A2-10 and F2-28): a promotion submitted from the
-- builder, and a food or drink order from the console, carry a request id, so a retry after a lost answer returns the
-- first instead of making a second promotion or a second kitchen ticket. Tournaments are hidden (decision 0284).

alter table public.promotion add column idempotency_key uuid;
create unique index promotion_idempotency_key on public.promotion (venue_id, idempotency_key) where idempotency_key is not null;
alter table public.fnb_order add column idempotency_key uuid;
create unique index fnb_order_idempotency_key on public.fnb_order (venue_id, idempotency_key) where idempotency_key is not null;
insert into private.member_export_column (table_name, column_name, kind) values ('fnb_order', 'idempotency_key', 'owed');

-- As in 20261029090100_promotion_rules_and_questions.sql, with the request id (`request_id` in the promotion): the same
-- id again returns the promotion it made, and refuses one named otherwise (22023), as the waitlist and the cage refuse a
-- request id used for another request.
create or replace function private.submit_promotion(p_venue_id uuid, p_promotion jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key uuid := nullif(p_promotion ->> 'request_id', '')::uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions submit one' using errcode = '42501';
  end if;
  if v_key is not null then
    select p.id into v_id from public.promotion p where p.venue_id = p_venue_id and p.idempotency_key = v_key;
    if v_id is not null and (select p.name from public.promotion p where p.id = v_id) is distinct from btrim(p_promotion ->> 'name') then
      raise exception 'That request id was for another promotion' using errcode = '22023';
    end if;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  if jsonb_typeof(p_promotion -> 'rule') is distinct from 'object' then
    raise exception 'A promotion is submitted with its rule' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_promotion -> 'rules', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'A promotion''s rules are a list' using errcode = '22023';
  end if;
  insert into public.promotion (venue_id, name, status, detail, runs, per_player_limit, per_player_period, requested_by_staff_id, requested_at,
                                rules, questions, idempotency_key)
  values (p_venue_id, btrim(p_promotion ->> 'name'), 'pending', nullif(btrim(p_promotion ->> 'detail'), ''), btrim(p_promotion ->> 'runs'),
          (p_promotion ->> 'per_player_limit')::integer, p_promotion ->> 'per_player_period', private.current_staff_id(p_venue_id), now(),
          array(select btrim(r) from jsonb_array_elements_text(coalesce(p_promotion -> 'rules', '[]'::jsonb)) r),
          coalesce(p_promotion -> 'questions', '[]'::jsonb), v_key)
  returning id into v_id;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values (p_venue_id, v_id, p_promotion #>> '{rule,trigger}', coalesce(p_promotion #> '{rule,conditions}', '{}'::jsonb), p_promotion #> '{rule,effect}');
  return v_id;
end;
$$;

-- As in 20261028391700_fnb_orders.sql, with a request id: the same id again returns the order it placed, and refuses one
-- for another seat or paid otherwise (22023).
drop function public.console_fnb_order(uuid, uuid, integer, jsonb, boolean);
drop function private.console_fnb_order(uuid, uuid, integer, jsonb, boolean);
create function private.console_fnb_order(p_venue_id uuid, p_table_id uuid, p_seat integer, p_lines jsonb, p_is_comp boolean,
                                          p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
  v_order_id uuid;
  v_kot integer;
begin
  if not private.has_permission(p_venue_id, 'fnb.manage') then
    raise exception 'Only staff who run F&B order from the console' using errcode = '42501';
  end if;
  if p_idempotency_key is not null then
    if exists (select 1 from public.fnb_order o where o.venue_id = p_venue_id and o.idempotency_key = p_idempotency_key
               and (o.table_id is distinct from p_table_id or o.seat is distinct from p_seat or o.is_comp is distinct from p_is_comp)) then
      raise exception 'That request id was for another order' using errcode = '22023';
    end if;
    return query select o.id, o.kot_number from public.fnb_order o where o.venue_id = p_venue_id and o.idempotency_key = p_idempotency_key;
    if found then
      return;
    end if;
  end if;
  select * into v_session from public.seat_session s
  where s.venue_id = p_venue_id and s.table_id = p_table_id and s.seat = p_seat and s.ended_at is null;
  if v_session.id is null then
    raise exception 'Nobody sits in that seat' using errcode = 'RVFNS';
  end if;
  select r.order_id, r.kot_number into v_order_id, v_kot
  from private.record_fnb_order(v_session, p_lines, p_is_comp, 'console', private.current_staff_id(p_venue_id), null) r;
  update public.fnb_order set idempotency_key = p_idempotency_key where id = v_order_id and p_idempotency_key is not null;
  return query select v_order_id, v_kot;
end;
$$;
create function public.console_fnb_order(p_venue_id uuid, p_table_id uuid, p_seat integer, p_lines jsonb, p_is_comp boolean,
                                         p_idempotency_key uuid default null)
returns table (order_id uuid, kot_number integer) language sql volatile security invoker set search_path = ''
as $$ select * from private.console_fnb_order(p_venue_id, p_table_id, p_seat, p_lines, p_is_comp, p_idempotency_key); $$;

revoke execute on function private.console_fnb_order(uuid, uuid, integer, jsonb, boolean, uuid),
  public.console_fnb_order(uuid, uuid, integer, jsonb, boolean, uuid) from public, anon;
grant execute on function private.console_fnb_order(uuid, uuid, integer, jsonb, boolean, uuid),
  public.console_fnb_order(uuid, uuid, integer, jsonb, boolean, uuid) to authenticated;
