-- The privacy notice's cookies section once analytics can be allowed (decision 0298): the website and the app ask in
-- their cookie banners, and only a yes loads Google Tag Manager, with Google Analytics and the Meta pixel inside it.
-- Only while the section still reads as the website came with it, so a club's own words stay.
create function private.website_analytics_consent(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b
  set content = jsonb_set(b.content, '{body}', to_jsonb('This website and the app keep only what they need to work, unless you allow more in their cookie banners.

The website''s map is Google Maps, which sets its own cookies only if you allow maps.

If you allow analytics, Google Tag Manager loads Google Analytics, from Google, and the Meta pixel, from Meta. They set their own cookies to count visits and to measure RIVR''s adverts. Without your yes, neither loads.

You can change your choice at any time: Cookie settings at the foot of the website, or Analytics and ads in Profile in the app.'::text))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'privacy' and b.kind = 'text'
    and b.content ->> 'heading' = 'Cookies on this website'
    and b.content ->> 'body' = 'This website keeps only what it needs to work. Its map is Google Maps, which sets its own cookies only if you allow maps in the cookie banner. The website runs no analytics or advertising tools.';
$$;
revoke execute on function private.website_analytics_consent(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102080000_website_room_without_repeats.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_room_without_repeats;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_room_without_repeats(p_venue_id);
  perform private.website_analytics_consent(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_room_without_repeats(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_analytics_consent(v.id) from public.venue v where not v.is_practice;
