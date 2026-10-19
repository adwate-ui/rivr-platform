-- End of down with the drop-box count (#44; scope-v1 module 4): the dealer enters what the drop box
-- holds, the down records it beside the rake and jackpot drops logged in its hands, and the
-- variance (count less logged) is shown on the tablet. A variance beyond dealer.variance_threshold
-- either way raises an alert for the floor and the owner. The next dealer then signs in. A down
-- ended without a count (the tablet moved, or freed) keeps none.

insert into public.setting_key (key, description, scope, value_schema) values
  ('dealer.variance_threshold',
   'How far a down''s drop-box count may differ from the rake and jackpot drops logged in its hands, either way, before an alert is raised: paise, in whole ₹50 chips (scope-v1 module 4).',
   'venue',
   '{"type":"object","properties":{"threshold_paise":{"type":"integer","minimum":0,"maximum":10000000,"multipleOf":5000}},"required":["threshold_paise"],"additionalProperties":false}');

alter table public.dealer_down
  add column drop_box_paise bigint check (drop_box_paise is null or (drop_box_paise >= 0 and drop_box_paise <= 1000000000 and drop_box_paise % 5000 = 0)),
  add column logged_paise bigint check (logged_paise is null or logged_paise >= 0),
  add column variance_paise bigint,
  add constraint dealer_down_counted check (
    (drop_box_paise is null) = (logged_paise is null) and (logged_paise is null) = (variance_paise is null)
    and (drop_box_paise is null or (ended_at is not null and variance_paise = drop_box_paise - logged_paise)));

comment on column public.dealer_down.variance_paise is 'The drop-box count less the rake and jackpot drops logged in the down''s hands (#44).';

-- The tablet ends its down with the drop-box count: the down closes, keeping the count, what its
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
  v_threshold bigint;
begin
  select * into v_tablet from private.my_tablet_table();
  select * into v_down from public.dealer_down dd where dd.table_id = v_tablet.o_table_id and dd.ended_at is null for update;
  if v_down.id is null then
    raise exception 'No down is open at this table' using errcode = 'RVDWN';
  end if;
  select coalesce(sum(h.rake_paise + h.drop_paise), 0)::bigint into v_logged from public.hand h where h.down_id = v_down.id;
  update public.dealer_down dd
  set ended_at = greatest(now(), dd.started_at), drop_box_paise = p_drop_box_paise, logged_paise = v_logged,
      variance_paise = p_drop_box_paise - v_logged
  where dd.id = v_down.id;
  v_threshold := (private.setting_at(v_down.venue_id, 'dealer.variance_threshold', '', now()) ->> 'threshold_paise')::numeric::bigint;
  if v_threshold is not null and abs(p_drop_box_paise - v_logged) > v_threshold then
    perform private.raise_alert(v_down.venue_id, 'dealer.variance',
      jsonb_build_object('down_id', v_down.id, 'table_id', v_down.table_id, 'staff_id', v_down.staff_id,
                         'drop_box_paise', p_drop_box_paise, 'logged_paise', v_logged, 'variance_paise', p_drop_box_paise - v_logged));
  end if;
  return query select v_logged, p_drop_box_paise - v_logged;
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
