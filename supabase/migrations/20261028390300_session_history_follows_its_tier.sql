-- Session history follows its tier switch (#504; #496 item 5, the owner's answer of 27 Oct). A member reads their own
-- past visits and seats, their buy-ins and cash-outs, settled markers and what cash-outs settled only with
-- sessions.history in their tier. What is open now is not history and stays readable whatever the tier: tonight's
-- visit and seat, and a marker still owed, which the wallet shows (#75). TDS stays readable too, as a member is owed
-- the certificate whatever their tier (decision 0169). The gate is the signed-in member's, read once a query.
drop policy "members see their own visits" on public.visit;
create policy "members see their own visits, past ones with session history" on public.visit
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (closed_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see their own seat sessions" on public.seat_session;
create policy "members see their own seat sessions, past ones with session history" on public.seat_session
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (ended_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see their own cage transactions" on public.cage_transaction;
create policy "members with session history see their own cage transactions" on public.cage_transaction
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (select private.has_feature((select private.current_member_id()), 'sessions.history')));

drop policy "members see their own markers" on public.marker;
create policy "members see their own markers, settled ones with session history" on public.marker
  for select to authenticated
  using (member_id = (select private.current_member_id()) and (settled_at is null or (select private.has_feature((select private.current_member_id()), 'sessions.history'))));

drop policy "members see what their cash-outs settled" on public.marker_settlement;
create policy "members with session history see what their cash-outs settled" on public.marker_settlement
  for select to authenticated
  using (marker_id in (select k.id from public.marker k where k.member_id = (select private.current_member_id())) and (select private.has_feature((select private.current_member_id()), 'sessions.history')));
