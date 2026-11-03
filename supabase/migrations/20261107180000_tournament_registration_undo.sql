-- Undo for Mark registered (console v3, Phase 3's Tournament interest tab). Every change on the console says so in a
-- toast with Undo, and Undo calls a compensating function, never a client-side rollback. This one takes back a
-- registration the floor marked by mistake: only within ten minutes of marking it, so a registration paid for and
-- settled long ago is never undone from a stale toast. Refusals: 42501 not tournaments.manage at its venue; 22023 not
-- registered, or marked more than ten minutes ago; RVFRZ the venue frozen; RVKIL registration switched off.
create function private.unmark_tournament_registered(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interest public.tournament_interest;
begin
  select * into v_interest from public.tournament_interest i where i.id = p_interest_id for update;
  if v_interest.id is null or not private.has_permission(v_interest.venue_id, 'tournaments.manage') then
    raise exception 'Only staff who manage tournaments take back a registration' using errcode = '42501';
  end if;
  if v_interest.registered_at is null or v_interest.registered_at < now() - interval '10 minutes' then
    raise exception 'Not marked registered in the last ten minutes' using errcode = '22023';
  end if;
  perform private.assert_writable(v_interest.venue_id, 'tournament_registration', v_interest.member_id);
  update public.tournament_interest
  set registered_at = null, registered_by_staff_id = null
  where id = v_interest.id;
end;
$$;

create function public.unmark_tournament_registered(p_interest_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.unmark_tournament_registered(p_interest_id); $$;

revoke execute on function private.unmark_tournament_registered(uuid), public.unmark_tournament_registered(uuid) from public, anon;
grant execute on function private.unmark_tournament_registered(uuid), public.unmark_tournament_registered(uuid) to authenticated;
