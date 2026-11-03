-- Tournaments without money (#800; decision 0441). The Tournaments screen is hidden (decision 0284), so staff who manage
-- tournaments publish an upcoming one from the console's Tournament interest screen: its name, start, the game and stake
-- as text, and a description, with no buy-in or prize. It is a tournament like any other: members see it in the app and
-- register interest, and the website's calendar lists it, with no buy-in. The tournament module's money stays as it was
-- for a tournament made from a template.

alter table public.tournament
  alter column buy_in_paise drop not null,
  add column game text check (game is null or length(btrim(game)) between 1 and 40),
  add column stake text check (stake is null or length(btrim(stake)) between 1 and 40),
  add column description text check (description is null or length(btrim(description)) between 1 and 500),
  add constraint tournament_buy_in_or_game check (buy_in_paise is not null or (game is not null and stake is not null)),
  -- Without a buy-in, no blind levels: such a tournament never starts a clock or sells an entry.
  add constraint tournament_levels_need_buy_in check (buy_in_paise is not null or levels is null);

comment on column public.tournament.buy_in_paise is
  'The whole buy-in a player pays, fee included, in multiples of ₹50; null for a tournament published without money (#800).';
comment on column public.tournament.game is 'The game as staff wrote it for a tournament without money (#800): No-limit hold''em.';
comment on column public.tournament.stake is 'The stake as staff wrote it for a tournament without money (#800): 25,000 chips.';

-- Publishes an upcoming tournament without money, for tournaments.manage: members see it at once. Refusals: 42501 not
-- tournaments.manage at the venue; 22023 a name of 1 to 80 characters, a start to come, a game and a stake of 1 to 40,
-- or a description of 500 at most, missing; RVFRZ the venue frozen.
create function private.publish_tournament(p_venue_id uuid, p_name text, p_starts_at timestamptz, p_game text, p_stake text,
                                           p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_runs_tournaments(p_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_starts_at <= now()
     or length(btrim(coalesce(p_game, ''))) not between 1 and 40 or length(btrim(coalesce(p_stake, ''))) not between 1 and 40
     or length(btrim(coalesce(p_description, ''))) > 500 then
    raise exception 'A name, a start to come, a game and a stake, and a description of 500 characters at most' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.tournament (venue_id, name, starts_at, game, stake, description, is_published)
  values (p_venue_id, btrim(p_name), p_starts_at, btrim(p_game), btrim(p_stake), nullif(btrim(coalesce(p_description, '')), ''), true)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.publish_tournament(p_venue_id uuid, p_name text, p_starts_at timestamptz, p_game text, p_stake text,
                                          p_description text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.publish_tournament(p_venue_id, p_name, p_starts_at, p_game, p_stake, p_description); $$;

revoke execute on function private.publish_tournament(uuid, text, timestamptz, text, text, text),
  public.publish_tournament(uuid, text, timestamptz, text, text, text) from public, anon;
grant execute on function private.publish_tournament(uuid, text, timestamptz, text, text, text),
  public.publish_tournament(uuid, text, timestamptz, text, text, text) to authenticated;

-- The practice reset reloads tournaments, which now have columns without a default (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
