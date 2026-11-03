-- An optional link on a promotion's card (#776; the player redesign brief, 7.8): the builder submits it with the card's
-- words, the super admin reads it before approving (decision 0244), and once live the member's card on Tonight opens it.
-- Only a plain https address is kept: printable ASCII, a host of letters, digits, dots and hyphens and no user part, so
-- the host the approver reads is the one the card opens (no `rivr.club@elsewhere`, no hidden or look-alike letters).
-- None typed is none.

alter table public.promotion add column link text
  constraint promotion_link_is_https check (link ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][!-~]*)?$' and length(link) <= 500);

-- submit_promotion, as 20261101220000_builder_promotions_take_a_budget.sql made it, with the card's link.
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
                                rules, questions, idempotency_key, link)
  values (p_venue_id, btrim(p_promotion ->> 'name'), 'pending', nullif(btrim(p_promotion ->> 'detail'), ''), btrim(p_promotion ->> 'runs'),
          (p_promotion ->> 'per_player_limit')::integer, p_promotion ->> 'per_player_period', private.current_staff_id(p_venue_id), now(),
          array(select btrim(r) from jsonb_array_elements_text(coalesce(p_promotion -> 'rules', '[]'::jsonb)) r),
          coalesce(p_promotion -> 'questions', '[]'::jsonb), v_key, nullif(btrim(p_promotion ->> 'link'), ''))
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

-- The approval queue, as 20261029090100_promotion_rules_and_questions.sql made it, with the link the card will open.
drop function public.promotions_awaiting_approval(uuid);
drop function private.promotions_awaiting_approval(uuid);
create function private.promotions_awaiting_approval(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, requested_by text, requested_at timestamptz,
               is_mine boolean, rules jsonb, per_player_limit integer, per_player_period text, budget_paise bigint, budget_count integer,
               budget_period text, website_rules text[], website_questions jsonb, link text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.detail, p.runs, p.template_key, s.full_name, p.requested_at,
         p.requested_by_staff_id = private.current_staff_id(p_venue_id),
         coalesce((select jsonb_agg(jsonb_build_object('trigger', r.trigger, 'conditions', r.conditions, 'effect', r.effect) order by r.position)
                   from public.promotion_rule r where r.promotion_id = p.id), '[]'::jsonb),
         p.per_player_limit, p.per_player_period, b.cap_paise, b.cap_count, b.period, p.rules, p.questions, p.link
  from public.promotion p
  join public.staff s on s.id = p.requested_by_staff_id
  left join public.promotion_budget b on b.promotion_id = p.id
  where p.venue_id = p_venue_id and p.status = 'pending' and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.requested_at, p.id;
$$;

create function public.promotions_awaiting_approval(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, requested_by text, requested_at timestamptz,
               is_mine boolean, rules jsonb, per_player_limit integer, per_player_period text, budget_paise bigint, budget_count integer,
               budget_period text, website_rules text[], website_questions jsonb, link text)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_awaiting_approval(p_venue_id); $$;

revoke execute on function private.promotions_awaiting_approval(uuid), public.promotions_awaiting_approval(uuid) from public, anon;
grant execute on function private.promotions_awaiting_approval(uuid), public.promotions_awaiting_approval(uuid) to authenticated;

-- The member's cards, as 20261104310000_one_referral_offer.sql made them, each with its link.
drop function public.my_promotion_cards();
drop function private.my_promotion_cards();
create function private.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text, link text)
language sql
stable
security definer
set search_path = ''
as $$
  with referral_card as (
    -- my_referral's pick, in its order: the oldest live promotion with a referral bonus.
    select p.id, (r.effect ->> 'amount_paise') is not null as has_amount
    from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
    where p.venue_id = private.current_member_venue_id() and p.status = 'live' and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at > now()) and r.trigger = 'referral' and r.effect ->> 'kind' = 'bonus'
    order by p.created_at
    limit 1
  )
  select c.promotion_id, c.title, c.detail, c.runs, p.link
  from private.promotion_cards(private.current_member_venue_id()) with ordinality c(promotion_id, title, detail, runs, n)
  join public.promotion p on p.id = c.promotion_id
  where private.has_feature(private.current_member_id(), 'promotions.feed')
    and not (private.has_feature(private.current_member_id(), 'referral.share_cards')
             and exists (select 1 from referral_card rc where rc.id = c.promotion_id and rc.has_amount))
  -- Still highest priority first, as promotion_cards gives them.
  order by c.n;
$$;

create function public.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text, link text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_promotion_cards(); $$;

revoke execute on function private.my_promotion_cards(), public.my_promotion_cards() from public, anon;
grant execute on function private.my_promotion_cards(), public.my_promotion_cards() to authenticated;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
