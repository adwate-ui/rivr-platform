/**
 * Why a vendor call failed in a way the caller handles. `unavailable` and `rate_limited` are worth
 * retrying later; `rejected` is not (the vendor refused this request); `not_configured` means the
 * venue has no credentials for the vendor yet. `reason` never carries personal data.
 */
export type AdapterFailure =
  | { readonly code: 'unavailable' }
  | { readonly code: 'rate_limited' }
  | { readonly code: 'rejected'; readonly reason: string }
  | { readonly code: 'not_configured' };

/** Why a printer did not print: a vendor failure, or paper to change. */
export type PrinterFailure = AdapterFailure | { readonly code: 'out_of_paper' };
