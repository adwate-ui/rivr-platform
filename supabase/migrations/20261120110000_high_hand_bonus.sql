-- The high hand bonus (redesign of 15 Nov 2026, issue 965, RD-22; docs/spec/redesign-2026-11-15.md slice 8, corrections 10,
-- 11 and 21). A promotion lists hands from a fixed list, each with its own Bonus, and holds three rules. The floor logs a
-- hit against a table, a player seated at it and a hand; every rule is confirmed; the Bonus is paid at once, every time,
-- as one ledger entry, within the promotion's budget and apart from the daily limit on Bonus added by hand. One high hand
-- promotion runs in a venue. This is not the old high hand claim (removed by 20261117210000): nothing is claimed or
-- approved, and nothing comes from the dealer's tablet.

-- A hand's ranks (@rivr/domain ranksOf): a straight flush's high card, king to five; which four of a kind; the three of a
-- full house. A royal flush and Aces full have none.
create function private.high_hand_ranks(p_hand text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_hand
    when 'straight_flush' then array['king', 'queen', 'jack', 'ten', 'nine', 'eight', 'seven', 'six', 'five']
    when 'four_of_a_kind' then array['ace', 'king', 'queen', 'jack', 'ten', 'nine', 'eight', 'seven', 'six', 'five', 'four', 'three', 'two']
    when 'full_house' then array['ace', 'king', 'queen', 'jack', 'ten', 'nine', 'eight', 'seven', 'six', 'five', 'four', 'three', 'two']
    else array[]::text[] end;
$$;

-- What a hit pays (@rivr/domain highHandPayout; packages/testing/golden/promotionRewards.json): the listed hand it is paid
-- as, its rank and that hand's chips; or why not, the first of: the hand is not listed, the rank is not one the hand has,
-- a rule the promotion holds is not confirmed (the players dealt in always). A full house of three aces is Aces full where
-- the promotion lists it, and any full house otherwise.
create function private.high_hand_payout(p_reward jsonb, p_hit jsonb)
returns table (o_hand text, o_rank text, o_chips bigint, o_refusal text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_hand text := p_hit ->> 'hand';
  v_rank text := p_hit ->> 'rank';
  v_ranks text[] := private.high_hand_ranks(v_hand);
  v_listed jsonb;
  v_refusal text;
begin
  select h.listed into v_listed
  from unnest(case when v_hand = 'aces_full' or (v_hand = 'full_house' and v_rank = 'ace') then array['aces_full', 'full_house']
                   else array[v_hand] end) with ordinality as c (hand, n)
  join jsonb_array_elements(p_reward -> 'hands') as h (listed) on h.listed ->> 'hand' = c.hand
  order by c.n
  limit 1;
  v_refusal := case
    when v_listed is null then 'hand_not_listed'
    when (cardinality(v_ranks) = 0) <> (v_rank is null) or (v_rank is not null and cardinality(v_ranks) > 0 and v_rank <> all (v_ranks))
      then 'wrong_rank'
    -- Confirmed is the JSON value true and nothing else: not a word, not a number.
    when p_reward #> '{rules,bothHoleCards}' = 'true' and p_hit #> '{confirmed,bothHoleCards}' is distinct from 'true'
      then 'both_hole_cards_not_confirmed'
    when p_reward #> '{rules,shownAtShowdown}' = 'true' and p_hit #> '{confirmed,shownAtShowdown}' is distinct from 'true'
      then 'showdown_not_confirmed'
    when p_hit #> '{confirmed,playersDealt}' is distinct from 'true' then 'players_not_confirmed'
  end;
  if v_refusal is not null then
    return query select null::text, null::text, 0::bigint, v_refusal;
  else
    return query select v_listed ->> 'hand',
                        case when v_listed ->> 'hand' = 'aces_full' then null when v_hand = 'aces_full' then 'ace' else v_rank end,
                        (v_listed ->> 'chips')::bigint, null::text;
  end if;
end;
$$;

-- What is left of a budget given a tally (@rivr/domain budgetLeft): never below nothing; null with no budget.
create function private.promo_budget_left(p_limits jsonb, p_tally jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when p_limits ? 'budgetChips' then greatest(0, (p_limits ->> 'budgetChips')::bigint - (p_tally ->> 'chipsGiven')::bigint) end;
$$;

revoke execute on function private.high_hand_ranks(text), private.high_hand_payout(jsonb, jsonb), private.promo_budget_left(jsonb, jsonb)
  from public, anon, authenticated;

-- A version's terms, as 20261120100000 left them, with the high hand: hands from the fixed list, each once with its chips,
-- and its three rules. It is paid every time, so it takes no limit a member, a day or in grants: its budget alone holds it,
-- and so it must have one (the safest reading: nothing else bounds what the floor pays).
CREATE OR REPLACE FUNCTION private.is_promotion_terms(p_reward jsonb, p_eligibility jsonb, p_schedule jsonb, p_limits jsonb, p_channels jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
      "$defs": {
        "chips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "minutes": {"type": "integer", "minimum": 30, "maximum": 1440, "multipleOf": 30},
        "firstN": {"type": "integer", "minimum": 1, "maximum": 100}
      },
      "oneOf": [
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips"],
         "properties": {"kind": {"const": "seat_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "firstNSeatsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tiers"],
         "properties": {"kind": {"const": "seat_bonus"}, "tiers": {"type": "array", "minItems": 1, "maxItems": 5,
           "items": {"type": "object", "additionalProperties": false, "required": ["count", "chips"],
                     "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 10000}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "afterMinutes"],
         "properties": {"kind": {"const": "hours_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "afterMinutes": {"$ref": "#/$defs/minutes"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "steps"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "steps"},
                        "steps": {"type": "array", "minItems": 2, "maxItems": 6,
                                  "items": {"type": "object", "additionalProperties": false, "required": ["afterMinutes", "chips"],
                                            "properties": {"afterMinutes": {"$ref": "#/$defs/minutes"}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "everyMinutes", "chips"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "every"},
                        "everyMinutes": {"type": "integer", "minimum": 30, "maximum": 720, "multipleOf": 30}, "chips": {"$ref": "#/$defs/chips"},
                        "timesPerVisit": {"type": "integer", "minimum": 1, "maximum": 20}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "on"],
         "properties": {"kind": {"const": "bonus_chips"}, "chips": {"$ref": "#/$defs/chips"}, "on": {"enum": ["visit", "referral", "signup"]}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "fromVisitInMonth"],
         "properties": {"kind": {"const": "cab_home"}, "fromVisitInMonth": {"type": "integer", "minimum": 1, "maximum": 31}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournamentId"],
         "properties": {"kind": {"const": "tournament_entry"}, "tournamentId": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "waitlist_priority"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "hands", "rules"],
         "properties": {"kind": {"const": "high_hand"},
                        "hands": {"type": "array", "minItems": 1, "maxItems": 5,
                                  "items": {"type": "object", "additionalProperties": false, "required": ["hand", "chips"],
                                            "properties": {"hand": {"enum": ["royal_flush", "straight_flush", "four_of_a_kind", "aces_full", "full_house"]},
                                                           "chips": {"$ref": "#/$defs/chips"}}}},
                        "rules": {"type": "object", "additionalProperties": false, "required": ["bothHoleCards", "shownAtShowdown", "minPlayersDealt"],
                                  "properties": {"bothHoleCards": {"type": "boolean"}, "shownAtShowdown": {"type": "boolean"},
                                                 "minPlayersDealt": {"type": "integer", "minimum": 2, "maximum": 10}}}}}
      ]
    }', p_reward)
    -- A play-time bonus's set steps each later than the one before (owner, 8 Nov).
    and (p_reward ->> 'mode' is distinct from 'steps' or private.is_rising_steps(p_reward -> 'steps'))
    -- A high hand lists each hand once, and is held by its budget alone, which it must have (redesign RD-22).
    and (p_reward ->> 'kind' is distinct from 'high_hand'
         or ((select count(distinct h ->> 'hand') = count(*) from jsonb_array_elements(p_reward -> 'hands') h)
             and p_limits ->> 'perMember' = 'none' and not p_limits ? 'maxMembersPerDay' and not p_limits ? 'maxGrants'
             and p_limits ? 'budgetChips'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["stakes", "tiers", "audience"],
      "properties": {
        "stakes": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[a-z0-9_]{2,40}$"}}]},
        "tableIds": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "tiers": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}}]},
        "audience": {"enum": ["everyone", "new_30d", "lapsed"]}
      }
    }', p_eligibility)
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["days", "from", "to", "startsOn", "timezone"],
      "properties": {
        "days": {"type": "array", "minItems": 1, "maxItems": 7, "uniqueItems": true, "items": {"type": "integer", "minimum": 1, "maximum": 7}},
        "from": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "to": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "startsOn": {"type": "string"},
        "endsOn": {"type": "string"},
        "timezone": {"const": "Asia/Kolkata"}
      }
    }', p_schedule)
    and private.is_iso_day(p_schedule ->> 'startsOn')
    and (not p_schedule ? 'endsOn' or (private.is_iso_day(p_schedule ->> 'endsOn') and p_schedule ->> 'endsOn' >= p_schedule ->> 'startsOn'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["perMember"],
      "properties": {
        "perMember": {"enum": ["none", "per_visit", "per_day", "per_week", "once"]},
        "timesPerMember": {"type": "integer", "minimum": 2, "maximum": 20},
        "maxMembersPerDay": {"type": "integer", "minimum": 1, "maximum": 10000},
        "budgetChips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "maxGrants": {"type": "integer", "minimum": 1, "maximum": 1000000},
        "budgetPeriod": {"enum": ["month"]}
      }
    }', p_limits)
    -- Up to N times a member needs a period; a monthly budget needs a budget or most grants (decision 0499).
    and (not p_limits ? 'timesPerMember' or p_limits ->> 'perMember' <> 'none')
    and (not p_limits ? 'budgetPeriod' or p_limits ? 'budgetChips' or p_limits ? 'maxGrants')
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["playerApp", "tv", "website", "whatsapp"],
      "properties": {"playerApp": {"type": "boolean"}, "tv": {"type": "boolean"}, "website": {"type": "boolean"}, "whatsapp": {"type": "boolean"}}
    }', p_channels)
    -- A seat bonus in tiers counts its claims over the promotion's life, each member once (decision 0580): no monthly reset.
    and (not (p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'tiers')
         or (p_limits ->> 'perMember' = 'once' and not p_limits ? 'timesPerMember' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$
;

-- A high hand is given for a high hand, never for a visit (@rivr/domain triggerOf).
CREATE OR REPLACE FUNCTION private.promotion_event_kind(p_reward jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'seat_bonus' then 'seated'
    when p_reward ->> 'kind' = 'bonus_chips' then p_reward ->> 'on'
    when p_reward ->> 'kind' = 'high_hand' then 'high_hand'
    else 'visit' end;
$function$
;

-- What a reward gives for one event (@rivr/domain computeGrant), as 20261120100000 left it, with the high hand.
CREATE OR REPLACE FUNCTION private.promo_grant(p_reward jsonb, p_event jsonb)
 RETURNS TABLE(o_chips bigint, o_perk text, o_refusal text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_kind text := p_reward ->> 'kind';
  v_event text := p_event ->> 'kind';
  v_chips bigint := 0;
  v_perk text;
  v_refusal text;
  v_step bigint;
begin
  if v_event = 'seated' and v_kind = 'seat_bonus' then
    -- In tiers (decision 0580): on the first seat of a visit, at the first tier's chips until the limits set the tier.
    if (p_reward ? 'tiers' or not p_reward ? 'firstNSeatsPerTable') and not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_seat';
    else
      v_chips := coalesce((p_reward ->> 'chips')::bigint, (p_reward -> 'tiers' -> 0 ->> 'chips')::bigint);
    end if;
  elsif v_event = 'hours_step' and v_kind = 'hours_bonus' then
    select s.o_chips into v_step from private.promo_hours_steps(p_reward) s where s.o_after_minutes = (p_event ->> 'stepMinutes')::integer;
    if v_step is null then
      v_refusal := 'not_a_step';
    elsif (p_event ->> 'minutes')::integer < (p_event ->> 'stepMinutes')::integer then
      v_refusal := 'too_short';
    else
      v_chips := v_step;
    end if;
  elsif v_event = 'visit' and v_kind = 'cab_home' then
    if (p_event ->> 'visitInMonth')::integer >= (p_reward ->> 'fromVisitInMonth')::integer then v_perk := 'cab_home'; else v_refusal := 'not_yet'; end if;
  elsif v_event = 'visit' and v_kind in ('tournament_entry', 'waitlist_priority') then
    v_perk := v_kind;
  elsif v_kind = 'bonus_chips' and v_event in ('visit', 'referral', 'signup') and p_reward ->> 'on' = v_event then
    v_chips := (p_reward ->> 'chips')::bigint;
  elsif v_event = 'high_hand' and v_kind = 'high_hand' then
    -- The listed hand's chips, whole, every time (redesign RD-22).
    select h.o_chips, h.o_refusal into v_chips, v_refusal from private.high_hand_payout(p_reward, p_event) h;
  else
    v_refusal := 'other_event';
  end if;
  if v_refusal is not null then
    return query select 0::bigint, null::text, v_refusal;
  else
    return query select v_chips, v_perk, null::text;
  end if;
end;
$function$
;

-- One high hand promotion runs in a venue: scheduled, live or paused. The index holds it under any race; submitting and
-- approving say so in words first.
create unique index promotion_version_one_high_hand on public.promotion_version (venue_id)
  where status in ('scheduled', 'live', 'paused') and reward ->> 'kind' = 'high_hand';

create function private.assert_only_high_hand(p_version public.promotion_version)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_version.reward ->> 'kind' = 'high_hand' and exists (
       select 1 from public.promotion_version o
       where o.venue_id = p_version.venue_id and o.promotion_id <> p_version.promotion_id
         and o.status in ('scheduled', 'live', 'paused') and o.reward ->> 'kind' = 'high_hand') then
    raise exception 'Another high hand promotion is running: end it first' using errcode = 'RVHH1';
  end if;
end;
$$;
revoke execute on function private.assert_only_high_hand(public.promotion_version) from public, anon, authenticated;

-- Submitting, as 20261107100000 made it, refused while another high hand promotion runs.
CREATE OR REPLACE FUNCTION private.submit_promotion_version(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if v_version.status <> 'draft' then
    raise exception 'Only a draft is submitted' using errcode = 'RVDEC';
  end if;
  if v_version.simulated_terms is distinct from private.version_terms(v_version) then
    raise exception 'Simulate this version on last week before submitting it' using errcode = 'RVSIM';
  end if;
  perform private.assert_only_high_hand(v_version);
  update public.promotion_version
  set status = 'awaiting_approval', author_staff_id = private.current_staff_id(v_version.venue_id), submitted_at = now(),
      decided_by_staff_id = null, decided_at = null, rejected_reason = null
  where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$function$
;

-- Approving, the same: one may have gone live since this was submitted.
CREATE OR REPLACE FUNCTION private.approve_promotion_version(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.approve');
  v_staff_id uuid := private.current_staff_id(v_version.venue_id);
begin
  if v_version.status <> 'awaiting_approval' then
    raise exception 'This version is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  if v_staff_id is null or v_staff_id = v_version.author_staff_id or v_staff_id = v_version.edited_by_staff_id then
    raise exception 'Another super admin approves the promotion you submitted or changed' using errcode = 'RVTWO';
  end if;
  perform private.assert_only_high_hand(v_version);
  update public.promotion_version set status = 'ended' where promotion_id = v_version.promotion_id and status in ('scheduled', 'live', 'paused');
  update public.promotion_version
  set status = case when (v_version.schedule ->> 'startsOn')::date <= private.club_day_of(now()) then 'live' else 'scheduled' end,
      decided_by_staff_id = v_staff_id, decided_at = now()
  where id = p_version_id;
  delete from public.promotion_budget b where b.promotion_id = v_version.promotion_id;
  if v_version.limits ? 'budgetChips' or v_version.limits ? 'maxGrants' then
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count, period)
    values (v_version.venue_id, v_version.promotion_id, (v_version.limits ->> 'budgetChips')::bigint * 100, (v_version.limits ->> 'maxGrants')::integer,
            -- A monthly budget is the wheel's and the reports' monthly cap too (decision 0499).
            case v_version.limits ->> 'budgetPeriod' when 'month' then 'month' else 'promotion' end);
  end if;
  perform private.sync_promotion(v_version.promotion_id);
  perform private.emit(v_version.venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id, 'name', v_version.name,
                                          'detail', v_version.detail, 'runs', v_version.runs),
                       'promotion.published:' || v_version.id);
end;
$function$
;

-- Each hit the floor logged, once paid: who, where, which hand, what it paid and who logged it. Never changed.
create table public.high_hand_hit (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  promotion_id uuid not null,
  promotion_version_id uuid not null,
  promotion_grant_id uuid not null references public.promotion_grant (id),
  bonus_grant_id uuid not null references public.bonus_grant (id),
  member_id uuid not null,
  table_id uuid not null,
  session_id uuid not null references public.seat_session (id),
  seat integer not null check (seat between 1 and 10),
  hand text not null check (hand in ('royal_flush', 'straight_flush', 'four_of_a_kind', 'aces_full', 'full_house')),
  rank text check (rank in ('ace', 'king', 'queen', 'jack', 'ten', 'nine', 'eight', 'seven', 'six', 'five', 'four', 'three', 'two')),
  chips bigint not null check (chips >= 50 and chips % 50 = 0),
  request_id uuid not null,
  logged_by_staff_id uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, request_id),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id),
  foreign key (promotion_version_id, venue_id) references public.promotion_version (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id)
);
comment on table public.high_hand_hit is 'High hands the floor logged and paid (redesign RD-22). One row a hit; rows are never changed.';

create index high_hand_hit_venue_time_idx on public.high_hand_hit (venue_id, created_at desc);
create index high_hand_hit_promotion_idx on public.high_hand_hit (promotion_id, venue_id, created_at desc);
create index high_hand_hit_version_idx on public.high_hand_hit (promotion_version_id, venue_id);
create index high_hand_hit_grant_idx on public.high_hand_hit (promotion_grant_id);
create index high_hand_hit_bonus_idx on public.high_hand_hit (bonus_grant_id);
create index high_hand_hit_member_idx on public.high_hand_hit (member_id, venue_id);
create index high_hand_hit_table_idx on public.high_hand_hit (table_id, venue_id);
create index high_hand_hit_session_idx on public.high_hand_hit (session_id);
create index high_hand_hit_staff_idx on public.high_hand_hit (logged_by_staff_id);
create trigger high_hand_hit_touch_updated_at before update on public.high_hand_hit
  for each row execute function private.touch_updated_at();

-- Read by everyone who sees the Live floor (its strip shows tonight's) and by staff who manage promotions. Written only by
-- log_high_hand, which fewer may call.
alter table public.high_hand_hit enable row level security;
revoke all on public.high_hand_hit from anon, authenticated;
grant select on public.high_hand_hit to authenticated;
create policy "the floor and promotion managers see the venue's high hands" on public.high_hand_hit
  for select to authenticated
  using (venue_id in (select private.venues_where('waitlist.manage')) or venue_id in (select private.venues_where('promotions.manage')));

-- A member's own data export gives what they were paid for and where, not which staff member logged it.
insert into private.member_export_column (table_name, column_name, kind) values
  ('high_hand_hit', 'id', 'owed'), ('high_hand_hit', 'venue_id', 'owed'), ('high_hand_hit', 'promotion_id', 'owed'),
  ('high_hand_hit', 'promotion_version_id', 'owed'), ('high_hand_hit', 'promotion_grant_id', 'owed'), ('high_hand_hit', 'bonus_grant_id', 'owed'),
  ('high_hand_hit', 'member_id', 'owed'), ('high_hand_hit', 'table_id', 'owed'), ('high_hand_hit', 'session_id', 'owed'),
  ('high_hand_hit', 'seat', 'owed'), ('high_hand_hit', 'hand', 'owed'), ('high_hand_hit', 'rank', 'owed'), ('high_hand_hit', 'chips', 'owed'),
  ('high_hand_hit', 'created_at', 'owed'), ('high_hand_hit', 'updated_at', 'owed'),
  ('high_hand_hit', 'request_id', 'withheld'), ('high_hand_hit', 'logged_by_staff_id', 'withheld');

-- The floor logs a high hand: a table, a player seated at it, a hand from the promotion's list with its rank, and each rule
-- confirmed. The Bonus is paid at once through the promotion's grant, one ledger entry (credit_bonus), and the hit is kept,
-- audited with who logged it, and announced (high_hand.paid) for the member's app and the TVs. The same request again is
-- the same hit and pays nothing more; the same request for another player, table or hand is refused (22023). Refused,
-- saying which: nobody but those who add Bonus by hand (42501: bonus.give, so super admins, admins and floor managers, as
-- the owner ruled for Bonus on 9 Nov; open with the owner); one's own member record (RVOWN); no high hand promotion live
-- (RVHHN); a player not seated at that table (RVHHS); a table, player or moment the promotion is not for (RVHHE); a hand
-- not listed, a wrong rank or an unconfirmed rule (RVHHR, the detail names it); a payout past the budget (RVHHB, the detail
-- is what is left). The daily limit on Bonus added by hand is not this function's: it holds give_bonus_chips alone.
create function private.log_high_hand(p_table_id uuid, p_member_id uuid, p_hand text, p_rank text, p_confirmed jsonb, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
  v_hit public.high_hand_hit;
  v_version public.promotion_version;
  v_session public.seat_session;
  v_event jsonb;
  v_payout record;
  v_tally jsonb;
  v_refusal text;
  v_grant_id uuid;
  v_id uuid;
begin
  -- It pays Bonus, so it is theirs who add Bonus by hand. An unknown table reads the same as no permission.
  select * into v_table from public.game_table t where t.id = p_table_id;
  if v_table.id is null or not coalesce(private.has_permission(v_table.venue_id, 'bonus.give'), false) then
    raise exception 'Only super admins, admins and floor managers log a high hand' using errcode = '42501';
  end if;
  if p_request_id is null or p_member_id is null or p_hand is null
     or jsonb_typeof(p_confirmed -> 'bothHoleCards') is distinct from 'boolean' or jsonb_typeof(p_confirmed -> 'shownAtShowdown') is distinct from 'boolean'
     or jsonb_typeof(p_confirmed -> 'playersDealt') is distinct from 'boolean' then
    raise exception 'A player, a hand, each rule confirmed or not, and a request id' using errcode = '22023';
  end if;
  -- The same request waits for its first try, then is answered with it.
  perform pg_advisory_xact_lock(hashtextextended('high_hand:' || v_table.venue_id::text || ':' || p_request_id::text, 0));
  select * into v_hit from public.high_hand_hit h where h.venue_id = v_table.venue_id and h.request_id = p_request_id;
  if v_hit.id is not null then
    -- The same hand, however it was named: Aces full is a full house of aces.
    if v_hit.member_id <> p_member_id or v_hit.table_id <> p_table_id
       or (case when v_hit.hand = 'aces_full' then 'full_house ace' else v_hit.hand || ' ' || coalesce(v_hit.rank, '') end)
          <> (case when p_hand = 'aces_full' then 'full_house ace' else p_hand || ' ' || coalesce(p_rank, '') end) then
      raise exception 'That request id was used for another high hand' using errcode = '22023';
    end if;
    return v_hit.id;
  end if;
  -- As Bonus added by hand: never one's own record, by login, phone or name.
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never log a high hand for their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_table.venue_id, 'promotions', p_member_id);
  -- The one live high hand promotion, locked so two hits at once cannot both fit a budget that has room for one.
  select v.* into v_version from public.promotion_version v
  where v.venue_id = v_table.venue_id and v.status = 'live' and v.reward ->> 'kind' = 'high_hand'
  for update;
  if v_version.id is null then
    raise exception 'No high hand promotion is live' using errcode = 'RVHHN';
  end if;
  select s.* into v_session from public.seat_session s
  where s.table_id = p_table_id and s.member_id = p_member_id and s.ended_at is null;
  if v_session.id is null then
    raise exception 'That player is not seated at that table now: log a high hand before the seat is ended' using errcode = 'RVHHS';
  end if;
  v_event := jsonb_build_object('kind', 'high_hand', 'key', 'high_hand:' || p_request_id, 'at', now(), 'memberId', p_member_id,
    'visitId', v_session.visit_id, 'tableId', p_table_id,
    'stake', (select tt.code from public.table_type tt where tt.id = v_table.table_type_id),
    'hand', p_hand, 'rank', p_rank, 'confirmed', p_confirmed);
  if not private.promo_is_eligible(jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule),
                                   private.promotion_member_facts(p_member_id), v_event) then
    raise exception 'The high hand promotion is not for this player at this table now' using errcode = 'RVHHE';
  end if;
  select * into v_payout from private.high_hand_payout(v_version.reward, v_event);
  if v_payout.o_refusal is not null then
    raise exception 'The high hand is not paid: %', v_payout.o_refusal using errcode = 'RVHHR', detail = v_payout.o_refusal;
  end if;
  v_tally := private.promotion_tally(v_version.promotion_id, p_member_id, 'event:high_hand:' || p_request_id, p_table_id,
                                     private.club_day_of(now()), v_version.limits);
  v_refusal := private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_payout.o_chips), v_tally);
  if v_refusal = 'budget_exhausted' then
    raise exception 'The budget has % Bonus left', private.promo_budget_left(v_version.limits, v_tally)
      using errcode = 'RVHHB', detail = private.promo_budget_left(v_version.limits, v_tally)::text;
  elsif v_refusal is not null then
    raise exception 'The high hand is not paid: %', v_refusal using errcode = 'RVHHR', detail = v_refusal;
  end if;
  v_grant_id := private.give_promotion_version(jsonb_build_object(
    'version_id', v_version.id, 'trigger', 'high_hand', 'chips', v_payout.o_chips, 'perk', null,
    'period_key', 'event:high_hand:' || p_request_id, 'event', v_event));
  if v_grant_id is null then
    raise exception 'The high hand was not paid: its grant was already given' using errcode = 'RVHHR', detail = 'already_given';
  end if;
  insert into public.high_hand_hit (venue_id, promotion_id, promotion_version_id, promotion_grant_id, bonus_grant_id, member_id, table_id,
                                    session_id, seat, hand, rank, chips, request_id, logged_by_staff_id)
  select v_table.venue_id, v_version.promotion_id, v_version.id, g.id, g.bonus_grant_id, p_member_id, p_table_id, v_session.id, v_session.seat,
         v_payout.o_hand, v_payout.o_rank, v_payout.o_chips, p_request_id, private.current_staff_id(v_table.venue_id)
  from public.promotion_grant g where g.id = v_grant_id
  returning id into v_id;
  perform private.audit(v_table.venue_id, 'high_hand.pay', 'high_hand_hit', v_id::text, null,
                        jsonb_build_object('member_id', p_member_id, 'table_id', p_table_id, 'table', v_table.name, 'seat', v_session.seat,
                                           'hand', v_payout.o_hand, 'rank', v_payout.o_rank, 'chips', v_payout.o_chips,
                                           'promotion_id', v_version.promotion_id, 'promotion', v_version.name));
  perform private.emit(v_table.venue_id, 'high_hand.paid',
                       jsonb_build_object('high_hand_hit_id', v_id, 'promotion_id', v_version.promotion_id, 'member_id', p_member_id,
                                          'table_id', p_table_id, 'table_name', v_table.name, 'seat', v_session.seat, 'hand', v_payout.o_hand,
                                          'rank', v_payout.o_rank, 'chips', v_payout.o_chips),
                       'high_hand.paid:' || v_id);
  return v_id;
end;
$$;

create function public.log_high_hand(p_table_id uuid, p_member_id uuid, p_hand text, p_rank text, p_confirmed jsonb, p_request_id uuid)
returns uuid
language sql security invoker set search_path = ''
as $$ select private.log_high_hand(p_table_id, p_member_id, p_hand, p_rank, p_confirmed, p_request_id); $$;

revoke execute on function private.log_high_hand(uuid, uuid, text, text, jsonb, uuid), public.log_high_hand(uuid, uuid, text, text, jsonb, uuid)
  from public, anon;
grant execute on function private.log_high_hand(uuid, uuid, text, text, jsonb, uuid), public.log_high_hand(uuid, uuid, text, text, jsonb, uuid)
  to authenticated;
