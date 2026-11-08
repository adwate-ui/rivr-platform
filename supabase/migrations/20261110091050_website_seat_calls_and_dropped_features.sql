-- The website without what the club no longer does (8 Nov audit, I-10, F-064). Players see no open seats or waits (owner,
-- 8 Nov), a seat is requested and the floor calls the member on WhatsApp when one opens (owner, 8 Nov: the floor's one-tap
-- Call), dealers no longer log hands (29 Oct), and there is no Academy (3 Nov, decision 0308). So the app band and the
-- Membership and Questions answers say how a seat is had, the About story drops "log every hand", the Academy graduate
-- tier and the Academy's answers go, the privacy notice no longer counts an Academy booking among the conversions it
-- reports, and the links to the member app are named for where they go ("Open the app"), apart from the header's
-- "Request a seat" on WhatsApp. House rule 5, "A seat is held for 20 minutes once it is called.", stays true with the Call.
-- Each line only while it still reads as the website came with it, so a club's own words stay.
create function private.website_seat_calls_and_dropped_features(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Each line as the website came with it, and what replaces it.
  v_lines constant text[][] := array[
    ['"See tonight''s tables and their open seats, join the waitlist before you leave home, and get called to your seat."',
     '"Request a seat before you leave home. When one opens, the floor calls you on WhatsApp."'],
    ['{"to": "waitlist", "label": "Join the waitlist"}', '{"to": "waitlist", "label": "Open the app"}'],
    ['"Join from the app and get called to your seat."', '"Request a seat from the app. The floor calls you on WhatsApp when one opens."'],
    ['"Join the waitlist for a game in the app. It shows your number on the list and tells you when your seat is called."',
     '"Request a seat for a game in the app. It shows your place on the list, and the floor calls you on WhatsApp when a seat opens."'],
    ['Trained dealers who log every hand, a cage', 'Trained dealers at every table, a cage'],
    ['"Yes. The dealers and the floor will walk you through how the room runs, 50/100 is a comfortable place to start, and RIVR Academy teaches the game in small batches with a coach."',
     '"Yes. The dealers and the floor will walk you through how the room runs, and 50/100 is a comfortable place to start."'],
    ['"Yes. RIVR Academy runs small batches with a coach. Book a seat from the app."',
     '"Yes. The dealers and the floor walk new players through how the room runs, and 50/100 is a comfortable place to start."'],
    ['RIVR tells Meta and Google when you book the Academy, finish the identity check,', 'RIVR tells Meta and Google when you finish the identity check,']
  ];
  -- The Academy graduate tier's cards as the front page and Membership came with them.
  v_academy_tiers constant jsonb := '[
    {"text": "For members who finish RIVR Academy: a bonus on their first buy-in after they graduate.", "label": "After the Academy", "title": "Academy graduate"},
    {"label": "After the Academy", "title": "Academy graduate", "points": ["Everything a member has", "A bonus on your first buy-in after you graduate"]}
  ]'::jsonb;
  v_line text[];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;

  update public.site_block b
  set content = jsonb_set(b.content, '{cards}', (select coalesce(jsonb_agg(c.card order by c.n), '[]'::jsonb)
                                                 from jsonb_array_elements(b.content -> 'cards') with ordinality as c (card, n)
                                                 where c.card <> (v_academy_tiers -> 0) and c.card <> (v_academy_tiers -> 1)))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.kind = 'cards'
    and exists (select 1 from jsonb_array_elements(b.content -> 'cards') c
                where c.value = (v_academy_tiers -> 0) or c.value = (v_academy_tiers -> 1));

  update public.site_page set description = 'Request a seat, tonight''s games and how to find us.'
  where venue_id = p_venue_id and slug = 'links'
    and description = 'Join the waitlist, tonight''s games, RIVR Academy and how to find us.';
end;
$$;
revoke execute on function private.website_seat_calls_and_dropped_features(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261110090050_website_identity_at_the_desk.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_identity_at_the_desk;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_identity_at_the_desk(p_venue_id);
  perform private.website_seat_calls_and_dropped_features(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_identity_at_the_desk(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_seat_calls_and_dropped_features(v.id) from public.venue v where not v.is_practice;
