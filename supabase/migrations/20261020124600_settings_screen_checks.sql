-- The Settings screen (#33; decision 0104) writes any key, so the database checks what only a key's code
-- schema could: a value from now takes the database's clock, and jackpot.payout's split adds up.

-- A setting saved from now, with no time given, is from the database's now, whatever the device's clock says.
alter table public.setting alter column effective_from set default now();

-- As #323's (20261020090900_money_setting_guard.sql), and jackpot.payout's loser, winner and table shares
-- must make 100%: pay_bad_beat refuses any other split, so such a rule would stop every bad beat being paid.
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
  if new.key = 'jackpot.payout' and (new.value -> 'loser_basis_points')::integer + (new.value -> 'winner_basis_points')::integer
                                    + (new.value -> 'table_basis_points')::integer <> 10000 then
    raise exception 'a bad beat''s split between the loser, the winner and the table makes 100%%' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
