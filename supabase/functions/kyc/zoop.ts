// The KYC vendor for a real venue (decision 0671): Zoop.one, once all three of its settings are function secrets. The Test
// App's key with `test` on staging; production's are the owner's, with `live`.
import { createZoopKyc } from '@rivr/adapters';
import { namesMatch } from '@rivr/domain/identity';

/** Zoop, or undefined while any setting is missing, which leaves a real venue's KYC closed. */
export function zoopKyc(): ReturnType<typeof createZoopKyc> | undefined {
  const appId = Deno.env.get('ZOOP_APP_ID');
  const apiKey = Deno.env.get('ZOOP_API_KEY');
  const environment = Deno.env.get('ZOOP_ENVIRONMENT');
  if (!appId || !apiKey || (environment !== 'test' && environment !== 'live')) return undefined;
  return createZoopKyc({ appId, apiKey, environment, namesMatch });
}
