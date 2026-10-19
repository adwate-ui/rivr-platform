-- The website's live blocks (#35): games and stakes from the floor, and the tournament calendar.
-- Both read public views of the club only, never the practice venue, and hold no personal data.

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar'));

-- Each table at the club with its game, stakes and buy-in, and whether it is open (lane B's
-- public_table_status, for the website, the link-in-bio page and the TVs).
create function private.public_table_status_rows()
returns table (venue_slug text, table_name text, table_position integer, is_open boolean, table_type_code text,
               table_type_name text, game text, small_blind_paise bigint, big_blind_paise bigint,
               buy_in_min_paise bigint, buy_in_max_paise bigint, straddle_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, g.name, g.position, g.is_open, t.code, t.name, t.game, t.small_blind_paise, t.big_blind_paise,
         t.buy_in_min_paise, t.buy_in_max_paise, t.straddle_paise
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  join public.venue v on v.id = g.venue_id
  where not v.is_practice;
$$;

-- A tournament on the schedule: what the calendar shows. Lane B adds formats, blind structures,
-- entries and the clock (#115, #116) and the console's screens for it; until then the schedule is
-- written by migration or seed only.
create table public.tournament (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 80),
  starts_at timestamptz not null,
  -- The whole buy-in a player pays, fee included; chips are multiples of ₹50.
  buy_in_paise bigint not null check (buy_in_paise > 0 and buy_in_paise % 5000 = 0),
  -- The prize pool the club guarantees; null for none.
  guarantee_paise bigint check (guarantee_paise > 0 and guarantee_paise % 5000 = 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);

comment on table public.tournament is 'A scheduled tournament: its name, start, buy-in and guarantee, as the calendar shows it.';

create index tournament_venue_starts_idx on public.tournament (venue_id, starts_at);
create trigger tournament_touch_updated_at before update on public.tournament
  for each row execute function private.touch_updated_at();
create trigger tournament_audit after insert or update or delete on public.tournament
  for each row execute function private.audit_row_change();

alter table public.tournament enable row level security;
grant select on public.tournament to authenticated;

create policy "staff and members see the venue's published tournaments" on public.tournament
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         or (is_published and venue_id = (select private.current_member_venue_id())));

-- The club's published tournaments from twelve hours ago on, in order: what anyone may read.
create function private.public_tournament_calendar_rows()
returns table (venue_slug text, name text, starts_at timestamptz, buy_in_paise bigint, guarantee_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, t.name, t.starts_at, t.buy_in_paise, t.guarantee_paise
  from public.tournament t join public.venue v on v.id = t.venue_id
  where t.is_published and not v.is_practice and t.starts_at >= now() - interval '12 hours';
$$;

grant execute on function private.public_table_status_rows(), private.public_tournament_calendar_rows() to anon, authenticated;

create view public.public_table_status
with (security_invoker = true)
as
select venue_slug, table_name, table_position, is_open, table_type_code, table_type_name, game, small_blind_paise,
       big_blind_paise, buy_in_min_paise, buy_in_max_paise, straddle_paise
from private.public_table_status_rows();

create view public.public_tournament_calendar
with (security_invoker = true)
as
select venue_slug, name, starts_at, buy_in_paise, guarantee_paise from private.public_tournament_calendar_rows();

grant select on public.public_table_status, public.public_tournament_calendar to anon, authenticated;
