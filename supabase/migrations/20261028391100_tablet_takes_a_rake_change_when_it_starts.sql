-- The tablet takes a scheduled rake change at the moment it takes effect (#303). Its table's rules also say when they
-- next change: the earliest scheduled rake.config for the table's type, or jackpot.drop at its venue. The tablet asks
-- again then, as well as every minute. Before, it could show the old rate or cap for up to a minute while log_hand
-- raked by the new one at the hand's played_at, and the difference showed as drop-box variance.
drop function public.tablet_rake_rules();
drop function private.tablet_rake_rules();

-- The rules at the signed-in tablet's table now, and when they next change: null with nothing scheduled.
create function private.tablet_rake_rules()
returns table (rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint,
               drop_above_paise bigint, has_variation boolean, next_change_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rate_basis_points, r.cap_paise, r.is_jackpot_live, r.drop_paise, r.drop_above_paise, r.has_variation,
         (select min(s.effective_from) from public.setting s
          where s.venue_id = t.venue_id and s.effective_from > now()
            and ((s.key = 'rake.config' and s.subject = tt.code) or (s.key = 'jackpot.drop' and s.subject = '')))
  from public.game_table t
  join public.table_type tt on tt.id = t.table_type_id
  cross join lateral private.rake_rules_at(t.id, now()) r
  where t.id = (select o_table_id from private.my_tablet_table());
$$;

create function public.tablet_rake_rules()
returns table (rate_basis_points integer, cap_paise bigint, is_jackpot_live boolean, drop_paise bigint,
               drop_above_paise bigint, has_variation boolean, next_change_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_rake_rules(); $$;

revoke execute on function private.tablet_rake_rules(), public.tablet_rake_rules() from public, anon;
grant execute on function private.tablet_rake_rules(), public.tablet_rake_rules() to authenticated;
