-- The link-in-bio page (#39): a links block, and how many wait for each game at the club (lane B's
-- public_waitlist_length), so the website's games show the queue. Counts only, never names; never
-- the practice venue.

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links'));

create function private.public_waitlist_length_rows()
returns table (venue_slug text, table_type_code text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, t.code,
         (select count(*)::integer from public.waitlist_entry e where e.table_type_id = t.id and e.status = 'waiting')
  from public.table_type t join public.venue v on v.id = t.venue_id
  where not v.is_practice;
$$;

grant execute on function private.public_waitlist_length_rows() to anon, authenticated;

create view public.public_waitlist_length
with (security_invoker = true)
as
select venue_slug, table_type_code, waiting from private.public_waitlist_length_rows();

grant select on public.public_waitlist_length to anon, authenticated;
