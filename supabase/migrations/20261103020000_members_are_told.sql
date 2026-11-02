-- Members are told (decision 0303; the workflow audit of 2 Nov, the owner's answer of 3 Nov: two pushes only, and WhatsApp for
-- what happens while the member is away from the app). One event, member.notice, names the member, the notice and its
-- words; the WhatsApp consumer sends it as a utility message. Triggers raise it, so every path that writes the row is covered:
-- an identity check that is verified, waits for review or is refused (by its code, never a reviewer's note), at most once an
-- hour for each; a reward cancelled (its name only: why is in the app, never staff's words in a message); a seat on the
-- leaving list that ends.
-- The practice venue raises none (its seed is restored by a reset, which must leave no new rows), and a messaging stop holds
-- every send.

-- Whether a venue is the practice venue, which tells no member anything.
create function private.is_practice_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select v.is_practice from public.venue v where v.id = p_venue_id), false); $$;

-- An identity check reaching an outcome the member should hear of: verified, waiting for review, refused.
create function private.notify_kyc_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice text := case new.status when 'verified' then 'kyc_verified' when 'needs_review' then 'kyc_in_review' when 'refused' then 'kyc_refused' end;
begin
  if v_notice is null or (tg_op = 'UPDATE' and old.status is not distinct from new.status) or private.is_practice_venue(new.venue_id) then
    return null;
  end if;
  perform private.emit(new.venue_id, 'member.notice',
    jsonb_build_object('member_id', new.member_id, 'notice', v_notice,
                       'params', case when v_notice = 'kyc_refused' then jsonb_build_array(coalesce(new.refusal, 'other')) else '[]'::jsonb end),
    'member.notice:' || v_notice || ':' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24'));
  return null;
end;
$$;

create trigger notify_kyc_outcome after insert or update of status on public.kyc_record
  for each row execute function private.notify_kyc_outcome();

-- A reward cancelled by staff: the member hears which, and reads why in the app (decision 0302). A redemption itself is the
-- member's own act in the app, so it sends nothing.
create function private.notify_redemption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reward_item := (select i from public.reward_item i where i.id = new.reward_item_id);
begin
  if private.is_practice_venue(new.venue_id) or old.cancelled_at is not null or new.cancelled_at is null then
    return null;
  end if;
  perform private.emit(new.venue_id, 'member.notice',
    jsonb_build_object('member_id', new.member_id, 'notice', 'reward_cancelled', 'params', jsonb_build_array(v_item.name)),
    'member.notice:reward_cancelled:' || new.id);
  return null;
end;
$$;

create trigger notify_redemption after update of cancelled_at on public.redemption
  for each row execute function private.notify_redemption();

-- A player on the leaving list whose seat ends is released: they hear their seat is free and they may go.
create function private.notify_seat_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_practice_venue(new.venue_id) then
    return null;
  end if;
  perform private.emit(new.venue_id, 'member.notice',
    jsonb_build_object('member_id', new.member_id, 'notice', 'seat_released',
                       'params', jsonb_build_array((select g.name from public.game_table g where g.id = new.table_id), new.seat::text)),
    'member.notice:seat_released:' || new.id);
  return null;
end;
$$;

create trigger notify_seat_released after update of ended_at on public.seat_session
  for each row when (old.ended_at is null and new.ended_at is not null and old.leaving_at is not null)
  execute function private.notify_seat_released();

revoke execute on function private.notify_kyc_outcome(), private.notify_redemption(), private.notify_seat_released(),
  private.is_practice_venue(uuid) from public, anon, authenticated;
