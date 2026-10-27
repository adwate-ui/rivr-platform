// The bank's name for each new UPI payout address (#503; decision 0241). pg_cron runs it each minute with the
// scheduler's secret. It claims the addresses waiting for their name and asks the payouts provider whose each is
// (Cashfree's VPA check); the cage then sees that name beside the member's KYC name. The practice venue gets the fake,
// which answers with the member's own name; a real venue Cashfree from its four secrets, or nothing until they are set.
// A trouble asking leaves the address to be asked again (five tries).
import { createAdapters, createCashfreePayouts, createFakeUpiPayouts, type UpiPayoutAdapter } from '@rivr/adapters';
import { upiVpaSchema } from '@rivr/contracts';
import { rpc, serveScheduled } from '../_shared/outbox.ts';

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
  readonly accountId: string;
  readonly vpa: string;
  readonly fullName: string;
  /** Anything but a plain false is the practice venue, so a doubtful row never reaches Cashfree. */
  readonly isPractice: boolean;
}

function claimedOf(row: unknown): Claimed {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  return { accountId: String(field('account_id')), vpa: String(field('vpa')), fullName: String(field('full_name')), isPractice: field('is_practice') !== false };
}

/** Asks for one address's holder; records found, no name or not found, or leaves it for the next run. */
async function check(live: UpiPayoutAdapter | undefined, claimed: Claimed): Promise<string> {
  const vpa = upiVpaSchema.safeParse(claimed.vpa);
  if (!vpa.success) {
    await rpc('record_payout_name_check', { p_account_id: claimed.accountId, p_outcome: 'not_found' });
    return 'not_found';
  }
  const payouts = claimed.isPractice
    ? createFakeUpiPayouts({ accountHolderName: claimed.fullName })
    : createAdapters({ isPracticeVenue: false, live: { upiPayouts: live } }).upiPayouts;
  const answer = await payouts.verifyVpa({ vpa: vpa.data });
  if (answer.ok && answer.value.accountHolderName.trim() === '') {
    await rpc('record_payout_name_check', { p_account_id: claimed.accountId, p_outcome: 'no_name' });
    return 'no_name';
  }
  if (answer.ok) {
    await rpc('record_payout_name_check', { p_account_id: claimed.accountId, p_outcome: 'found', p_holder_name: answer.value.accountHolderName });
    return 'found';
  }
  if (answer.error.code === 'rejected') {
    await rpc('record_payout_name_check', { p_account_id: claimed.accountId, p_outcome: 'not_found' });
    return 'not_found';
  }
  return 'later';
}

async function checkAll(): Promise<Record<string, number>> {
  const live = cashfree();
  // Without Cashfree's keys only the practice venue's addresses are claimed, so a real venue's spend no tries.
  const rows = await rpc('claim_payout_name_checks', { p_with_provider: live !== undefined });
  const outcomes: Record<string, number> = {};
  for (const claimed of (Array.isArray(rows) ? rows : []).map(claimedOf)) {
    // One address's trouble never stops the others; it is asked again on a later run.
    const outcome = await check(live, claimed).catch(() => 'trouble');
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return outcomes;
}

Deno.serve(serveScheduled(checkAll));
