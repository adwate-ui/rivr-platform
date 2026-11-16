/**
 * Why a vendor call failed in a way the caller handles. `unavailable` and `rate_limited` are worth
 * retrying later; `rejected` is not (the vendor refused this request); `not_configured` means the
 * venue has no credentials for the vendor yet. `reason` never carries personal data.
 *
 * A refusal's `cause`, when it has one, says the refusal was not about the request: `account` (the
 * vendor refused RIVR's keys, a product or a low wallet, so every request would get the same), or an
 * outage after a paid call, kept a refusal so the paid call is not given back (`unavailable`,
 * `rate_limited`). A PAN re-check reads it to ask again or pause instead of counting (decision 0674).
 */
export type AdapterFailure =
  | { readonly code: 'unavailable' }
  | { readonly code: 'rate_limited' }
  | { readonly code: 'rejected'; readonly reason: string; readonly cause?: 'account' | 'unavailable' | 'rate_limited' }
  | { readonly code: 'not_configured' };
