-- The privacy notice says the desk now keeps photos of the PAN and the Aadhaar front (the owner, 9 Nov; decision 0573), and
-- who can open them. Each line only while it still reads as the website came with it, so a club's own words stay.
create function private.website_keeps_id_photos(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines constant text[][] := array[
    ['your PAN and the last four digits of your Aadhaar. RIVR never keeps your full Aadhaar number.',
     'your PAN and the last four digits of your Aadhaar. The desk also keeps a photo of your PAN card and a photo of the front of your Aadhaar, with its first eight digits and QR code hidden. RIVR never keeps your full Aadhaar number.'],
    ['see your selfie, to know it is you.',
     'see your selfie, to know it is you. Only RIVR''s most senior administrators can open the photos of your PAN and Aadhaar, and each opening is recorded.']
  ];
  v_line text[];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0 and strpos(b.content::text, v_line[2]) = 0;
  end loop;
end;
$$;
revoke execute on function private.website_keeps_id_photos(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website as it stood, then this.
alter function private.add_website(uuid) rename to add_website_before_id_photos;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_before_id_photos(p_venue_id);
  perform private.website_keeps_id_photos(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_before_id_photos(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_keeps_id_photos(v.id) from public.venue v where not v.is_practice;
