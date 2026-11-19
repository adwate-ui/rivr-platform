-- The website stops promising a call on WhatsApp (decision 0697: no WhatsApp on production; UI review of #1084's PR). The
-- lines 20261110091050 wrote, "the floor calls you on WhatsApp", now say the floor calls the member in the app, where the
-- seat call shows and its push arrives. Each line only while it still reads as the website came with it, so a club's own
-- words stay; every club's website now comes that way.
create function private.website_calls_in_the_app(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Each line as the website came with it, and what replaces it.
  v_lines constant text[][] := array[
    ['"Request a seat before you leave home. When one opens, the floor calls you on WhatsApp."',
     '"Request a seat before you leave home. When one opens, the floor calls you in the app."'],
    ['"Request a seat from the app. The floor calls you on WhatsApp when one opens."',
     '"Request a seat from the app. The floor calls you there when one opens."'],
    ['"Request a seat from home. When one opens, the floor calls you on WhatsApp."',
     '"Request a seat from home. When one opens, the floor calls you in the app."'],
    ['"Request a seat for a game in the app. It shows your place on the list, and the floor calls you on WhatsApp when a seat opens."',
     '"Request a seat for a game in the app. It shows your place on the list, and the floor calls you there when a seat opens."']
  ];
  v_line text[];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;
end;
$$;
revoke execute on function private.website_calls_in_the_app(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website as it was, then this.
alter function private.add_website(uuid) rename to add_website_with_privacy_sentry;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_privacy_sentry(p_venue_id);
  perform private.website_calls_in_the_app(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_privacy_sentry(uuid) from public, anon, authenticated;

-- The clubs made before.
select private.website_calls_in_the_app(v.id) from public.venue v where not v.is_practice;
