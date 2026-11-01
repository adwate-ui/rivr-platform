-- A frozen member shares no winner card (audit of 28 Oct, A4-16), as their other writes honour member_freeze. Stopping
-- sharing, the member's consent withdrawn, stays open.

-- As 20261028395000_winner_cards.sql made it, honouring a member freeze:
create or replace function private.share_winner_card(p_card_id uuid, p_is_shared boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'social.winner_cards') then
    raise exception 'Only a member with winner cards shares one' using errcode = '42501';
  end if;
  -- Sharing honours a freeze; stopping sharing is the member's consent withdrawn, which stays open.
  if p_is_shared then
    perform private.assert_writable((select m.venue_id from public.member m where m.id = v_member_id), null, v_member_id);
  end if;
  update public.winner_card w set shared_at = case when p_is_shared then coalesce(w.shared_at, now()) end
  where w.id = p_card_id and w.member_id = v_member_id;
  if not found then
    raise exception 'No such card of yours' using errcode = '42501';
  end if;
end;
$$;
