// Re-checks each KYC check made in person with the vendor, once (#259; decision 0271). pg_cron runs it each minute with the
// scheduler's secret. It claims the manual checks not yet re-checked and runs each one's PAN, date of birth and the
// member's registered name through the vendor's PAN check; a difference sends the check back to review, which stops the
// member's play until a reviewer decides. The practice venue gets the fake; a real venue Cashfree from its four secrets,
// or nothing until they are set. A vendor that cannot answer leaves the check to be asked again, hourly at most, until it does.
import { createAdapters, createFakeKyc, panRecheckOutcome, type KycAdapter } from '@rivr/adapters';
import { panSchema } from '@rivr/contracts';
import { rpc, serveScheduled } from '../_shared/outbox.ts';
import { cashfreeKyc } from '../kyc/cashfree.ts';

interface Claimed {
  readonly memberId: string;
  readonly fullName: string;
  readonly pan: string;
  readonly dateOfBirth: string;
  /** Anything but a plain false is the practice venue, so a doubtful row never reaches Cashfree. */
  readonly isPractice: boolean;
}

function claimedOf(row: unknown): Claimed {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  return {
    memberId: String(field('member_id')), fullName: String(field('full_name')), pan: String(field('pan')),
    dateOfBirth: String(field('date_of_birth')), isPractice: field('is_practice') !== false,
  };
}

/** Asks the vendor about one check and records its answer, or leaves the check for the next run. */
async function recheck(live: KycAdapter | undefined, claimed: Claimed): Promise<string> {
  const kyc = claimed.isPractice ? createFakeKyc() : createAdapters({ isPracticeVenue: false, live: { kyc: live } }).kyc;
  const answer = await kyc.verifyPan({ pan: panSchema.parse(claimed.pan), name: claimed.fullName, dateOfBirth: claimed.dateOfBirth });
  const outcome = panRecheckOutcome(answer);
  if (outcome === null) return 'later';
  await rpc('record_kyc_recheck', { p_member_id: claimed.memberId, p_outcome: outcome });
  return outcome;
}

async function recheckAll(): Promise<Record<string, number>> {
  const live = cashfreeKyc();
  // Without Cashfree's keys only the practice venue's checks are claimed, so a real venue's spend no tries.
  const rows = await rpc('claim_kyc_rechecks', { p_with_vendor: live !== undefined });
  const outcomes: Record<string, number> = {};
  for (const claimed of (Array.isArray(rows) ? rows : []).map(claimedOf)) {
    // One check's trouble never stops the others; it is asked again on a later run.
    const outcome = await recheck(live, claimed).catch(() => 'trouble');
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return outcomes;
}

Deno.serve(serveScheduled(recheckAll));
