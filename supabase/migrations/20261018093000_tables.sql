-- Table types and tables (#34, scope-v1 module 3, additions "Six tables in the seed"). A table type
-- carries the game, the blinds, the buy-in range and any compulsory straddle; its rake (rate and cap)
-- lives in the effective-dated setting rake.config, with the type's code as the subject, so a hand
-- uses the rule in force when it was logged. The jackpot drop is the venue's setting jackpot.drop.

insert into public.setting_key (key, description, scope, value_schema) values
  ('rake.config',
   'Rake per table type: the rate of the pot in basis points (500 is 5%) and the cap in paise, in whole ₹50 chips (scope-v1 module 3).',
   'table_type',
   '{"type":"object","properties":{"rate_basis_points":{"type":"integer","minimum":0,"maximum":1000},"cap_paise":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000}},"required":["rate_basis_points","cap_paise"],"additionalProperties":false}'),
  ('jackpot.drop',
   'The bad-beat jackpot drop while the jackpot is live: paise from every pot above the threshold, in whole ₹50 chips (scope-v1 module 4).',
   'venue',
   '{"type":"object","properties":{"drop_paise":{"type":"integer","minimum":0,"maximum":100000,"multipleOf":5000},"above_paise":{"type":"integer","minimum":0,"maximum":100000000,"multipleOf":5000}},"required":["drop_paise","above_paise"],"additionalProperties":false}');

create table public.table_type (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The subject of its effective-dated settings (rake.config, call_time.minutes): 'nlh_100_200'.
  code text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (length(trim(name)) between 1 and 60),
  game text not null check (game in ('NLH', 'PLO')),
  -- The variation button: Texas, PLO or a bomb pot, chosen per hand (scope-v1 module 3).
  has_variation boolean not null default false,
  small_blind_paise bigint not null check (small_blind_paise > 0 and small_blind_paise % 5000 = 0),
  big_blind_paise bigint not null check (big_blind_paise > small_blind_paise and big_blind_paise % 5000 = 0),
  buy_in_min_paise bigint not null check (buy_in_min_paise > 0 and buy_in_min_paise % 5000 = 0),
  buy_in_max_paise bigint not null check (buy_in_max_paise >= buy_in_min_paise and buy_in_max_paise % 5000 = 0),
  -- A compulsory straddle, as in the Private Room; null where there is none.
  straddle_paise bigint check (straddle_paise > 0 and straddle_paise % 5000 = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, code),
  unique (id, venue_id)
);

comment on table public.table_type is 'A kind of table: game, blinds, buy-in range and straddle. Its rake is the setting rake.config.';

create table public.game_table (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  table_type_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),
  -- The order the floor and the boards list tables in.
  position integer not null check (position between 1 and 99),
  seats integer not null default 9 check (seats between 2 and 10),
  -- A closed table is not running tonight (Table 4 in the design prompt).
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_type_id, venue_id) references public.table_type (id, venue_id),
  unique (venue_id, name),
  unique (id, venue_id)
);

comment on table public.game_table is 'A physical table on the floor, of one table type; open or closed.';

create index table_type_venue_idx on public.table_type (venue_id);
create index game_table_venue_idx on public.game_table (venue_id, position);
create index game_table_type_idx on public.game_table (table_type_id, venue_id);

create trigger table_type_touch_updated_at before update on public.table_type
  for each row execute function private.touch_updated_at();
create trigger table_type_audit after insert or update or delete on public.table_type
  for each row execute function private.audit_row_change();
create trigger game_table_touch_updated_at before update on public.game_table
  for each row execute function private.touch_updated_at();
create trigger game_table_audit after insert or update or delete on public.game_table
  for each row execute function private.audit_row_change();

alter table public.table_type enable row level security;
alter table public.game_table enable row level security;
grant select, insert, update on public.table_type, public.game_table to authenticated;

create policy "staff and members see the venue's table types" on public.table_type
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or venue_id = (select private.current_member_venue_id()));

create policy "floor managers add table types" on public.table_type
  for insert to authenticated
  with check (venue_id in (select private.venues_where('floor.manage')));

create policy "floor managers change table types" on public.table_type
  for update to authenticated
  using (venue_id in (select private.venues_where('floor.manage')))
  with check (venue_id in (select private.venues_where('floor.manage')));

create policy "staff and members see the venue's tables" on public.game_table
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or venue_id = (select private.current_member_venue_id()));

create policy "floor managers add tables" on public.game_table
  for insert to authenticated
  with check (venue_id in (select private.venues_where('floor.manage')));

create policy "floor managers open, close and change tables" on public.game_table
  for update to authenticated
  using (venue_id in (select private.venues_where('floor.manage')))
  with check (venue_id in (select private.venues_where('floor.manage')));
