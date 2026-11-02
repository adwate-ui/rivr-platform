-- A top-up closes when its seat ends (decision 0302; the workflow audit of 2 Nov: "a top-up left open when the member leaves
-- never closes and comes back every night"). Whichever way the seat ends, the floor's Leave, the member's own, a cash-out,
-- its open top-up is closed as left, when the seat ended. Those left open on seats already ended are closed now.

alter table public.top_up_request drop constraint top_up_request_outcome_check;
alter table public.top_up_request add constraint top_up_request_outcome_check check (outcome in ('fulfilled', 'reset', 'left'));

create function private.close_top_ups_of_ended_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.top_up_request r set closed_at = new.ended_at, outcome = 'left'
  where r.session_id = new.id and r.closed_at is null;
  return null;
end;
$$;

revoke execute on function private.close_top_ups_of_ended_seat() from public, anon, authenticated;

create trigger close_top_ups_of_ended_seat after update of ended_at on public.seat_session
  for each row when (old.ended_at is null and new.ended_at is not null)
  execute function private.close_top_ups_of_ended_seat();

update public.top_up_request r set closed_at = s.ended_at, outcome = 'left'
from public.seat_session s
where s.id = r.session_id and r.closed_at is null and s.ended_at is not null;

-- The practice venue's seed holds no open top-up on an ended seat either (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
