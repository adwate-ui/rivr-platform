import { err, ok, utrSchema, type UpiVpa } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { UpiPayout, UpiPayoutAdapter, UpiPayoutRequest } from './types.ts';

/** A call the fake payout provider received. */
export type UpiPayoutCall =
  | { readonly method: 'pay'; readonly request: UpiPayoutRequest }
  | { readonly method: 'getPayout'; readonly payoutId: string }
  | { readonly method: 'verifyVpa'; readonly vpa: UpiVpa };

/** The fake payout provider, which also lists the distinct payouts it made. */
export type FakeUpiPayouts = UpiPayoutAdapter &
  FakeControls<UpiPayoutCall, AdapterFailure> & {
    /** One entry per idempotency key paid, oldest first. */
    readonly payouts: readonly UpiPayout[];
  };

/** Pays a key the first time; afterwards returns that same payout. */
function payOnce(paidByKey: Map<string, UpiPayout>, request: UpiPayoutRequest): UpiPayout {
  const existing = paidByKey.get(request.idempotencyKey);
  if (existing) return existing;
  const number = paidByKey.size + 1;
  const utr = utrSchema.parse(String(number).padStart(12, '0'));
  const payout: UpiPayout = { payoutId: `fake-payout-${number}`, status: 'sent', utr };
  paidByKey.set(request.idempotencyKey, payout);
  return payout;
}

/** A payout provider that moves no money, pays each idempotency key once and settles at once. */
export function createFakeUpiPayouts(
  options: { readonly accountHolderName?: string; readonly bankName?: string } = {},
): FakeUpiPayouts {
  const recorder = createRecorder<UpiPayoutCall, AdapterFailure>();
  const paidByKey = new Map<string, UpiPayout>();
  return {
    calls: recorder.calls,
    get payouts() {
      return [...paidByKey.values()];
    },
    failNext: (failure) => recorder.failNext(failure),
    async pay(request) {
      const failure = recorder.record({ method: 'pay', request });
      if (failure) return err(failure);
      return request.amount > 0n ? ok(payOnce(paidByKey, request)) : err({ code: 'rejected', reason: 'amount must be positive' });
    },
    async getPayout({ payoutId }) {
      const failure = recorder.record({ method: 'getPayout', payoutId });
      const payout = [...paidByKey.values()].find((made) => made.payoutId === payoutId);
      if (failure) return err(failure);
      return payout ? ok(payout) : err({ code: 'rejected', reason: 'unknown payout' });
    },
    async verifyVpa({ vpa }) {
      const failure = recorder.record({ method: 'verifyVpa', vpa });
      const check = { accountHolderName: options.accountHolderName ?? 'Test Member', bankName: options.bankName ?? 'HDFC Bank' };
      return failure ? err(failure) : ok(check);
    },
  };
}
