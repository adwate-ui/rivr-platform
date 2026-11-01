-- A promotion from the builder takes its budget (A2-04 of the audit of 28 Oct): only the template path wrote a budget
-- row, and only in rupees, so a builder promotion had no cap at all and nothing ever set a count. `budget_paise` and
-- `budget_count` in the submission now write the row, for the whole promotion. As 20261101140000_request_ids.sql made
-- submit_promotion, its latest definition, with the budget added.

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
  -- Its budget, as a template's (A2-04): what it may give, in paise of bonus chips, and how many grants, whichever comes
  -- first; either may be left out, and neither gives no budget row, so no cap.
  if p_promotion ->> 'budget_paise' is not null or p_promotion ->> 'budget_count' is not null then
    if coalesce((p_promotion ->> 'budget_paise')::bigint, 1) <= 0 or coalesce((p_promotion ->> 'budget_count')::integer, 1) <= 0 then
      raise exception 'A budget is more than nothing' using errcode = '22023';
    end if;
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count)
    values (p_venue_id, v_id, (p_promotion ->> 'budget_paise')::bigint, (p_promotion ->> 'budget_count')::integer);
  end if;
  return v_id;
end;
$$;
