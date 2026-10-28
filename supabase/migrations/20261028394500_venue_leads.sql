-- The leads in the console (#587, from #156; decision 0268): the venue's conversations from the social inbox, the latest
-- first, with how many messages each holds and the member it became. Staff who publish marketing read them.

-- The venue's leads, open and closed, the latest conversation first. Refusal: 42501 not staff who publish marketing.
create function private.venue_leads(p_venue_id uuid)
returns table (lead_id uuid, channel text, handle text, first_message text, last_message_at timestamptz, messages integer, member_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'marketing.publish'), false) then
    raise exception 'Staff who publish marketing read the leads' using errcode = '42501';
  end if;
  return query
  select l.id, l.channel, l.handle, l.first_message, l.last_message_at, (select count(*)::integer from public.inbox_message i where i.lead_id = l.id),
         m.full_name
  from public.lead l left join public.member m on m.id = l.member_id
  where l.venue_id = p_venue_id
  order by l.last_message_at desc, l.id
  limit 200;
end;
$$;

create function public.venue_leads(p_venue_id uuid)
returns table (lead_id uuid, channel text, handle text, first_message text, last_message_at timestamptz, messages integer, member_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_leads(p_venue_id); $$;

revoke execute on function private.venue_leads(uuid), public.venue_leads(uuid) from public, anon;
grant execute on function private.venue_leads(uuid), public.venue_leads(uuid) to authenticated;
