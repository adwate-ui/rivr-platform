-- Members sync to the club's CRM (#647): HubSpot keeps each member as a contact, and filtering, sorting and the full
-- record live there, never in the console (the owner: "don't build a CRM - just build integration"). The crm-sync
-- consumer upserts a member's contact after each event it takes, as crm_contact reads it at that moment.

-- A member's contact: name, phone, the sign-up answers, the identity check, tier, the time at the tables (closed seat
-- sessions) and the last visit. None for an erased member or one of another venue; practice-venue events never reach
-- the consumer. Service role only.
create function private.crm_contact(p_venue_id uuid, p_payload jsonb)
returns table (member_id uuid, member_number bigint, full_name text, phone text, city text, occupation text,
               play_times text[], games_played text[], kyc_status text, tier_name text, seconds_played bigint,
               last_visit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, p.city, p.occupation, coalesce(p.play_times, '{}'),
         coalesce(p.games_played, '{}'), coalesce(k.status, 'none'), t.name,
         (select coalesce(floor(sum(extract(epoch from s.ended_at - s.started_at))), 0)::bigint
          from public.seat_session s where s.member_id = m.id and s.ended_at is not null),
         (select max(x.opened_at) from public.visit x where x.member_id = m.id)
  from public.member m
  join public.venue v on v.id = m.venue_id and not v.is_practice
  join public.tier t on t.id = m.tier_id
  left join public.member_preference p on p.member_id = m.id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = (p_payload ->> 'member_id')::uuid and m.venue_id = p_venue_id and m.erased_at is null;
$$;

create function public.crm_contact(p_venue_id uuid, p_payload jsonb)
returns table (member_id uuid, member_number bigint, full_name text, phone text, city text, occupation text,
               play_times text[], games_played text[], kyc_status text, tier_name text, seconds_played bigint,
               last_visit_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.crm_contact(p_venue_id, p_payload); $$;

-- Every member reaches the CRM, not only those with an event in the claim's last 30 days: each run of the consumer, once
-- the token is set, first queues member.crm_sync for members not yet queued (once each, by its key), a batch at a time.
create function private.queue_crm_sync(p_limit integer default 500)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select m.id, m.venue_id from public.member m
    join public.venue v on v.id = m.venue_id and not v.is_practice
    where m.erased_at is null and not exists (
      select 1 from public.outbox_event e where e.venue_id = m.venue_id and e.idempotency_key = 'member.crm_sync:' || m.id)
    order by m.member_number
    limit p_limit)
  select count(private.emit(d.venue_id, 'member.crm_sync', jsonb_build_object('member_id', d.id), 'member.crm_sync:' || d.id))::integer
  from due d;
$$;

create function public.queue_crm_sync(p_limit integer default 500)
returns integer
language sql volatile security invoker set search_path = ''
as $$ select private.queue_crm_sync(p_limit); $$;

-- The sign-up answers reach the CRM when saved or changed: they are often saved after member.signed_up was sent. Once an
-- hour a member at most (the key), so answers saved over and over cannot flood the outbox; the contact is read when sent.
create function private.emit_member_answers_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.emit(new.venue_id, 'member.answers_saved', jsonb_build_object('member_id', new.member_id),
                       'member.answers_saved:' || new.member_id || ':' || to_char(date_trunc('hour', now()), 'YYYY-MM-DD"T"HH24'));
  return null;
end;
$$;

create trigger member_answers_saved after insert on public.member_preference
  for each row execute function private.emit_member_answers_saved();
create trigger member_answers_changed after update of city, occupation, play_times, games_played on public.member_preference
  for each row when ((old.city, old.occupation, old.play_times, old.games_played) is distinct from (new.city, new.occupation, new.play_times, new.games_played))
  execute function private.emit_member_answers_saved();

revoke execute on function private.emit_member_answers_saved() from public, anon, authenticated;
revoke execute on function private.crm_contact(uuid, jsonb), public.crm_contact(uuid, jsonb),
  private.queue_crm_sync(integer), public.queue_crm_sync(integer) from public, anon, authenticated;
grant execute on function private.crm_contact(uuid, jsonb), public.crm_contact(uuid, jsonb),
  private.queue_crm_sync(integer), public.queue_crm_sync(integer) to service_role;

select private.schedule_outbox_consumer('crm-sync');
