import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { PanVerification } from './types.ts';

/** What re-checking a KYC check made in person found (#259): a match, or how the vendor's answer differed. */
export type PanRecheckOutcome = 'matched' | 'pan_invalid' | 'name_differs' | 'date_of_birth_differs';

/**
 * The vendor's PAN answer as a re-check's outcome, or null when the vendor gave none (an outage, a refused or
 * unconfigured call): never sent to review for the vendor's own trouble. `panRecheckFailure` says what to do then.
 */
export function panRecheckOutcome(answer: Result<PanVerification, AdapterFailure>): PanRecheckOutcome | null {
  if (!answer.ok) return null;
  if (!answer.value.isValid) return 'pan_invalid';
  if (!answer.value.nameMatches) return 'name_differs';
  return answer.value.dateOfBirthMatches ? 'matched' : 'date_of_birth_differs';
}

/**
 * What a re-check does when its PAN call failed (decision 0674): ask again `later` (an outage, even one after a paid
 * call), `pause` every re-check (the vendor refused RIVR's account, which every check would get), or count it `refused`
 * (the vendor turned down this check's request; the third ends its re-check).
 */
export type PanRecheckFailure = 'later' | 'pause' | 'refused';

export function panRecheckFailure(failure: AdapterFailure): PanRecheckFailure {
  if (failure.code !== 'rejected') return 'later';
  if (failure.cause === 'account') return 'pause';
  return failure.cause === undefined ? 'refused' : 'later';
}

/** One check's refusal, held until a run ends. */
export interface HeldRefusal {
  readonly reason: string;
  readonly memberId: string;
}

/**
 * A run's refusals, held until it ends (#1033): one reason that turns down three different checks is the vendor's own
 * trouble (a reply RIVR cannot read, a code new to it) more than theirs, so the run pauses every re-check instead and none
 * of that reason's refusals is counted. A reason released after it tripped (it paused the re-checks last time) has the
 * checks that tripped it counted, as their own, so those behind them are asked; it stays armed, and three more turned down
 * alike in the run trip it again, which then pauses outright. The rest are counted when the run ends (decision 0674).
 */
export function createRefusalBreaker(limit = 3) {
  const held = new Map<string, string[]>();
  const released = new Set<string>();
  const counted: HeldRefusal[] = [];
  return {
    /** Holds one check's refusal; true once its reason has turned down `limit` different checks since it was last released. */
    hold(reason: string, memberId: string): boolean {
      const checks = held.get(reason) ?? [];
      if (!checks.includes(memberId)) checks.push(memberId);
      held.set(reason, checks);
      return checks.length >= limit;
    },
    /** Counts the checks that tripped a reason, which did not pause the re-checks, and re-arms it for the run. */
    release(reason: string): void {
      counted.push(...(held.get(reason) ?? []).map((memberId) => ({ reason, memberId })));
      held.set(reason, []);
      released.add(reason);
    },
    /** Whether a reason tripped and was released earlier in the run: tripping again, it pauses outright. */
    isReleased(reason: string): boolean {
      return released.has(reason);
    },
    /** The refusals to count: those released, and those whose reason turned down fewer than `limit` checks. */
    toCount(): readonly HeldRefusal[] {
      const stillHeld = [...held]
        .filter(([, checks]) => checks.length < limit)
        .flatMap(([reason, checks]) => checks.map((memberId) => ({ reason, memberId })));
      return [...counted, ...stillHeld];
    },
  };
}
