// The KYC vendor for a real venue (#474; decision 0197): Cashfree Secure ID, once all four of its
// settings are function secrets. TEST keys with `sandbox` on staging; production's are the owner's.
import { createCashfreeKyc, type KycAdapter } from '@rivr/adapters';

/** Cashfree, or undefined while any setting is missing, which leaves a real venue's KYC closed. */
export function cashfreeKyc(): KycAdapter | undefined {
  const clientId = Deno.env.get('CASHFREE_CLIENT_ID');
  const clientSecret = Deno.env.get('CASHFREE_CLIENT_SECRET');
  const publicKey = Deno.env.get('CASHFREE_PUBLIC_KEY');
  const environment = Deno.env.get('CASHFREE_ENVIRONMENT');
  if (!clientId || !clientSecret || !publicKey || (environment !== 'sandbox' && environment !== 'production')) return undefined;
  return createCashfreeKyc({ clientId, clientSecret, publicKey, environment });
}
