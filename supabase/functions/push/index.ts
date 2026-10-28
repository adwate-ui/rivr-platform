// The push consumer (#139, #338; decision 0272): seat ready, call time done, the session reminder, withdrawal sent,
// tournament starting and promotions, to each phone a member turned notifications on for, when they want that kind.
// pg_cron runs it every minute (decision 0038); a messaging stop holds it, and practice-venue events never reach it. It
// signs with the club's VAPID key: the public one in @rivr/contracts, the private one a function secret the owner sets
// (VAPID_PRIVATE_KEY). Until it is set nothing is claimed, and deliveries wait.
import { createPushConsumer, type FindPushTargets } from '@rivr/adapters/messages';
import { createWebPush } from '@rivr/adapters/web-push';
import { WEB_PUSH_PUBLIC_KEY } from '@rivr/contracts';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
// Where push services contact the sender: the player app's address (https on staging and production).
const subject = Deno.env.get('PLAYER_APP_URL') ?? '';

const targetRows = z.array(z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() }));

/** The member's phones that want this kind of push, through the service role only. */
const findTargets: FindPushTargets = async (venueId, memberId, pushType, promotionId) =>
  targetRows
    .parse(await rpc('push_targets', { p_venue_id: venueId, p_member_id: memberId, p_push_type: pushType, p_promotion_id: promotionId ?? null }))
    .map((row) => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }));

async function forget(endpoint: string): Promise<void> {
  await rpc('forget_push_subscription', { p_endpoint: endpoint });
}

Deno.serve(
  privateKey && subject.startsWith('https://')
    ? serveConsumer(createPushConsumer({ push: createWebPush({ publicKey: WEB_PUSH_PUBLIC_KEY, privateKey, subject }), findTargets, forget }))
    : () => Response.json({ error: 'Web push is not configured' }, { status: 503 }),
);
