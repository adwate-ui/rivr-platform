-- Money settings guarded in the database (#323; the owner's answers to #302 and #296). A hand's rake and
-- jackpot drop use the rule in force at the hand's time, and a tablet's clock may run up to a minute
-- ahead of the server's. So for the money keys (rake.config, jackpot.drop, jackpot.shares) a signed-in
-- staff member, through any client, can neither schedule a new value to take effect a minute or less
-- from now nor withdraw one within a minute of taking effect: either could disagree with a hand already
-- logged. And jackpot.drop refuses a pot threshold below the drop, so a drop never takes more than a
-- pot holds. Migrations, the seed and the venue bootstrap, with nobody signed in, write as before.

-- The keys whose changes a hand already logged may depend on.
create function private.is_money_setting(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_key in ('rake.config', 'jackpot.drop', 'jackpot.shares'); $$;

-- The setting check and the withdraw policy run as the staff member, so they may ask it.
grant execute on function private.is_money_setting(text) to authenticated;

-- As lane 0's check (20261018090600_settings.sql), with the minute's notice for money keys and the
-- jackpot drop's threshold.
create or replace function private.check_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  definition public.setting_key;
begin
  select * into definition from public.setting_key k where k.key = new.key;
  if not extensions.jsonb_matches_schema(definition.value_schema::json, new.value) then
    raise exception 'value for % does not match its schema', new.key using errcode = 'check_violation';
  end if;
  if (definition.scope = 'venue') <> (new.subject = '') then
    raise exception 'subject for % must be % ', new.key,
      case when definition.scope = 'venue' then 'empty' else 'set' end using errcode = 'check_violation';
  end if;
  if (select auth.uid()) is not null and new.effective_from < now() - interval '1 minute' then
    raise exception 'settings cannot take effect in the past' using errcode = 'check_violation';
  end if;
  if (select auth.uid()) is not null and private.is_money_setting(new.key) and new.effective_from <= now() + interval '1 minute' then
    raise exception '% takes effect more than a minute from now, so no hand already logged disagrees with it', new.key
      using errcode = 'RVMIN';
  end if;
  if new.key = 'jackpot.drop' and (new.value -> 'above_paise')::bigint < (new.value -> 'drop_paise')::bigint then
    raise exception 'a jackpot drop comes only from pots above at least the drop' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A setting manager withdraws a change before it takes effect; a money key's, more than a minute before.
drop policy "setting managers withdraw settings not yet in force" on public.setting;
create policy "setting managers withdraw settings not yet in force" on public.setting
  for delete to authenticated
  using (venue_id in (select private.venues_where('settings.manage'))
         and effective_from > now() + case when private.is_money_setting(key) then interval '1 minute' else interval '0' end);
