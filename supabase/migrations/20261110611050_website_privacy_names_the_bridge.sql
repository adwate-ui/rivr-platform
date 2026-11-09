-- The privacy notice names the bridge that carries every code and message (8 Nov audit, I-110, F-213): since 4 Nov the club's
-- WhatsApp goes through Evolution API, hosted for RIVR by Elestio. Only while the line still reads as the website came with it.
create function private.website_privacy_names_the_bridge(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old constant text := 'WhatsApp, from Meta, sends your sign-in codes and the club''s messages, and MSG91 sends codes by SMS when WhatsApp cannot.';
  v_new constant text := 'WhatsApp, from Meta, carries your sign-in codes and the club''s messages. They reach WhatsApp through Evolution API, a bridge Elestio hosts for RIVR, which handles your number and each message. MSG91 sends codes by SMS when WhatsApp cannot.';
begin
  update public.site_block b set content = replace(b.content::text, v_old, v_new)::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'privacy' and strpos(b.content::text, v_old) > 0;
end;
$$;
revoke execute on function private.website_privacy_names_the_bridge(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261110610050_website_evergreen_text.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_evergreen_text;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_evergreen_text(p_venue_id);
  perform private.website_privacy_names_the_bridge(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_evergreen_text(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_privacy_names_the_bridge(v.id) from public.venue v where not v.is_practice;
