-- Winner cards (#155; decision 0273; the owner's answer of 28 Oct, question #589). A tournament win, an approved high hand
-- and a paid bad-beat jackpot each make a card for the player they name. The nightly offline-pack job draws each new card
-- at 17:00 IST (packages/render) into the private winner-cards bucket. The player sees their cards in the app and chooses
-- to share each; only a shared card reaches staff who publish marketing, to download and post, and stopping sharing takes
-- it from them at once. A reversed high hand or jackpot takes its cards away. Members with social.winner_cards (rule 8);
-- never at the practice venue. A trigger, not an outbox consumer: consumers are Edge Functions for calls outside the club
-- (rule 5), and a card is a row made from the event's own payload in the same transaction, exactly once.

insert into public.feature (key, name, description, screens, is_gateable) values
  ('social.winner_cards', 'Winner cards', 'Cards celebrating a member’s wins, posted on the club’s social only while they share them.', '{player:profile}', true);
-- Every tier of an existing venue has it, as a new venue's tiers do (bootstrap_venue).
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, 'social.winner_cards', true, 'locked', '-infinity' from public.tier t;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('winner-cards', 'winner-cards', false, 5242880, array['image/png']);

create table public.winner_card (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('tournament', 'high_hand', 'jackpot')),
  -- The tournament, the high-hand claim or the jackpot event it celebrates.
  source_id uuid not null,
  -- What the card shows besides the player and the prize: a tournament's name; a high hand's category, rank and table.
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  -- As announced: gross, before TDS (question #242).
  prize_paise bigint not null check (prize_paise >= 0),
  won_at timestamptz not null,
  -- <venue>/<card>.png in the winner-cards bucket, once the nightly job has drawn it.
  image_path text check (image_path is null or image_path = venue_id || '/' || id || '.png'),
  -- When the player chose to share it; null while they do not.
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, source_id, member_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.winner_card is 'A card celebrating a member''s win (#155), shared on the club''s social only while they choose.';

create index winner_card_venue_id_idx on public.winner_card (venue_id, shared_at desc);
create index winner_card_member_id_idx on public.winner_card (member_id);
create trigger winner_card_touch_updated_at before update on public.winner_card
  for each row execute function private.touch_updated_at();

-- Read through the functions below only.
alter table public.winner_card enable row level security;
revoke all on public.winner_card from anon, authenticated;

-- A member's export gives their winner cards whole.
insert into private.member_export_column (table_name, column_name, kind)
select 'winner_card', c.column_name, 'owed' from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'winner_card';

-- The cards an event makes, each once: the tournament's winner with their prizes; the player in the high hand's seat when
-- it was played, with its payout; a jackpot's loser and winner, each with their share. A reversal deletes them; the
-- nightly job then removes their images.
create function private.make_winner_cards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := new.payload;
  v_played_at timestamptz;
begin
  if (select v.is_practice from public.venue v where v.id = new.venue_id) then
    return null;
  end if;
  if new.event_type = 'tournament.finished' and v_payload ->> 'winner_member_id' is not null then
    insert into public.winner_card (venue_id, member_id, kind, source_id, details, prize_paise, won_at)
    select t.venue_id, (v_payload ->> 'winner_member_id')::uuid, 'tournament', t.id, jsonb_build_object('event_name', t.name),
           coalesce((select sum(p.prize_paise + p.bounty_paise) from public.tournament_payout p
                     where p.tournament_id = t.id and p.member_id = (v_payload ->> 'winner_member_id')::uuid), 0),
           coalesce(t.finished_at, now())
    from public.tournament t where t.id = (v_payload ->> 'tournament_id')::uuid
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'high_hand.approved' then
    v_played_at := (v_payload ->> 'played_at')::timestamptz;
    insert into public.winner_card (venue_id, member_id, kind, source_id, details, prize_paise, won_at)
    select new.venue_id, s.member_id, 'high_hand', (v_payload ->> 'claim_id')::uuid,
           jsonb_build_object('category', v_payload ->> 'category', 'rank', v_payload ->> 'rank', 'table_name', gt.name),
           (v_payload ->> 'payout_paise')::bigint, v_played_at
    from public.game_table gt
    cross join lateral (select x.member_id from public.seat_session x
                        where x.table_id = gt.id and x.seat = (v_payload ->> 'seat')::integer and x.started_at <= v_played_at
                          and (x.ended_at is null or x.ended_at >= v_played_at)
                        order by x.started_at desc limit 1) s
    where gt.id = (v_payload ->> 'table_id')::uuid
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'jackpot.paid' then
    insert into public.winner_card (venue_id, member_id, kind, source_id, prize_paise, won_at)
    select j.venue_id, w.member_id, 'jackpot', j.id, w.paise, j.created_at
    from public.jackpot_event j
    cross join lateral (values (j.loser_member_id, j.loser_paise), (j.winner_member_id, j.winner_paise)) w (member_id, paise)
    where j.id = (v_payload ->> 'event_id')::uuid and w.member_id is not null
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'high_hand.reversed' then
    delete from public.winner_card w where w.kind = 'high_hand' and w.source_id = (v_payload ->> 'claim_id')::uuid;
  elsif new.event_type = 'jackpot.reversed' then
    delete from public.winner_card w where w.kind = 'jackpot' and w.source_id = (v_payload ->> 'payout_event_id')::uuid;
  end if;
  return null;
end;
$$;

create trigger make_winner_cards after insert on public.outbox_event
  for each row when (new.event_type in ('tournament.finished', 'high_hand.approved', 'jackpot.paid', 'high_hand.reversed', 'jackpot.reversed'))
  execute function private.make_winner_cards();

-- Who sees a drawn card, while the player's tier has winner cards: the player, and while they share it, staff who publish
-- marketing at its venue.
create function private.may_see_winner_card(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.winner_card w
                 where w.image_path = p_name
                   and private.has_feature(w.member_id, 'social.winner_cards')
                   and (w.member_id = private.current_member_id()
                        or (w.shared_at is not null and coalesce(private.has_permission(w.venue_id, 'marketing.publish'), false))));
$$;
create policy "players see their winner cards, and staff who publish marketing the shared ones" on storage.objects
  for select to authenticated using (bucket_id = 'winner-cards' and (select private.may_see_winner_card(name)));

-- The signed-in member's cards, newest win first.
create function private.my_winner_cards()
returns table (card_id uuid, kind text, details jsonb, prize_paise bigint, won_at timestamptz, image_path text, is_shared boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.kind, w.details, w.prize_paise, w.won_at, w.image_path, w.shared_at is not null
  from public.winner_card w
  where w.member_id = private.current_member_id() and private.has_feature(w.member_id, 'social.winner_cards')
  order by w.won_at desc, w.id;
$$;

-- The signed-in member shares a card of theirs, or stops sharing it, which takes it from staff at once.
create function private.share_winner_card(p_card_id uuid, p_is_shared boolean)
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
  update public.winner_card w set shared_at = case when p_is_shared then coalesce(w.shared_at, now()) end
  where w.id = p_card_id and w.member_id = v_member_id;
  if not found then
    raise exception 'No such card of yours' using errcode = '42501';
  end if;
end;
$$;

-- The drawn cards their players share, newest share first, for staff who publish marketing to download and post.
create function private.winner_cards_to_post(p_venue_id uuid)
returns table (card_id uuid, player_name text, kind text, details jsonb, prize_paise bigint, won_at timestamptz, image_path text, shared_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, private.first_name_and_initial(m.full_name), w.kind, w.details, w.prize_paise, w.won_at, w.image_path, w.shared_at
  from public.winner_card w
  join public.member m on m.id = w.member_id and m.erased_at is null
  where w.venue_id = p_venue_id and w.shared_at is not null and w.image_path is not null
    and private.has_feature(w.member_id, 'social.winner_cards') and private.has_permission(p_venue_id, 'marketing.publish')
  order by w.shared_at desc, w.id
  limit 50;
$$;

-- The cards the nightly job draws (service role): not yet drawn, of members not erased, never at the practice venue.
create function private.winner_cards_to_draw()
returns table (card_id uuid, venue_id uuid, kind text, player_name text, venue_address text, details jsonb, prize_paise bigint, won_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.venue_id, w.kind, private.first_name_and_initial(m.full_name), coalesce(c.address, ''), w.details, w.prize_paise, w.won_at
  from public.winner_card w
  join public.member m on m.id = w.member_id and m.erased_at is null
  join public.venue v on v.id = w.venue_id and not v.is_practice
  left join public.venue_config c on c.venue_id = w.venue_id
  where w.image_path is null
  order by w.created_at, w.id
  limit 200;
$$;

-- A card drawn: kept at <venue>/<card>.png.
create function private.record_winner_card_image(p_card_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.winner_card w set image_path = w.venue_id || '/' || w.id || '.png' where w.id = p_card_id;
$$;

-- Drawn cards no card names any more (an erased member's), for the nightly job to remove.
create function private.winner_card_images_to_remove()
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'winner-cards' and not exists (select 1 from public.winner_card w where w.image_path = o.name);
$$;

-- As 20261028394900_web_push.sql made it, deleting the member's winner cards too.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.learn_attempt x where x.member_id = p_member.id;
  delete from public.learn_card x where x.member_id = p_member.id;
  delete from public.learn_session x where x.member_id = p_member.id;
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.winner_card x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.my_winner_cards()
returns table (card_id uuid, kind text, details jsonb, prize_paise bigint, won_at timestamptz, image_path text, is_shared boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_winner_cards(); $$;
create function public.share_winner_card(p_card_id uuid, p_is_shared boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.share_winner_card(p_card_id, p_is_shared); $$;
create function public.winner_cards_to_post(p_venue_id uuid)
returns table (card_id uuid, player_name text, kind text, details jsonb, prize_paise bigint, won_at timestamptz, image_path text, shared_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.winner_cards_to_post(p_venue_id); $$;
create function public.winner_cards_to_draw()
returns table (card_id uuid, venue_id uuid, kind text, player_name text, venue_address text, details jsonb, prize_paise bigint, won_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.winner_cards_to_draw(); $$;
create function public.record_winner_card_image(p_card_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_winner_card_image(p_card_id); $$;
create function public.winner_card_images_to_remove()
returns table (name text) language sql stable security invoker set search_path = ''
as $$ select * from private.winner_card_images_to_remove(); $$;

revoke execute on function private.make_winner_cards(), private.may_see_winner_card(text), private.my_winner_cards(),
  private.share_winner_card(uuid, boolean), private.winner_cards_to_post(uuid), private.winner_cards_to_draw(),
  private.record_winner_card_image(uuid), private.winner_card_images_to_remove(), public.my_winner_cards(),
  public.share_winner_card(uuid, boolean), public.winner_cards_to_post(uuid), public.winner_cards_to_draw(),
  public.record_winner_card_image(uuid), public.winner_card_images_to_remove() from public, anon, authenticated;
grant execute on function private.may_see_winner_card(text), private.my_winner_cards(), private.share_winner_card(uuid, boolean),
  private.winner_cards_to_post(uuid), public.my_winner_cards(), public.share_winner_card(uuid, boolean), public.winner_cards_to_post(uuid)
  to authenticated;
grant execute on function private.winner_cards_to_draw(), private.record_winner_card_image(uuid), private.winner_card_images_to_remove(),
  public.winner_cards_to_draw(), public.record_winner_card_image(uuid), public.winner_card_images_to_remove() to service_role;
