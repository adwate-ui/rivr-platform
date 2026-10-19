-- End of down with the drop-box count (#44; scope-v1 module 4): the dealer enters what the drop box
-- holds; the down's count keeps it beside the rake and jackpot drops logged in its hands, and the
-- variance (count less logged) is shown on the tablet. A variance beyond dealer.variance_threshold
-- either way raises an alert for the floor and the owner; with no threshold set, any variance does.
-- A down with hands that closes without a count (the tablet moved or freed, or its dealer signed in
-- at another table) raises an alert too. The next dealer then signs in.

insert into public.setting_key (key, description, scope, value_schema) values
  ('dealer.variance_threshold',
   'How far a down''s drop-box count may differ from the rake and jackpot drops logged in its hands, either way, before an alert is raised: paise, in whole ₹50 chips (scope-v1 module 4). With none set, any difference raises one.',
   'venue',
   '{"type":"object","properties":{"threshold_paise":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000}},"required":["threshold_paise"],"additionalProperties":false}');

-- @rivr/domain downVariance in SQL, proved on the same golden file (packages/testing/golden/variance.json,
-- 024_golden_twins): the count less what was logged, and an alert when that is beyond the threshold
-- either way. Exactly at the threshold is no alert; with no threshold, any difference is one.
create function private.down_variance(p_drop_box_paise bigint, p_logged_paise bigint, p_threshold_paise bigint)
returns table (variance_paise bigint, is_alert boolean)
language sql
immutable
set search_path = ''
as $$
  select p_drop_box_paise - p_logged_paise, abs(p_drop_box_paise - p_logged_paise) > coalesce(p_threshold_paise, 0);
$$;

revoke execute on function private.down_variance(bigint, bigint, bigint) from public, anon, authenticated;

create table public.down_count (
  down_id uuid primary key references public.dealer_down (id),
  -- The down's venue, copied from it by end_down.
  venue_id uuid not null references public.venue (id),
  drop_box_paise bigint not null check (drop_box_paise >= 0 and drop_box_paise <= 1000000000 and drop_box_paise % 5000 = 0),
  logged_paise bigint not null check (logged_paise >= 0),
  variance_paise bigint not null,
  check (variance_paise = drop_box_paise - logged_paise),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.down_count is 'What the drop box held at the end of a down, what its hands logged, and the variance (#44).';

create index down_count_venue_created_idx on public.down_count (venue_id, created_at desc);
create trigger down_count_append_only before update or delete on public.down_count
  for each row execute function private.refuse_change();
create trigger down_count_no_truncate before truncate on public.down_count
  for each statement execute function private.refuse_change();
create trigger down_count_audit after insert on public.down_count
  for each row execute function private.audit_row_change();
alter table public.down_count enable row level security;
grant select on public.down_count to authenticated;

-- A down's count is the house's takings, as its hands are: staff who read the ledger see it. The
-- tablet gets its own back from end_down. Written only by end_down.
create policy "staff who read the ledger see the venue's down counts" on public.down_count
  for select to authenticated
  using (venue_id in (select private.venues_where('ledger.read')));

-- The tablet ends its down with the drop-box count: the down closes, keeping its count, what its
-- hands logged and the variance, which the tablet shows. Beyond the threshold, an alert. As End of
-- down was (#41), also while the venue is frozen. RVDWN when no down is open at the tablet's table.
drop function public.end_down();
drop function private.end_down();

create function private.end_down(p_drop_box_paise bigint)
returns table (logged_paise bigint, variance_paise bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_down public.dealer_down;
  v_logged bigint;
  v_result record;
begin
  select * into v_tablet from private.my_tablet_table();
  select * into v_down from public.dealer_down dd where dd.table_id = v_tablet.o_table_id and dd.ended_at is null for update;
  if v_down.id is null then
    raise exception 'No down is open at this table' using errcode = 'RVDWN';
  end if;
  select coalesce(sum(h.rake_paise + h.drop_paise), 0)::bigint into v_logged from public.hand h where h.down_id = v_down.id;
  select * into v_result from private.down_variance(p_drop_box_paise, v_logged,
    (private.setting_at(v_down.venue_id, 'dealer.variance_threshold', '', now()) ->> 'threshold_paise')::numeric::bigint);
  -- The count first: the down closing without one raises its own alert.
  insert into public.down_count (down_id, venue_id, drop_box_paise, logged_paise, variance_paise)
  values (v_down.id, v_down.venue_id, p_drop_box_paise, v_logged, v_result.variance_paise);
  update public.dealer_down dd set ended_at = greatest(now(), dd.started_at) where dd.id = v_down.id;
  if v_result.is_alert then
    perform private.raise_alert(v_down.venue_id, 'dealer.variance',
      jsonb_build_object('down_id', v_down.id, 'table_id', v_down.table_id, 'staff_id', v_down.staff_id,
                         'drop_box_paise', p_drop_box_paise, 'logged_paise', v_logged, 'variance_paise', v_result.variance_paise));
  end if;
  return query select v_logged, v_result.variance_paise;
end;
$$;

revoke execute on function private.end_down(bigint) from public, anon;
grant execute on function private.end_down(bigint) to authenticated;

create function public.end_down(p_drop_box_paise bigint)
returns table (logged_paise bigint, variance_paise bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.end_down(p_drop_box_paise); $$;

revoke execute on function public.end_down(bigint) from public, anon;
grant execute on function public.end_down(bigint) to authenticated;

-- A down with hands that closes without a count (dealer sign-in ends the dealer's own down
-- elsewhere and the table's last one; a tablet moved or freed ends its down) keeps no drop-box
-- figure, so the floor and the owner are alerted to count that box by hand.
create function private.alert_uncounted_down()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_logged bigint;
begin
  if exists (select 1 from public.down_count c where c.down_id = new.id) then
    return null;
  end if;
  select sum(h.rake_paise + h.drop_paise)::bigint into v_logged from public.hand h where h.down_id = new.id;
  if v_logged is not null then
    perform private.raise_alert(new.venue_id, 'dealer.uncounted',
      jsonb_build_object('down_id', new.id, 'table_id', new.table_id, 'staff_id', new.staff_id, 'logged_paise', v_logged));
  end if;
  return null;
end;
$$;

revoke execute on function private.alert_uncounted_down() from public, anon, authenticated;

create trigger dealer_down_uncounted after update of ended_at on public.dealer_down
  for each row when (old.ended_at is null and new.ended_at is not null)
  execute function private.alert_uncounted_down();
