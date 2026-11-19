-- Activity's About for a Bonus decision (decision 0670, the logic review of #1104): how many it decided only when it was on
-- several members. One member's decision names them; once they are erased it names no one, where it gave the count before
-- and the console read "1 approved at once". The view is the live definition with that branch alone changed.

create or replace view private.activity_line with (security_invoker = true) as
SELECT l.venue_id,
    l.id,
    l.occurred_at,
    w.name AS who,
    l.actor_user_id IS NULL AS is_system,
    l.action,
    l.entity,
    private.activity_kind(l.action, l.entity) AS kind,
    COALESCE(
        CASE
            WHEN rm.erased_at IS NULL THEN rm.full_name
            ELSE NULL::text
        END, rs.full_name,
        CASE
            WHEN l.entity = 'table'::text THEN l.entity_id
            WHEN l.entity = 'promotion_bonus_decision'::text AND NOT l.after ? 'member_id'::text THEN l.after ->> 'grants'::text
            ELSE NULL::text
        END) AS about,
        CASE
            WHEN rm.erased_at IS NULL OR l.action = 'member.erase'::text THEN l.reason
            ELSE NULL::text
        END AS reason,
        CASE
            WHEN l.action = ANY (ARRAY['bonus.give'::text, 'high_hand.pay'::text, 'bonus.approve'::text, 'bonus.refuse'::text]) THEN (l.after ->> 'chips'::text)::bigint
            ELSE NULL::bigint
        END AS amount,
        CASE
            WHEN l.action = 'high_hand.pay'::text THEN jsonb_build_object('table', l.after ->> 'table'::text, 'seat', l.after -> 'seat'::text, 'hand', l.after ->> 'hand'::text, 'rank', l.after -> 'rank'::text)
            ELSE NULL::jsonb
        END AS high_hand
   FROM audit_log l
     LEFT JOIN staff s ON s.user_id = l.actor_user_id AND s.venue_id = l.venue_id
     LEFT JOIN member a ON a.user_id = l.actor_user_id AND a.venue_id = l.venue_id
     LEFT JOIN device d ON d.id = l.device_id AND d.venue_id = l.venue_id
     CROSS JOIN LATERAL ( SELECT COALESCE(s.full_name,
                CASE
                    WHEN a.erased_at IS NULL THEN a.full_name
                    ELSE NULL::text
                END, d.name) AS name) w
     LEFT JOIN LATERAL ( SELECT COALESCE(
                CASE
                    WHEN l.entity = 'member'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'member_id'::text, l.before ->> 'member_id'::text) AS member_id,
            COALESCE(
                CASE
                    WHEN l.entity = 'staff'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'staff_id'::text, l.before ->> 'staff_id'::text) AS staff_id) t ON true
     LEFT JOIN member rm ON rm.id = private.uuid_or_null(t.member_id) AND rm.venue_id = l.venue_id
     LEFT JOIN staff rs ON rs.id = private.uuid_or_null(t.staff_id) AND rs.venue_id = l.venue_id;
