-- Last week replayed as if the version had run then (console v3 phase 7 step 3; decision 0465). The replay weighed time
-- played inside the version's schedule with its first and last days, so a promotion that starts today or later, as a
-- new one does, replayed no time at all and its simulation always gave nothing. Its days and times still count; its
-- first day becomes the replay's and it has no last day. The version keeps its own schedule: only the replay's copy
-- changes. As 20261107160000_promotion_version_replay.sql otherwise.
create or replace function private.promotion_version_replay(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
  v_to timestamptz := private.tonight_began(now());
begin
  select * into v_version from public.promotion_version v where v.id = p_version_id;
  if v_version.id is null or not coalesce(private.has_permission(v_version.venue_id, 'promotions.manage'), false) then
    raise exception 'Only staff who manage promotions simulate one' using errcode = '42501';
  end if;
  v_version.schedule := (v_version.schedule - 'endsOn') || jsonb_build_object('startsOn', private.club_day_of(v_to - interval '7 days'));
  return jsonb_build_object('from', v_to - interval '7 days', 'to', v_to,
                            'events', private.replay_version_events(v_version, v_to - interval '7 days', v_to));
end;
$$;
