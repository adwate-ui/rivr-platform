-- Those who asked about a tournament and those marked registered hear when it is withdrawn, or its day or time changes (the owner,
-- 9 Nov, #877), by WhatsApp and push: one member.notice each, which both consumers read. A trigger, so every path that writes the row
-- is covered (decision 0303). A correction that keeps the day and time tells nobody, and neither does publishing one again.

-- The name staff typed, as it may go out from the club's number (decision 0303): plain words only, so it carries no link, no WhatsApp
-- mark and no long number, and every notice passes the consumers' check.
create function private.tournament_name_for_members(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           p_name, 'https?://', '', 'gi'), '[^[:alnum:] ''&,()#+/:-]', '', 'g'), '[0-9]{7,}', '', 'g'), '\s+', ' ', 'g')), ''), 'A tournament');
$$;
revoke execute on function private.tournament_name_for_members(text) from public, anon, authenticated;

create function private.tell_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice text;
  -- The name they asked about, if this change also renames it.
  v_params jsonb := jsonb_build_array(private.tournament_name_for_members(old.name));
begin
  -- Only what members could see and has not started.
  if not old.is_published or old.starts_at <= now() then
    return null;
  end if;
  if not new.is_published then
    v_notice := 'tournament_withdrawn';
  elsif date_trunc('minute', new.starts_at) <> date_trunc('minute', old.starts_at)
        and isfinite(new.starts_at) and new.starts_at < now() + interval '5 years' then
    v_notice := 'tournament_moved';
    v_params := v_params || to_jsonb(to_jsonb(new.starts_at) #>> '{}');
  else
    return null;
  end if;
  -- Three changes told in an hour is the most, so saving again and again cannot flood members or hold up seat calls in the queue. Refused,
  -- not dropped, so a real change is never lost without staff knowing.
  if (select count(distinct e.occurred_at) from public.outbox_event e
      where e.venue_id = new.venue_id and e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = new.id::text
        and e.occurred_at > now() - interval '1 hour') >= 3 then
    raise exception 'Members were told of this tournament three times in the last hour' using errcode = 'RVRAT';
  end if;
  perform private.emit(i.venue_id, 'member.notice',
    jsonb_build_object('member_id', i.member_id, 'tournament_id', i.tournament_id, 'notice', v_notice, 'params', v_params),
    'member.notice:' || v_notice || ':' || i.tournament_id || ':' || i.member_id || ':' || extract(epoch from now())::bigint)
  from public.tournament_interest i
  join public.member m on m.id = i.member_id
  where i.tournament_id = new.id and m.erased_at is null
    -- On a break a member hears only that a place they paid for will not run.
    and ((v_notice = 'tournament_withdrawn' and i.registered_at is not null)
         or (select r.break_until from private.member_restrictions(i.member_id, now()) r) is null)
    -- Whoever paid is told; anyone else follows their tier's feature (rule 8).
    and (i.registered_at is not null or private.has_feature(i.member_id, 'tournaments.register'));
  return null;
end;
$$;
revoke execute on function private.tell_tournament_change() from public, anon, authenticated;

create trigger tournament_change_told after update of starts_at, is_published on public.tournament
  for each row execute function private.tell_tournament_change();
