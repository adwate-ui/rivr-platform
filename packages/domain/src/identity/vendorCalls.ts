/**
 * Whether a paid KYC vendor call that failed is given back, so it does not use up one of the member's five a day (#791; the
 * owner, 9 Nov): yes when it failed on the vendor's side, no when the vendor answered with a refusal.
 */
export const isVendorCallGivenBack = (failureCode: string): boolean => failureCode !== 'rejected';
