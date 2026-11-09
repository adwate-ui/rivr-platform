// The two push services a phone in the native app is reached through (decision 0361), from the function secrets the owner sets
// (docs/runbooks/ci-and-release.md). A service whose secrets are not set is undefined.
import { createApnsLiveActivity, createFcmOngoing, type LiveStatusAdapter } from '@rivr/adapters';
import { z } from 'zod';

// The player app's bundle id and Android package (apps/player/capacitor.config.ts).
const APP_ID = 'club.rivr.player';
const secret = (name: string): string => Deno.env.get(name) ?? '';

/** Apple's push service, once the push key is set: APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (the .p8). */
export function apple(): LiveStatusAdapter | undefined {
  const [teamId, keyId, privateKey] = [secret('APNS_TEAM_ID'), secret('APNS_KEY_ID'), secret('APNS_PRIVATE_KEY')];
  if (teamId === '' || keyId === '' || privateKey === '') return undefined;
  // Apple's sandbox for a development build until APNS_ENVIRONMENT says production (TestFlight and the App Store).
  const environment = secret('APNS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  return createApnsLiveActivity({ teamId, keyId, privateKey, bundleId: APP_ID, environment });
}

const serviceAccountSchema = z.object({ project_id: z.string().min(1), client_email: z.string().min(1), private_key: z.string().min(1) });

/** Firebase, once FCM_SERVICE_ACCOUNT holds the service account's JSON key. */
export function firebase(): LiveStatusAdapter | undefined {
  let json: unknown = null;
  try {
    json = JSON.parse(secret('FCM_SERVICE_ACCOUNT') || 'null');
  } catch {
    return undefined;
  }
  const account = serviceAccountSchema.safeParse(json);
  if (!account.success) return undefined;
  return createFcmOngoing({ projectId: account.data.project_id, clientEmail: account.data.client_email, privateKey: account.data.private_key });
}
