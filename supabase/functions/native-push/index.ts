// The pushes for phones in the native app (#805, decision 0576): Call time ending and the others, as ordinary alerts through Apple
// and Firebase, to the phones the live status knows. A consumer of its own beside web push, so a retry here never sends a web push
// again. pg_cron runs it every minute (decision 0038); a messaging stop holds it, and practice-venue events never reach it. Until
// Apple's push key or the Firebase service account is set, nothing is claimed and deliveries wait.
import { createLiveStatus } from '@rivr/adapters';
import { createNativePushConsumer, type FindNativePushTargets } from '@rivr/adapters/messages';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';
import { apple, firebase } from '../_shared/phones.ts';

const targetRows = z.array(z.object({ device_id: z.uuid(), platform: z.enum(['ios', 'android']), token: z.string() }));

/** The member's phones in the native app that want this kind of push, through the service role only. */
const findTargets: FindNativePushTargets = async (venueId, memberId, pushType, promotionId) =>
  targetRows
    .parse(await rpc('native_push_targets', { p_venue_id: venueId, p_member_id: memberId, p_push_type: pushType, p_promotion_id: promotionId ?? null }))
    .map((row) => ({ deviceId: row.device_id, platform: row.platform, token: row.token }));

const ios = apple();
const android = firebase();

Deno.serve(
  ios === undefined && android === undefined
    ? () => Response.json({ error: 'Native push is not configured' }, { status: 503 })
    : serveConsumer(createNativePushConsumer({
      alerts: createLiveStatus({ ...(ios ? { ios } : {}), ...(android ? { android } : {}) }),
      findTargets,
      forget: async (deviceId) => { await rpc('forget_native_alert', { p_device_id: deviceId }); },
    })),
);
