-- A visit from an earlier club day with nothing still open in it is closed without waiting for the member to come back
-- (audit F-016). Until now only that member's next check-in closed it, so a visit left open by a freeze stayed open for
-- weeks. Once a day, at 11:10 IST: closing a visit can send the review request, which should not go out at 06:00. One held
-- by a stop closes the first morning after its release. A check-out stays refused during a freeze (decision 0161): closing
-- a visit credits its points and nights.

create function private.close_stale_visits()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  for v_member in
    select v.member_id from public.visit v where v.closed_at is null and v.opened_at < private.tonight_began(now())
  loop
    begin
      -- One at a time per member, as check-in and seating take it first.
      perform 1 from public.member m where m.id = v_member for update;
      perform private.close_stale_visit(v_member);
    exception
      when sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
        -- A stop in force: a later run closes it once the stop is released.
        continue;
      when others then
        raise warning 'stale visit: member % not closed: %', v_member, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function private.close_stale_visits() from public, anon, authenticated;

select cron.schedule('close-stale-visits', '40 5 * * *', 'select private.close_stale_visits()');
