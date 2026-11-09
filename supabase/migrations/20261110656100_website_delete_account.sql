-- A page where someone without the app can ask to delete their account (#813, decision 0574). Google Play asks for its address
-- in the Data safety form. It says how to ask; the WhatsApp and phone links are at the top of every page, so it needs no form.
create function private.website_delete_account(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_site_page(p_venue_id, $page${
    "slug": "delete-account",
    "title": "Delete your RIVR account",
    "description": "How to ask RIVR to delete your account and its data.",
    "is_published": true,
    "blocks": [
      {"kind": "text", "content": {"heading": "Delete your RIVR account", "body": "In the RIVR app, open Profile and choose Delete my account.\n\nWithout the app, message or call the front desk from the number on your account. The WhatsApp and phone links are at the top of this page."}},
      {"kind": "text", "content": {"heading": "What happens", "body": "RIVR erases your account and its data within 7 days, once nothing is open at the club: your name, number, sign-in, selfie, identity details and preferences.\n\nYour points and bonus chips are forfeited. Play records the law requires are kept, without your name or number."}}
    ]
  }$page$::jsonb);
end;
$$;
revoke execute on function private.website_delete_account(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261110611050_website_privacy_names_the_bridge.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_without_delete_account;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_without_delete_account(p_venue_id);
  perform private.website_delete_account(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_without_delete_account(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_delete_account(v.id) from public.venue v where not v.is_practice;
