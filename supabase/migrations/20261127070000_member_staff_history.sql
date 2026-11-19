-- A member's History of changes by staff (the owner, 19 Nov): from the Members table, every change staff made about one
-- member, newest first: who (the staff member), when, what, each field before and after, and the reason given. Read from
-- the audit log (public.audit_log), as the Activity screen is (private.activity_line), by the same rule of what a line is
-- about: the member's own row, or a row whose before or after names them (member_id).
--
-- A change counts when its actor is staff of the venue (never the system, never the member themself) and it is on the
-- member's record or a row of theirs: their record and mobile, ID check, ID photos taken, Bonus given, used or reversed,
-- promotion Bonus, visits, seats and call time and their corrections, waitlist places, early departures, steps skipped,
-- tier, features, limits, breaks, freezes, consent and referral. Reads (an ID photo viewed) and exports are not changes.
-- Every row one action wrote in its transaction shares its time and its actor, so they are one change.
--
-- For the staff who open the Door's History (#1073): members.phone, floor and up. Identity numbers, documents and scores
-- are never shown, only that they changed; an erased member's changes keep who, when and what, without values or reasons
-- (as the Activity screen hides an erased member's reasons).

-- A member's lines, found without reading the venue's whole log.
create index audit_log_member_idx on public.audit_log
  (venue_id, (coalesce(case when entity = 'member' then entity_id end, after ->> 'member_id', before ->> 'member_id')), occurred_at desc)
  where actor_user_id is not null;

-- A field's value as staff read it: a tier or a table by its name, not its id; anything else as written.
create function private.staff_history_value(p_venue_id uuid, p_field text, p_value jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when private.uuid_or_null(p_value #>> '{}') is null then p_value
    when p_field in ('tier_id', 'from_tier_id', 'to_tier_id') then
      (select to_jsonb(t.name) from public.tier t where t.id = (p_value #>> '{}')::uuid and t.venue_id = p_venue_id)
    when p_field in ('table_id', 'call_table_id') then
      (select to_jsonb(g.name) from public.game_table g where g.id = (p_value #>> '{}')::uuid and g.venue_id = p_venue_id)
    when p_field = 'table_type_id' then
      (select to_jsonb(y.name) from public.table_type y where y.id = (p_value #>> '{}')::uuid and y.venue_id = p_venue_id)
    else p_value
  end;
$$;

-- One audit line's fields that changed, each with its value before and after. Keys and bookkeeping are left out; an
-- identity number, document or score says only that it changed.
create function private.staff_history_changes(p_venue_id uuid, p_entity text, p_before jsonb, p_after jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('entity', p_entity, 'field', k.key) ||
           case when k.key = any (array['pan', 'masked_aadhaar', 'aadhaar_reference', 'aadhaar_name', 'date_of_birth', 'address', 'photo_path',
                                        'path', 'vendor_reference', 'vendor_failure', 'entered_pan', 'entered_date_of_birth', 'identity_key',
                                        'liveness_score', 'face_match_score', 'same_face_as'])
                then jsonb_build_object('hidden', true)
                else jsonb_build_object('before', private.staff_history_value(p_venue_id, k.key, nullif(p_before -> k.key, 'null')),
                                        'after', private.staff_history_value(p_venue_id, k.key, nullif(p_after -> k.key, 'null')))
           end order by k.key), '[]'::jsonb)
  from (select jsonb_object_keys(coalesce(p_before, '{}'::jsonb) || coalesce(p_after, '{}'::jsonb)) as key) k
  where nullif(p_before -> k.key, 'null') is distinct from nullif(p_after -> k.key, 'null')
    and k.key not in ('id', 'venue_id', 'member_id', 'user_id', 'created_at', 'updated_at', 'request_id', 'given_above', 'idempotency_key')
    and (k.key not like '%\_id' or k.key in ('tier_id', 'from_tier_id', 'to_tier_id', 'table_id', 'call_table_id', 'table_type_id'));
$$;

revoke all on function private.staff_history_value(uuid, text, jsonb), private.staff_history_changes(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

-- The member's newest p_limit changes by staff (500 at most), newest first.
create function private.member_staff_history(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (id bigint, occurred_at timestamptz, who text, action text, entity text, reason text, changes jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with member as materialized (
    select m.id, m.user_id, m.erased_at is not null as is_erased
    from public.member m
    where m.id = p_member_id and m.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'members.phone'))
  ), grouped as materialized (
    -- One change is one action: the rows it wrote share its time and its actor. Its own named action, where it has one,
    -- says what it was; otherwise its first row.
    select l.occurred_at, max(l.id) as id, min(s.full_name) as who,
           (array_agg(l.action order by l.action in ('insert', 'update', 'delete'), l.id))[1] as action,
           (array_agg(l.entity order by l.action in ('insert', 'update', 'delete'), l.id))[1] as entity,
           (array_agg(l.reason order by l.id) filter (where l.reason is not null))[1] as reason,
           array_agg(l.id) as line_ids
    from member m
    join public.audit_log l
      on l.venue_id = p_venue_id and l.actor_user_id is not null
     and coalesce(case when l.entity = 'member' then l.entity_id end, l.after ->> 'member_id', l.before ->> 'member_id') = m.id::text
    join public.staff s on s.user_id = l.actor_user_id and s.venue_id = l.venue_id
    where l.actor_user_id is distinct from m.user_id
      and l.action not like '%.view' and l.action not like 'export.%'
      -- Who was frozen and why is the super admins' alone (#493): a freeze's lines only for those who read Activity.
      and (l.entity <> 'control_state' or (select private.has_permission(p_venue_id, 'activity.read')))
      and l.entity = any (array['member', 'kyc_record', 'kyc_review', 'kyc_document', 'bonus_grant', 'bonus_redemption', 'promotion_grant',
                                'visit', 'seat_session', 'waitlist_entry', 'early_departure', 'promotion_step_skip', 'member_tier_change',
                                'member_feature_override', 'member_limit', 'self_exclusion', 'control_state', 'consent', 'referral'])
    group by l.occurred_at, l.actor_user_id
    order by l.occurred_at desc, max(l.id) desc
    limit least(greatest(coalesce(p_limit, 20), 1), 500)
  )
  select g.id, g.occurred_at, g.who, g.action, g.entity,
         case when not m.is_erased or g.action = 'member.erase' then g.reason end,
         case when m.is_erased then '[]'::jsonb else coalesce((
           select jsonb_agg(distinct c.change)
           from public.audit_log a
           cross join lateral jsonb_array_elements(private.staff_history_changes(p_venue_id, a.entity, a.before, a.after)) c(change)
           where a.venue_id = p_venue_id and a.id = any (g.line_ids)), '[]'::jsonb) end
  from grouped g
  cross join member m
  order by g.occurred_at desc, g.id desc;
$$;

create function public.member_staff_history(p_venue_id uuid, p_member_id uuid, p_limit integer default 20)
returns table (id bigint, occurred_at timestamptz, who text, action text, entity text, reason text, changes jsonb)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.member_staff_history(p_venue_id, p_member_id, p_limit); $$;

revoke all on function private.member_staff_history(uuid, uuid, integer), public.member_staff_history(uuid, uuid, integer) from public, anon;
grant execute on function private.member_staff_history(uuid, uuid, integer), public.member_staff_history(uuid, uuid, integer) to authenticated;
