// The lock-screen live status consumer (decision 0323): a list that moved, a seat call, a seat taken, moved, stepped away
// from or left, and call time added or ending each refresh the lock screens of the member's phones in the native app,
// and with a list, of everyone waiting on it (decision 0360): an iPhone's Live Activity through Apple, an Android phone's
// ongoing notification through Firebase. pg_cron runs it every minute (decision 0038); a messaging stop holds it, and
// practice-venue events never reach it. Apple's push key and the Firebase service account are function secrets the owner
// sets (docs/runbooks/ci-and-release.md); until one is, nothing is claimed and deliveries wait.
import { createApnsLiveActivity, createFcmOngoing, createLiveStatus, type LiveStatusAdapter } from '@rivr/adapters';
import { createLiveStatusConsumer, type FindLiveStatusTargets } from '@rivr/adapters/messages';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

// The player app's bundle id and Android package (apps/player/capacitor.config.ts).
const APP_ID = 'club.rivr.player';
const secret = (name: string): string => Deno.env.get(name) ?? '';

/** An iPhone's Live Activity, once the Apple push key is set: APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (the .p8). */
function apple(): LiveStatusAdapter | undefined {
  const [teamId, keyId, privateKey] = [secret('APNS_TEAM_ID'), secret('APNS_KEY_ID'), secret('APNS_PRIVATE_KEY')];
  if (teamId === '' || keyId === '' || privateKey === '') return undefined;
  // Apple's sandbox for a development build until APNS_ENVIRONMENT says production (TestFlight and the App Store).
  const environment = secret('APNS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  return createApnsLiveActivity({ teamId, keyId, privateKey, bundleId: APP_ID, environment });
}

const serviceAccountSchema = z.object({ project_id: z.string().min(1), client_email: z.string().min(1), private_key: z.string().min(1) });

/** An Android phone's notification, once FCM_SERVICE_ACCOUNT holds the Firebase service account's JSON key. */
function firebase(): LiveStatusAdapter | undefined {
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

const targetRows = z.array(z.object({
  device_id: z.uuid(),
  platform: z.enum(['ios', 'android']),
  push_token: z.string(),
  activity_push_token: z.string().nullable(),
  shown: z.string().nullable(),
  state: z.enum(['waiting', 'seat_ready', 'seated']).nullable(),
  entry_id: z.uuid().nullable(),
  table_name: z.string().nullable(),
  seat: z.int().nullable(),
  game: z.string().nullable(),
  place: z.int().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  can_order: z.boolean().nullable(),
}));

/** The phones an event reaches, each with what it should show now, through the service role only. */
const findTargets: FindLiveStatusTargets = async (venueId, memberId, tableTypeId) =>
  targetRows.parse(await rpc('live_status_targets', { p_venue_id: venueId, p_member_id: memberId, p_table_type_id: tableTypeId })).map((row) => ({
    deviceId: row.device_id,
    device: { platform: row.platform, token: row.push_token, activityToken: row.activity_push_token },
    shown: row.shown,
    facts: {
      state: row.state, entryId: row.entry_id, tableName: row.table_name, seat: row.seat, game: row.game, place: row.place,
      startsAt: row.starts_at, endsAt: row.ends_at, canOrder: row.can_order ?? false,
    },
  }));

const ios = apple();
const android = firebase();

Deno.serve(
  ios === undefined && android === undefined
    ? () => Response.json({ error: 'The live status is not configured' }, { status: 503 })
    : serveConsumer(createLiveStatusConsumer({
      liveStatus: createLiveStatus({ ...(ios ? { ios } : {}), ...(android ? { android } : {}) }),
      findTargets,
      noteShown: async (deviceId, shown) => { await rpc('note_live_status_shown', { p_device_id: deviceId, p_shown: shown }); },
      forget: async (deviceId) => { await rpc('forget_live_status_device', { p_device_id: deviceId }); },
    })),
);
