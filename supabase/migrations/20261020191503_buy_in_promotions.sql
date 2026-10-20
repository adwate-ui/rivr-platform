-- Buy-in promotions (#88; design prompt flow 3; lane D contract: lane A's buy-in calls
-- evaluate_promotions). Every buy-in at the cage is weighed once for the live promotions with a buy_in
-- rule, keyed by its cage transaction, with its amount, how it was paid and the table it was issued
-- to: the Tuesday bonus gives 20% of each of the first five buy-ins at a table that club day, credited
-- at once as bonus. A buy-in paid from bonus earns none (question #392). Promotions switched off, or
-- the venue or member frozen: the buy-in goes on and nothing is given. Decision 0144.
create function private.buy_in_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.evaluate_promotions(new.venue_id, 'buy_in', jsonb_build_object(
    'member_id', new.member_id, 'key', 'buy_in:' || new.id, 'amount_paise', new.amount_paise, 'method', new.method,
    'table_id', (select s.table_id from public.seat_session s where s.id = new.session_id)));
  return null;
end;
$$;

create trigger cage_transaction_buy_in_promotions after insert on public.cage_transaction
  for each row when (new.kind = 'buy_in') execute function private.buy_in_promotions();

revoke execute on function private.buy_in_promotions() from public, anon, authenticated;
