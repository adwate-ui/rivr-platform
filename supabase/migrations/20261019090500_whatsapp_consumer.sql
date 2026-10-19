-- The WhatsApp outbox consumer (#62): it sends the seat call (waitlist.called) and the receipt-ready
-- notice (receipt.ready). Event payloads name the member, never their number; the consumer reads the
-- number, and the member's marketing opt-in, through this function at send time, with the service
-- role only. Templates live in @rivr/adapters (decision 0043).

-- A member of the event's venue, never of the practice venue: defence in depth beside the claim's own
-- practice exclusion, so a message can never reach a practice member through a real venue's event.
create function private.message_recipient(p_venue_id uuid, p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.phone, c.granted_at
  from public.member m
  join public.venue v on v.id = m.venue_id and not v.is_practice
  left join public.consent c on c.member_id = m.id and c.purpose = 'marketing' and c.withdrawn_at is null
  where m.id = p_member_id and m.venue_id = p_venue_id;
$$;

revoke execute on function private.message_recipient(uuid, uuid) from public, anon, authenticated;
grant execute on function private.message_recipient(uuid, uuid) to service_role;

create function public.message_recipient(p_venue_id uuid, p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.message_recipient(p_venue_id, p_member_id);
$$;

revoke execute on function public.message_recipient(uuid, uuid) from public, anon, authenticated;
grant execute on function public.message_recipient(uuid, uuid) to service_role;

-- pg_cron runs the consumer every minute with the scheduler's secret (decision 0038).
select private.schedule_outbox_consumer('whatsapp');
