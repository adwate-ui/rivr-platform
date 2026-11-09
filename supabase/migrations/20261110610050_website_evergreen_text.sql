-- The website in words that stay true after the opening (8 Nov audit, I-93, F-192; decision 0551): no "Opens Sunday 15
-- November", no terms promised "before launch", and no "Details to follow." where the club has no words yet. About's A full
-- record goes. The room's Smoking terrace and Parking give way to one card to the Visit page, as a cards block has at least
-- two cards. The League's two "Details to follow." cards stay, as the owner said on 2 Nov (#710). The terms of use keep
-- their date, which is when they apply. Each line only while it still reads as the website came with it, so a club's own
-- words stay.
create function private.website_evergreen_text(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line text[];
  v_lines constant text[][] := array[
    ['a floor you follow from your phone. Opens Sunday 15 November."', 'a floor you follow from your phone."'],
    ['"RIVR opens on Sunday 15 November with one idea:', '"RIVR began with one idea:'],
    ['"14:00 to 08:00, from Sunday 15 November."', '"14:00 to 08:00."'],
    ['"From 14:00 to 08:00, from Sunday 15 November."', '"From 14:00 to 08:00, every night."'],
    ['and a cage that pays out the same night. It opens on Sunday 15 November."', 'and a cage that pays out the same night."'],
    ['"eyebrow": "Opens Sunday 15 November"', '"eyebrow": "Open every night, 14:00 to 08:00"'],
    ['"For the club''s regulars at the higher stakes. The club sets out its terms before launch."', '"For the club''s regulars at the higher stakes."'],
    ['"For the club''s regulars at the higher stakes", "Its terms are set out before launch"', '"For the club''s regulars at the higher stakes"'],
    [', {"text": "Details to follow.", "title": "A full record"}', ''],
    ['{"text": "Details to follow.", "title": "Smoking terrace"}, {"text": "Details to follow.", "title": "Parking"}',
     '{"link": {"page": "visit", "label": "Visit and contact"}, "text": "Directions, a map and the club''s number.", "title": "Getting here"}']
  ];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;

  update public.site_page set description = 'Bring your poker face. A members'' poker club at Glaza, M3M 65th Avenue, Gurugram.'
  where venue_id = p_venue_id and slug = 'home'
    and description = 'Bring your poker face. A members'' poker club at Glaza, M3M 65th Avenue, Gurugram. Opens Sunday 15 November.';
end;
$$;
revoke execute on function private.website_evergreen_text(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261110091050_website_seat_calls_and_dropped_features.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_seat_calls_and_dropped_features;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_seat_calls_and_dropped_features(p_venue_id);
  perform private.website_evergreen_text(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_seat_calls_and_dropped_features(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_evergreen_text(v.id) from public.venue v where not v.is_practice;
