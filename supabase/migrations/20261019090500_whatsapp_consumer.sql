-- The WhatsApp outbox consumer (#62): it sends the seat call (waitlist.called) and the receipt-ready
-- notice (receipt.ready). Event payloads name the member, never their number; the consumer reads the
-- number, and the member's marketing opt-in, through this function at send time, with the service
-- role only. Templates live in @rivr/adapters (decision 0043).

create function private.message_recipient(p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.phone, c.granted_at
  from public.member m
  left join public.consent c on c.member_id = m.id and c.purpose = 'marketing' and c.withdrawn_at is null
  where m.id = p_member_id;
$$;

revoke execute on function private.message_recipient(uuid) from public, anon, authenticated;
grant execute on function private.message_recipient(uuid) to service_role;

create function public.message_recipient(p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.message_recipient(p_member_id);
$$;

revoke execute on function public.message_recipient(uuid) from public, anon, authenticated;
grant execute on function public.message_recipient(uuid) to service_role;

-- pg_cron runs the consumer every minute with the scheduler's secret (decision 0038).
select private.schedule_outbox_consumer('whatsapp');
