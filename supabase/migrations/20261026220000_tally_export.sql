-- The Tally export (#96; tech plan item 16; decision 0187): each club day's ledger as journal vouchers in
-- Tally's XML import format, one file per venue per day.
--
-- Treasury managers map each ledger account code to a ledger in the club's Tally company; the chart of
-- accounts is the owner's. A member's own accounts share their code, so all members' cash is one Tally
-- ledger. For a club day that has ended (06:00 to 06:00 IST), the console takes the day's money postings
-- by transaction kind and account code, recorded in the audit log each time, and @rivr/domain
-- tallyDayFile makes the file: one journal voucher per kind. Points never go to Tally. The practice
-- venue is never exported.

create table public.tally_ledger_map (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  account_code text not null check (account_code ~ '^[a-z_]+(\.[a-z_0-9]+)*$'),
  -- The ledger's name in the club's Tally company, as Tally spells it.
  tally_ledger text not null check (length(tally_ledger) between 1 and 100 and tally_ledger = btrim(tally_ledger)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, account_code),
  unique (id, venue_id)
);
comment on table public.tally_ledger_map is 'Which Tally ledger each ledger account code posts to in the daily Tally export (#96).';
create trigger tally_ledger_map_touch_updated_at before update on public.tally_ledger_map
  for each row execute function private.touch_updated_at();
create trigger tally_ledger_map_audit after insert or update or delete on public.tally_ledger_map
  for each row execute function private.audit_row_change();
alter table public.tally_ledger_map enable row level security;
grant select on public.tally_ledger_map to authenticated;
create policy "treasury managers see the Tally ledgers" on public.tally_ledger_map
  for select to authenticated using (venue_id in (select private.venues_where('treasury.manage')));

-- The venue's money account codes, each with its venue account's name (null when only members hold it)
-- and its Tally ledger (null until mapped).
create function private.tally_accounts(p_venue_id uuid)
returns table (account_code text, account_name text, tally_ledger text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers map Tally ledgers' using errcode = '42501';
  end if;
  return query
  select a.code, min(a.name) filter (where a.member_id is null), m.tally_ledger
  from public.ledger_account a
  left join public.tally_ledger_map m on m.venue_id = a.venue_id and m.account_code = a.code
  where a.venue_id = p_venue_id and a.unit = 'paise'
  group by a.code, m.tally_ledger
  order by a.code;
end;
$$;

-- Maps one money account code to a Tally ledger, or changes its mapping.
create function private.set_tally_ledger(p_venue_id uuid, p_account_code text, p_tally_ledger text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers map Tally ledgers' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_tally_ledger, ''))) not between 1 and 100
     or not exists (select 1 from public.ledger_account a where a.venue_id = p_venue_id and a.code = p_account_code and a.unit = 'paise') then
    raise exception 'A money account of this venue, and a Tally ledger''s name' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.tally_ledger_map (venue_id, account_code, tally_ledger) values (p_venue_id, p_account_code, btrim(p_tally_ledger))
  on conflict (venue_id, account_code) do update set tally_ledger = excluded.tally_ledger;
end;
$$;

-- A club day's money postings for Tally: each transaction kind's entries summed by account code, with the
-- code's Tally ledger (null until mapped); sums of nothing are left out. Recorded in the audit log each
-- time. Only a club day that has ended, at a venue that keeps accounts.
create function private.tally_day(p_venue_id uuid, p_day date)
returns table (kind text, account_code text, tally_ledger text, amount_paise bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'treasury.manage') then
    raise exception 'Only treasury managers take the Tally export' using errcode = '42501';
  end if;
  if p_day is null or p_day >= (now() at time zone 'Asia/Kolkata' - interval '6 hours')::date
     or exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'A club day that has ended, at a venue that keeps accounts' using errcode = '22023';
  end if;
  perform private.audit(p_venue_id, 'export.tally_day', 'ledger_transaction', p_day::text);
  return query
  select t.kind, a.code, m.tally_ledger, sum(e.amount)::bigint
  from public.ledger_transaction t
  join public.ledger_entry e on e.transaction_id = t.id and e.venue_id = t.venue_id
  join public.ledger_account a on a.id = e.account_id and a.venue_id = e.venue_id
  left join public.tally_ledger_map m on m.venue_id = a.venue_id and m.account_code = a.code
  where t.venue_id = p_venue_id and a.unit = 'paise'
    and t.occurred_at >= (p_day + time '06:00') at time zone 'Asia/Kolkata'
    and t.occurred_at < (p_day + 1 + time '06:00') at time zone 'Asia/Kolkata'
  group by t.kind, a.code, m.tally_ledger
  having sum(e.amount) <> 0
  order by t.kind, a.code;
end;
$$;

create function public.tally_accounts(p_venue_id uuid)
returns table (account_code text, account_name text, tally_ledger text)
language sql stable security invoker set search_path = ''
as $$ select * from private.tally_accounts(p_venue_id); $$;
create function public.set_tally_ledger(p_venue_id uuid, p_account_code text, p_tally_ledger text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tally_ledger(p_venue_id, p_account_code, p_tally_ledger); $$;
create function public.tally_day(p_venue_id uuid, p_day date)
returns table (kind text, account_code text, tally_ledger text, amount_paise bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.tally_day(p_venue_id, p_day); $$;

revoke execute on function private.tally_accounts(uuid), private.set_tally_ledger(uuid, text, text), private.tally_day(uuid, date) from public, anon;
grant execute on function private.tally_accounts(uuid), private.set_tally_ledger(uuid, text, text), private.tally_day(uuid, date) to authenticated;
revoke execute on function public.tally_accounts(uuid), public.set_tally_ledger(uuid, text, text), public.tally_day(uuid, date) from public, anon;
grant execute on function public.tally_accounts(uuid), public.set_tally_ledger(uuid, text, text), public.tally_day(uuid, date) to authenticated;
