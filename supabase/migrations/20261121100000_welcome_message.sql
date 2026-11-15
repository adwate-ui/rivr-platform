-- The welcome message (the owner, 15 Nov night, decision 0661): once someone signs up, on their own or as staff do, WhatsApp
-- tells them "Hi {First Name}, congratulations on becoming a member of RIVR poker club. Your membership ID is: {X}." The
-- consumer reads the first word of the name and the member number when it sends, as it reads the number: member.signed_up
-- names the member only, so no outbox row, which reports staff read, holds a name. Never a practice member, as before.
-- message_recipient and offer_recipient as 20261019090500_whatsapp_consumer.sql and 20261107150000_promotion_cards_by_channel.sql
-- made them, with the first name and the member number added at the end; one row shape for both, as the consumer reads both.
drop function public.offer_recipient(uuid, uuid, uuid);
drop function private.offer_recipient(uuid, uuid, uuid);
drop function public.message_recipient(uuid, uuid);
drop function private.message_recipient(uuid, uuid);

create function private.message_recipient(p_venue_id uuid, p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz, first_name text, member_number bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.phone, c.granted_at, split_part(trim(m.full_name), ' ', 1), m.member_number
  from public.member m
  join public.venue v on v.id = m.venue_id and not v.is_practice
  left join public.consent c on c.member_id = m.id and c.purpose = 'marketing' and c.withdrawn_at is null
  where m.id = p_member_id and m.venue_id = p_venue_id;
$$;
revoke execute on function private.message_recipient(uuid, uuid) from public, anon, authenticated;
grant execute on function private.message_recipient(uuid, uuid) to service_role;

create function public.message_recipient(p_venue_id uuid, p_member_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz, first_name text, member_number bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.message_recipient(p_venue_id, p_member_id);
$$;
revoke execute on function public.message_recipient(uuid, uuid) from public, anon, authenticated;
grant execute on function public.message_recipient(uuid, uuid) to service_role;

create function private.offer_recipient(p_venue_id uuid, p_member_id uuid, p_promotion_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz, first_name text, member_number bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.phone, r.marketing_opted_in_at, r.first_name, r.member_number from private.message_recipient(p_venue_id, p_member_id) r
  where exists (select 1 from private.promotion_cards(p_venue_id) c where c.promotion_id = p_promotion_id)
    and private.promotion_shows_on(p_promotion_id, 'whatsapp')
    and private.has_feature(p_member_id, 'promotions.feed')
    and not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'feature_kill'
                    and c.feature = 'marketing_sends' and c.released_at is null);
$$;

create function public.offer_recipient(p_venue_id uuid, p_member_id uuid, p_promotion_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz, first_name text, member_number bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.offer_recipient(p_venue_id, p_member_id, p_promotion_id);
$$;
revoke execute on function private.offer_recipient(uuid, uuid, uuid), public.offer_recipient(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.offer_recipient(uuid, uuid, uuid), public.offer_recipient(uuid, uuid, uuid) to service_role;
