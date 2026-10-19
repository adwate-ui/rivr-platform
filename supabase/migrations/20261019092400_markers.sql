-- Markers (#74; scope-v1 module 5; additions flow 19; design prompt Markers). A cashier issues chips on
-- credit to a seated member, who signs on the cage screen: the marker posts to the member's
-- receivable, never to their wallet. It is refused while one of their markers is past due, above
-- their credit limit (#73), or above the room's exposure cap. A marker is due markers.due_days after
-- it was issued; cash-outs settle open markers first (#75).
-- Refusals the cage tells apart: RVDUE a marker past due; RVLIM above the limit; RVEXP above the
-- room's cap; RVCHP not whole chips; RVSIG no signature; RVCFG credit or the due days not set up; and the cage's own
-- (RVKYC, RVBRK, RVNST, RVKIL...).

insert into public.setting_key (key, description, scope, value_schema) values
  ('markers.due_days',
   'How many days after it is issued a marker falls due; a member with a marker past due gets no new credit (scope-v1 module 5).',
   'venue',
   '{"type":"object","properties":{"days":{"type":"integer","minimum":1,"maximum":90}},"required":["days"],"additionalProperties":false}');

create table public.marker (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise % 5000 = 0),
  -- What is still owed: cash-outs and repayments bring it down (#75).
  outstanding_paise bigint not null check (outstanding_paise >= 0 and outstanding_paise % 5000 = 0),
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  -- The member's signature from the cage screen, as SVG path data.
  signature_svg text not null check (length(signature_svg) between 10 and 20000 and signature_svg ~ '^[MLCSQ0-9 ,.-]+$'),
  issued_by_staff_id uuid,
  session_id uuid references public.seat_session (id),
  ledger_transaction_id uuid not null,
  idempotency_key uuid not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (issued_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (ledger_transaction_id, venue_id) references public.ledger_transaction (id, venue_id),
  unique (venue_id, idempotency_key),
  check (outstanding_paise <= amount_paise),
  check ((outstanding_paise = 0) = (settled_at is not null)),
  check (due_at > issued_at)
);

comment on table public.marker is 'Chips on credit: the amount, what is still owed, when it falls due and the member''s signature (#74).';

create index marker_member_idx on public.marker (member_id, venue_id);
create index marker_open_idx on public.marker (venue_id, due_at) where settled_at is null;
create index marker_staff_idx on public.marker (issued_by_staff_id, venue_id);
create index marker_session_idx on public.marker (session_id);
create index marker_ledger_idx on public.marker (ledger_transaction_id, venue_id);
create trigger marker_touch_updated_at before update on public.marker
  for each row execute function private.touch_updated_at();
create trigger marker_audit after insert or update or delete on public.marker
  for each row execute function private.audit_row_change();

alter table public.marker enable row level security;
grant select on public.marker to authenticated;
create policy "members see their own markers" on public.marker
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who issue markers, set limits or read the ledger see the venue's markers" on public.marker
  for select to authenticated
  using (venue_id in (select private.venues_where('markers.issue')) or venue_id in (select private.venues_where('markers.manage_limits'))
         or venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain markerCheck in SQL, proved on the same golden file: 'ok' or why not.
create function private.marker_check(p_amount_paise bigint, p_outstanding_paise bigint, p_limit_paise bigint, p_exposure_paise bigint,
                                     p_cap_paise bigint, p_is_past_due boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_amount_paise <= 0 or p_amount_paise % 5000 <> 0 then 'not_chips'
              when p_is_past_due then 'past_due'
              when p_outstanding_paise + p_amount_paise > p_limit_paise then 'above_limit'
              when p_exposure_paise + p_amount_paise > p_cap_paise then 'above_exposure'
              else 'ok' end;
$$;

-- What a member owes on markers: their receivable's balance, a sum of ledger entries (money.md).
create function private.member_owes(p_member_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)::bigint
  from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
  where a.member_id = p_member_id and a.code = 'member.receivable';
$$;

-- Whether one of a member's open markers is past due at `p_at`.
create function private.has_past_due_marker(p_member_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.marker k where k.member_id = p_member_id and k.settled_at is null and k.due_at < p_at);
$$;

-- A cashier issues a marker to a seated member who has signed, once per request id. Gives the marker.
create function private.issue_marker(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_signature_svg text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.marker;
  v_session public.seat_session;
  v_config record;
  v_due_days integer;
  v_check text;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'markers.issue') then
    raise exception 'Only a cashier issues markers' using errcode = '42501';
  end if;
  select * into v_replay from public.marker k where k.venue_id = p_venue_id and k.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise then
      raise exception 'That request id was used for another marker' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  select * into v_config from private.credit_config(p_venue_id);
  v_due_days := (private.setting_at(p_venue_id, 'markers.due_days', '', now()) ->> 'days')::integer;
  if v_config.exposure_cap_paise is null or v_due_days is null then
    raise exception 'Credit is not set up at this venue' using errcode = 'RVCFG';
  end if;
  -- The member locked, KYC, a break, freezes and the seat: as for any chips from the cage (#57).
  v_session := private.cage_check(p_venue_id, p_member_id);
  perform private.assert_writable(p_venue_id, 'credit', p_member_id);
  if length(coalesce(p_signature_svg, '')) not between 10 and 20000 or p_signature_svg !~ '^[MLCSQ0-9 ,.-]+$' then
    raise exception 'The member signs for a marker' using errcode = 'RVSIG';
  end if;
  -- One marker at a time across the room, so the cap holds; a twin request that waited here is the same marker.
  perform pg_advisory_xact_lock(hashtextextended('markers:' || p_venue_id, 0));
  select k.id into v_id from public.marker k where k.venue_id = p_venue_id and k.idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  v_check := private.marker_check(p_amount_paise, private.member_owes(p_member_id),
    coalesce((select l.limit_paise from public.credit_line l where l.venue_id = p_venue_id and l.member_id = p_member_id), 0),
    private.room_exposure(p_venue_id), v_config.exposure_cap_paise, private.has_past_due_marker(p_member_id, now()));
  if v_check <> 'ok' then
    raise exception 'Refused: %', v_check
      using errcode = case v_check when 'not_chips' then 'RVCHP' when 'past_due' then 'RVDUE' when 'above_limit' then 'RVLIM' else 'RVEXP' end;
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'marker', 'marker:' || p_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.receivable'),
                         'amount', p_amount_paise::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'
                                         and a.member_id is null), 'amount', (-p_amount_paise)::text)),
    'credit', 'Marker at the cage');
  insert into public.marker (venue_id, member_id, amount_paise, outstanding_paise, due_at, signature_svg, issued_by_staff_id, session_id,
                             ledger_transaction_id, idempotency_key)
  values (p_venue_id, p_member_id, p_amount_paise, p_amount_paise,
          now() + make_interval(days => v_due_days),
          p_signature_svg, private.current_staff_id(p_venue_id), v_session.id, v_txn, p_idempotency_key)
  returning id into v_id;
  perform private.emit(p_venue_id, 'marker.issued',
                       jsonb_build_object('marker_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise), 'marker.issued:' || v_id);
  return v_id;
end;
$$;

-- The Markers screen: every open marker, oldest first, with its member, age in days, due date and
-- whether it is past due, and the member's limit.
create function private.open_markers(p_venue_id uuid)
returns table (marker_id uuid, member_id uuid, full_name text, amount_paise bigint, outstanding_paise bigint, issued_at timestamptz,
               due_at timestamptz, age_days integer, is_past_due boolean, limit_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, m.id, m.full_name, k.amount_paise, k.outstanding_paise, k.issued_at, k.due_at,
         floor(extract(epoch from (now() - k.issued_at)) / 86400)::integer, k.due_at < now(),
         coalesce(l.limit_paise, 0)
  from public.marker k
  join public.member m on m.id = k.member_id
  left join public.credit_line l on l.venue_id = k.venue_id and l.member_id = k.member_id
  where k.venue_id = p_venue_id and k.settled_at is null
    and (private.has_permission(p_venue_id, 'markers.issue') or private.has_permission(p_venue_id, 'markers.manage_limits')
         or private.has_permission(p_venue_id, 'ledger.read'))
  order by k.issued_at, k.id;
$$;

revoke execute on function private.marker_check(bigint, bigint, bigint, bigint, bigint, boolean), private.member_owes(uuid),
  private.has_past_due_marker(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.issue_marker(uuid, uuid, bigint, text, uuid), private.open_markers(uuid) from public, anon;
grant execute on function private.issue_marker(uuid, uuid, bigint, text, uuid), private.open_markers(uuid) to authenticated;

create function public.issue_marker(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_signature_svg text, p_idempotency_key uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.issue_marker(p_venue_id, p_member_id, p_amount_paise, p_signature_svg, p_idempotency_key); $$;
create function public.open_markers(p_venue_id uuid)
returns table (marker_id uuid, member_id uuid, full_name text, amount_paise bigint, outstanding_paise bigint, issued_at timestamptz,
               due_at timestamptz, age_days integer, is_past_due boolean, limit_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.open_markers(p_venue_id); $$;

revoke execute on function public.issue_marker(uuid, uuid, bigint, text, uuid), public.open_markers(uuid) from public, anon;
grant execute on function public.issue_marker(uuid, uuid, bigint, text, uuid), public.open_markers(uuid) to authenticated;
