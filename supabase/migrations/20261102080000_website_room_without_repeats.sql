-- The front page's The room without the cards other bands already say (W-01; the owner's trim of 2 Nov): the main room
-- and the Private Room are in the photo tiles and Pick your table; the dealers, the cage and the chef's menu in the photo
-- tiles; safety in Played straight. The room keeps what only it says, the hours, the terrace and parking, and the cab
-- home joins the photo tiles' Pick-up and drop. A card goes only while it reads as shipped, the cab home moves only while
-- the tile does, and The room is never left empty.
create function private.website_room_without_repeats(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repeats jsonb[] := array[
    '{"text": "Five tables of no-limit hold''em, from 50/100 to 100/200, each with its dealer and its tablet.", "title": "The main room"}'::jsonb,
    '{"text": "One table at 100/200 with a compulsory ₹500 straddle, for the game you want behind a door.", "title": "The Private Room"}'::jsonb,
    '{"text": "On a rotation, at every table.", "title": "Trained dealers"}'::jsonb,
    '{"text": "Buy in by UPI or in cash. Cash out the same night.", "title": "The cage"}'::jsonb,
    '{"text": "Complimentary, and served at your seat.", "title": "The chef''s menu"}'::jsonb,
    '{"text": "CCTV across the club, staff on the floor, and verified members only.", "title": "Safe and secure"}'::jsonb
  ];
  v_room uuid;
  v_gallery uuid;
begin
  select b.id into v_room from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'home' and b.kind = 'cards' and b.content ->> 'eyebrow' = 'The room'
    and exists (select 1 from jsonb_array_elements(b.content -> 'cards') c where not (c = any(v_repeats || '{"text": "Ask the front desk for a cab home.", "title": "Pick-up and drop"}'::jsonb)));
  if v_room is null then
    return;
  end if;
  select b.id into v_gallery from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'home' and b.kind = 'gallery' and b.content -> 'items' @> jsonb_build_array('{"alt": "A chauffeur holds a car door outside the club at night", "text": "Chauffeured rides for regulars.", "image": "/media/pick-up.webp", "title": "Pick-up and drop"}'::jsonb);
  if v_gallery is not null and (select content -> 'cards' @> jsonb_build_array('{"text": "Ask the front desk for a cab home.", "title": "Pick-up and drop"}'::jsonb) from public.site_block where id = v_room) then
    update public.site_block set content = jsonb_set(content, '{items}', (
      select jsonb_agg(case when e.item = '{"alt": "A chauffeur holds a car door outside the club at night", "text": "Chauffeured rides for regulars.", "image": "/media/pick-up.webp", "title": "Pick-up and drop"}'::jsonb then '{"alt": "A chauffeur holds a car door outside the club at night", "text": "Chauffeured rides for regulars. Ask the front desk for a cab home.", "image": "/media/pick-up.webp", "title": "Pick-up and drop"}'::jsonb else e.item end order by e.n)
      from jsonb_array_elements(content -> 'items') with ordinality as e (item, n)))
    where id = v_gallery;
    v_repeats := v_repeats || '{"text": "Ask the front desk for a cab home.", "title": "Pick-up and drop"}'::jsonb;
  end if;
  update public.site_block set content = jsonb_set(content, '{cards}', (
    select jsonb_agg(e.card order by e.n) from jsonb_array_elements(content -> 'cards') with ordinality as e (card, n)
    where not (e.card = any(v_repeats))))
  where id = v_room;
end;
$$;
revoke execute on function private.website_room_without_repeats(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102070000_website_launch_text.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_launch_text;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_launch_text(p_venue_id);
  perform private.website_room_without_repeats(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_launch_text(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_room_without_repeats(v.id) from public.venue v where not v.is_practice;
