// Pays and follows the cage's Cashfree payouts of withdrawals (#475; decision 0231). pg_cron runs it each minute
// with the scheduler's secret. It claims the payouts due a look. Once a send has been tried, a transfer may exist:
// it is looked up (Cashfree's transfer id is made from the attempt's key), and only Cashfree's own answer moves
// the money. A payout is failed back to the cage only when no transfer can exist: refused before sending, or
// Cashfree saying there is none. A new send goes out only while money may go out and the account is in use.
// Any trouble asking means ask again later, never failed. The practice venue gets the fake; a real venue Cashfree
// from its four secrets.
import { createAdapters, createCashfreePayouts, transferIdOf, type AdapterFailure, type UpiPayout, type UpiPayoutAdapter } from '@rivr/adapters';
import { idempotencyKeySchema, paiseSchema, upiVpaSchema } from '@rivr/contracts';
import { rpc, serveScheduled } from '../_shared/outbox.ts';

// A run stops taking payouts after this long: with a payout's slowest asks (about 70 seconds) it stays inside the
// two minutes a claim holds one.
const RUN_BUDGET_MS = 45_000;

/** Cashfree, once all four of its settings are function secrets (decision 0197). */
function cashfree(): UpiPayoutAdapter | undefined {
  const clientId = Deno.env.get('CASHFREE_CLIENT_ID');
  const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
  const publicKey = Deno.env.get('CASHFREE_PUBLIC_KEY');
  const environment = Deno.env.get('CASHFREE_ENVIRONMENT');
  if (!clientId || !clientSecret || !publicKey || (environment !== 'sandbox' && environment !== 'production')) return undefined;
  return createCashfreePayouts({ clientId, clientSecret, publicKey, environment });
}

interface Claimed {
  readonly id: string;
  /** Anything but a plain false is the practice venue, so a doubtful row never reaches Cashfree. */
  readonly isPractice: boolean;
  readonly status: string;
  readonly payoutKey: string;
  readonly payoutId: string | null;
  readonly vpa: string;
  readonly holderName: string;
  readonly amountPaise: bigint;
  readonly mayPay: boolean;
  readonly accountOk: boolean;
  readonly attempted: boolean;
}

function claimedOf(row: unknown): Claimed {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  const payoutId = field('payout_id');
  return {
    id: String(field('withdrawal_request_id')), isPractice: field('is_practice') !== false, status: String(field('status')),
    payoutKey: String(field('payout_key')), payoutId: typeof payoutId === 'string' ? payoutId : null, vpa: String(field('vpa')),
    holderName: String(field('holder_name')), amountPaise: BigInt(String(field('amount_paise'))),
    mayPay: field('may_pay') === true, accountOk: field('account_ok') === true, attempted: field('attempted') === true,
  };
}

interface Said { readonly status: 'sent' | 'failed' | 'pending'; readonly payoutId: string | null; readonly utr: string | null; readonly failure: string | null }
type Look = { readonly found: UpiPayout } | 'none' | 'unknown';

const said = (payout: UpiPayout): Said => ({ status: payout.status, payoutId: payout.payoutId, utr: payout.utr, failure: payout.status === 'failed' ? 'Cashfree did not pay it' : null });
const failed = (failure: string): Said => ({ status: 'failed', payoutId: null, utr: null, failure });
const isNone = (failure: AdapterFailure) => failure.code === 'rejected' && /transfer_id_not_found|unknown payout/.test(failure.reason);

/** Cashfree's word on this attempt's transfer: it, none, or unknown (trouble asking). */
async function look(payouts: UpiPayoutAdapter, claimed: Claimed): Promise<Look> {
  const answer = await payouts.getPayout({ payoutId: claimed.payoutId ?? transferIdOf(idempotencyKeySchema.parse(claimed.payoutKey)) });
  if (answer.ok) return { found: answer.value };
  return isNone(answer.error) ? 'none' : 'unknown';
}

/** Sends a new transfer, where none can exist yet. Refused before sending is failed; any other trouble is later. */
async function send(payouts: UpiPayoutAdapter, claimed: Claimed, isConfigured: boolean): Promise<Said | null> {
  if (!claimed.accountOk) return failed('The payout account is no longer verified and in use');
  if (!claimed.mayPay) return null;
  if (!isConfigured) return failed('Cashfree payouts are not set up');
  const to = upiVpaSchema.safeParse(claimed.vpa);
  if (!to.success) return failed('The payout account has no UPI address');
  // Checked again now: the kill switch or the account may have changed since the claim.
  if ((await rpc('begin_withdrawal_payout', { p_request_id: claimed.id, p_payout_key: claimed.payoutKey })) !== true) return null;
  const answer = await payouts.pay({
    idempotencyKey: idempotencyKeySchema.parse(claimed.payoutKey), to: to.data, payeeName: claimed.holderName,
    amount: paiseSchema.parse(claimed.amountPaise), note: 'RIVR withdrawal',
  });
  if (answer.ok) return said(answer.value);
  return answer.error.code === 'rejected' ? failed(answer.error.reason) : null;
}

/** Cashfree has no transfer for this attempt: a paying one is sent now; a sent one stays paid, and the owner hears. */
async function noneFound(payouts: UpiPayoutAdapter, claimed: Claimed, isConfigured: boolean): Promise<Said | null> {
  if (claimed.status !== 'sent') return send(payouts, claimed, isConfigured);
  await rpc('note_withdrawal_payout_trouble', { p_request_id: claimed.id });
  return null;
}

/** What to record for a claimed payout, or null to ask again later. */
async function decide(payouts: UpiPayoutAdapter, claimed: Claimed, isConfigured: boolean): Promise<Said | null> {
  const mayExist = claimed.status === 'sent' || claimed.attempted || claimed.payoutId !== null;
  if (!mayExist) return send(payouts, claimed, isConfigured);
  // A transfer may exist: nothing is failed or sent again until Cashfree has been asked.
  if (!isConfigured) return null;
  const found = await look(payouts, claimed);
  if (found === 'unknown') return null;
  if (found === 'none') return noneFound(payouts, claimed, isConfigured);
  // A sent payout is only ever undone, and only when Cashfree says so.
  return claimed.status === 'sent' && found.found.status !== 'failed' ? null : said(found.found);
}

async function follow(live: UpiPayoutAdapter | undefined, claimed: Claimed): Promise<string> {
  const payouts = createAdapters({ isPracticeVenue: claimed.isPractice, live: { upiPayouts: live } }).upiPayouts;
  const answer = await decide(payouts, claimed, claimed.isPractice || live !== undefined);
  if (answer === null) return 'later';
  return String(await rpc('record_withdrawal_payout', {
    p_request_id: claimed.id, p_payout_key: claimed.payoutKey, p_status: answer.status,
    p_payout_id: answer.payoutId ?? claimed.payoutId, p_utr: answer.utr, p_failure: answer.failure,
  }));
}

async function followAll(): Promise<Record<string, number>> {
  const startedAt = Date.now();
  const rows = await rpc('claim_withdrawal_payouts', {});
  const live = cashfree();
  const outcomes: Record<string, number> = {};
  for (const claimed of (Array.isArray(rows) ? rows : []).map(claimedOf)) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) break;
    // One payout's trouble (a freeze holding its posting, say) never stops the others; the owner hears of it.
    const outcome = await follow(live, claimed).catch(async () => {
      await rpc('note_withdrawal_payout_trouble', { p_request_id: claimed.id }).catch(() => null);
      return 'trouble';
    });
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return outcomes;
}

Deno.serve(serveScheduled(followAll));
