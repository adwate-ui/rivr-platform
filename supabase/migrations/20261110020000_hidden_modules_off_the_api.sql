-- The hidden money modules (cage, shift, markers, withdrawals, deposits, wallet, expenses, accounts, Tally, TDS;
-- decision 0284) keep their code, as the owner asked, but no signed-in or anonymous caller reaches their functions through
-- the API (audit of 8 Nov 2026: F-038; decision 0513). PostgREST asks private.refuse_hidden_modules before every
-- request. SQL inside the database, the service role and the pgTAP suite are untouched, so a module comes back by
-- taking its names off the list.

-- The hidden money modules' functions, refused to every API caller but the service role: every function packages/db
-- calls only for a hidden screen that keeps money (cage.ts, treasury.ts, eod.ts, markers.ts, credit.ts, withdrawals.ts,
-- deposits.ts, wallet.ts, payoutAccounts.ts, paymentAccounts.ts, expenses.ts, tally.ts, tds.ts, jackpots.ts,
-- shareholding.ts), the money of the hidden tournaments and Academy, and the hidden money reports. Not the TV's jackpot
-- board, tournament interest or a member's Academy bookings, which live screens read.
create function private.refuse_hidden_modules()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and current_setting('request.path', true) = any (array[
    '/rpc/cage_buy_in', '/rpc/cage_cash_out', '/rpc/cage_members', '/rpc/cage_queue', '/rpc/decline_buy_in_request',
    '/rpc/close_cage_shift', '/rpc/eod_closes', '/rpc/review_eod_close', '/rpc/review_shift_opening', '/rpc/shift_openings',
    '/rpc/credit_report', '/rpc/issue_marker', '/rpc/open_markers', '/rpc/repay_markers',
    '/rpc/decline_withdrawal', '/rpc/my_withdrawals', '/rpc/pay_withdrawal_in_cash', '/rpc/pay_withdrawal_through_cashfree',
    '/rpc/request_withdrawal', '/rpc/second_approve_withdrawal', '/rpc/send_withdrawal', '/rpc/waiting_withdrawals',
    '/rpc/confirm_deposit', '/rpc/deposit_details', '/rpc/my_deposits', '/rpc/reject_deposit', '/rpc/request_deposit',
    '/rpc/second_approve_deposit', '/rpc/waiting_deposits', '/rpc/my_wallet',
    '/rpc/add_expense_category', '/rpc/decide_expense', '/rpc/request_expense', '/rpc/venue_expenses',
    '/rpc/account_statement', '/rpc/add_payment_account', '/rpc/payment_accounts', '/rpc/transfer_between_accounts',
    '/rpc/set_tally_ledger', '/rpc/tally_accounts', '/rpc/tally_day',
    '/rpc/my_tds_certificates', '/rpc/tds_ledger', '/rpc/tds_return_extract',
    '/rpc/chip_inventory', '/rpc/count_chips', '/rpc/open_cage_shift', '/rpc/treasury',
    '/rpc/add_payout_account', '/rpc/decide_payout_account', '/rpc/my_payout_accounts', '/rpc/payout_accounts_to_verify',
    '/rpc/remove_payout_account',
    '/rpc/credit_lines', '/rpc/credit_room', '/rpc/decide_credit_limit', '/rpc/set_credit_limit',
    '/rpc/jackpot_history', '/rpc/jackpot_pools', '/rpc/pay_bad_beat', '/rpc/reverse_jackpot_event',
    '/rpc/cage_tournament_entry', '/rpc/refund_tournament_alternate', '/rpc/set_tournament_payouts', '/rpc/tournament_balance',
    '/rpc/tournament_payouts',
    '/rpc/academy_payment_details', '/rpc/claim_academy_payment', '/rpc/confirm_academy_payment', '/rpc/record_academy_payment',
    '/rpc/reject_academy_payment',
    '/rpc/add_shareholder', '/rpc/record_holding', '/rpc/shareholding_history', '/rpc/shareholding_register',
    '/rpc/mis_report_for', '/rpc/rake_tonight', '/rpc/unclaimed_balances']) then
    raise exception 'That part of RIVR is not in use' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.refuse_hidden_modules() from public;
grant execute on function private.refuse_hidden_modules() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request to 'private.refuse_hidden_modules';
notify pgrst, 'reload config';
