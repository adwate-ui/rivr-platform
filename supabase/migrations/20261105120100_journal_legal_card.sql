-- "Is poker legal in Gurugram?" was published on 3 Nov (decision 0308) with no card on the Journal, and the console's
-- editor cannot add one (#623). Its card joins the Journal's articles once, while the article is published, the
-- articles block still has room and the club has not given it a card of its own.
create function private.journal_legal_card(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b set content = jsonb_set(b.content, '{cards}', b.content -> 'cards' || $j$[
      {"label": "The law", "title": "Is poker legal in Gurugram?", "text": "What India's courts and Haryana's law say about poker as a game of skill.", "link": {"page": "journal-poker-legal-gurugram", "label": "Read"}}
    ]$j$::jsonb)
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'journal' and b.kind = 'cards' and b.content ->> 'heading' = 'Articles'
    and jsonb_array_length(b.content -> 'cards') < 12
    and not b.content -> 'cards' @> '[{"link": {"page": "journal-poker-legal-gurugram"}}]'
    and exists (select 1 from public.site_page a where a.venue_id = p_venue_id and a.slug = 'journal-poker-legal-gurugram' and a.is_published);
$$;
revoke execute on function private.journal_legal_card(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261104320000_no_crm_and_website_launch.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_launch_answers;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_launch_answers(p_venue_id);
  perform private.journal_legal_card(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_launch_answers(uuid) from public, anon, authenticated;

-- The club made before.
select private.journal_legal_card(v.id) from public.venue v where not v.is_practice;
