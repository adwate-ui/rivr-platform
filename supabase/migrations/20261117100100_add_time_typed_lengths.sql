-- More call time in lengths the club types (redesign of 15 Nov, RD-19). call_time.add_choices is a list of whole minutes, each
-- from 1 to 1,440 and up to twelve of them, no longer ticks from eight presets. A request, and the rule that adds one
-- (private.extended_call_time, the twin of @rivr/domain extendedCallTime on packages/testing/golden/callTimeExtension.json),
-- take any such length. Which lengths a venue offers is still its setting, checked where one is asked for or added.
--
-- The present choices carry over with no rewrite: a value set before today holds its minutes as text ("30"), a setting's row
-- is never changed once made (setting_immutable), and private.add_time_choices has always read each as a number.

insert into public.setting_key (key, description, scope, value_schema) values
  ('call_time.add_choices',
   'The lengths of more call time offered, in minutes: a member asks for one from the seat, the floor adds one. None set is 30 minutes, 1 hour and 2 hours.',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"integer","minimum":1,"maximum":1440}}},"required":["minutes"],"additionalProperties":false}')
on conflict (key) do update set description = excluded.description, value_schema = excluded.value_schema;

-- The lengths a venue offers now, shortest first, each once. A number may arrive written with a point (30.0), which the
-- schema takes as whole, so each is read as a number before it is an integer; text from before reads the same way.
create or replace function private.add_time_choices(p_venue_id uuid)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(distinct m::numeric::integer order by m::numeric::integer)
     from jsonb_array_elements_text(private.setting_at(p_venue_id, 'call_time.add_choices', '', now()) -> 'minutes') m),
    array[30, 60, 120]);
$$;

-- A request is for any length the club may type.
alter table public.call_time_request drop constraint call_time_request_minutes_check;
alter table public.call_time_request add constraint call_time_request_minutes_check check (minutes between 1 and 1440);

-- The rule: a length of 1 to 1,440 minutes, added whole to the later of the call time and the minutes played, to a seat with
-- a call time, up to a day in all; null for anything else.
create or replace function private.extended_call_time(p_current integer, p_played integer, p_add integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_add between 1 and 1440 and p_current > 0
              and greatest(p_current, coalesce(p_played, 0)) + p_add <= 1440
         then greatest(p_current, coalesce(p_played, 0)) + p_add end;
$$;
