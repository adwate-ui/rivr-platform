// Re-checks each KYC check made in person with the vendor, once (#259; decision 0271). pg_cron runs it each minute with the
// scheduler's secret. It claims the manual checks not yet re-checked and runs each one's PAN, date of birth and the
// member's registered name through the vendor's PAN check; a difference sends the check back to review, which stops the
// member's play until a reviewer decides. The practice venue gets the fake; a real venue Zoop from its three secrets
// (decision 0671), or nothing until they are set. When the call fails (decision 0674): an outage leaves the check to be
// asked again, hourly at most; Zoop refusing RIVR's account pauses every re-check for six hours, and the owner hears of
// it; Zoop turning down this check's request three times ends its re-check, the check standing. A run holds its refusals
// until it ends: one reason that turns down three different checks pauses the re-checks instead, counted against none (#1033).
import {
  createAdapters, createFakeKyc, createRefusalBreaker, panRecheckFailure, panRecheckOutcome, type AdapterFailure, type KycAdapter,
} from '@rivr/adapters';
import { panSchema } from '@rivr/contracts';
import { rpc, serveScheduled } from '../_shared/outbox.ts';
import { zoopKyc } from '../kyc/zoop.ts';

interface Claimed {
  readonly memberId: string;
  readonly fullName: string;
  readonly pan: string;
  readonly dateOfBirth: string;
  /** Anything but a plain false is the practice venue, so a doubtful row never reaches Zoop. */
  readonly isPractice: boolean;
}

function claimedOf(row: unknown): Claimed {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  return {
    memberId: String(field('member_id')), fullName: String(field('full_name')), pan: String(field('pan')),
    dateOfBirth: String(field('date_of_birth')), isPractice: field('is_practice') !== false,
  };
}

/** Why Zoop refused, as the check keeps it: its code only, as the kyc function keeps it (kyc/server.ts). */
function reasonOf(failure: AdapterFailure): string {
  return failure.code === 'rejected' && /^Zoop [A-Za-z0-9_ .-]{1,80}$/.test(failure.reason) ? failure.reason : 'Zoop refusal';
}

/** What became of one check: an answer recorded (or 'later'), or a refusal for the run to settle. */
type Rechecked = { readonly outcome: string } | { readonly next: 'pause' | 'refused'; readonly reason: string };

/** Asks the vendor about one check and records its answer, or says what to do without one. */
async function recheck(live: KycAdapter | undefined, claimed: Claimed): Promise<Rechecked> {
  const kyc = claimed.isPractice ? createFakeKyc() : createAdapters({ isPracticeVenue: false, live: { kyc: live } }).kyc;
  const answer = await kyc.verifyPan({ pan: panSchema.parse(claimed.pan), name: claimed.fullName, dateOfBirth: claimed.dateOfBirth });
  if (!answer.ok) {
    const next = panRecheckFailure(answer.error);
    return next === 'later' ? { outcome: 'later' } : { next, reason: reasonOf(answer.error) };
  }
  const outcome = panRecheckOutcome(answer);
  if (outcome === null) return { outcome: 'later' };
  await rpc('record_kyc_recheck', { p_member_id: claimed.memberId, p_outcome: outcome });
  return { outcome };
}

async function recheckAll(): Promise<Record<string, number>> {
  const live = zoopKyc();
  // Without Zoop's keys only the practice venue's checks are claimed, so a real venue's spend no tries.
  const rows = await rpc('claim_kyc_rechecks', { p_with_vendor: live !== undefined });
  const outcomes: Record<string, number> = {};
  const tally = (outcome: string) => { outcomes[outcome] = (outcomes[outcome] ?? 0) + 1; };
  const refusals = createRefusalBreaker();
  for (const claimed of (Array.isArray(rows) ? rows : []).map(claimedOf)) {
    // One check's trouble never stops the others; it is asked again on a later run.
    const rechecked = await recheck(live, claimed).catch((): Rechecked => ({ outcome: 'trouble' }));
    if ('outcome' in rechecked) {
      tally(rechecked.outcome);
      continue;
    }
    const args = { p_member_id: claimed.memberId, p_reason: rechecked.reason };
    if (rechecked.next === 'refused') {
      if (!refusals.hold(rechecked.reason, claimed.memberId)) continue;
      // Three checks turned down alike: the re-checks pause, unless this reason paused them last time, when those three
      // are counted as their own and the run goes on to the checks behind them. Three more turned down alike in the same
      // run are no one check's doing: then the re-checks pause outright.
      const isPaused = refusals.isReleased(rechecked.reason)
        ? await rpc('pause_kyc_rechecks', args).then(() => true, () => null)
        : await rpc('trip_kyc_recheck_breaker', args).then((paused) => paused === true, () => null);
      if (isPaused === false) {
        refusals.release(rechecked.reason);
        continue;
      }
      tally(isPaused === true ? 'paused' : 'trouble');
      break;
    }
    // Zoop refused RIVR's account: every other check would get the same, so none is asked until the pause ends.
    tally(await rpc('pause_kyc_rechecks', args).then(() => 'paused', () => 'trouble'));
    break;
  }
  for (const { reason, memberId } of refusals.toCount()) {
    tally(await rpc('record_kyc_recheck_refused', { p_member_id: memberId, p_reason: reason }).then(String, () => 'trouble'));
  }
  return outcomes;
}

Deno.serve(serveScheduled(recheckAll));
