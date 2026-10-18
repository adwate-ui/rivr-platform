import type { IdempotencyKey, Paise, Result, UpiVpa, Utr } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A payout to a member's verified UPI address. */
export interface UpiPayoutRequest {
  readonly idempotencyKey: IdempotencyKey;
  readonly to: UpiVpa;
  readonly payeeName: string;
  readonly amount: Paise;
  /** Shown on the member's bank statement, `RIVR withdrawal`. */
  readonly note: string;
}

/** Where a payout stands. */
export type UpiPayoutStatus = 'pending' | 'sent' | 'failed';

/** A payout as the provider reports it. The UTR arrives once the bank has it. */
export interface UpiPayout {
  readonly payoutId: string;
  readonly status: UpiPayoutStatus;
  readonly utr: Utr | null;
}

/** Who holds the account behind a UPI address. */
export interface UpiVpaCheck {
  readonly accountHolderName: string;
  readonly bankName: string;
}

/** UPI payouts for withdrawals. Until a provider onboards, the cage pays by hand and enters the UTR. */
export interface UpiPayoutAdapter {
  /** Pays `amount`. The same idempotency key never pays twice: a repeat returns the first payout. */
  pay(request: UpiPayoutRequest): Promise<Result<UpiPayout, AdapterFailure>>;
  /** The latest state of a payout, for one that came back pending. */
  getPayout(input: { readonly payoutId: string }): Promise<Result<UpiPayout, AdapterFailure>>;
  /** The account holder behind an address, checked before it is saved as a payout account. */
  verifyVpa(input: { readonly vpa: UpiVpa }): Promise<Result<UpiVpaCheck, AdapterFailure>>;
}
