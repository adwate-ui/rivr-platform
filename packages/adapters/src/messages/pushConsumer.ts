import {
  callTimeCompletedSchema, err, ok, promotionOfferedSchema, sessionReminderSchema, tournamentStartingSchema, waitlistCalledSchema,
  withdrawalSentSchema, type Result,
} from '@rivr/contracts';
import { formatMoney, formatTime, push as pushCopy, registerMessages, t } from '@rivr/i18n';
import type { ClaimedDelivery, Consumer } from '../outbox/index.ts';
import type { PushAdapter, WebPushSubscription } from '../push/types.ts';
import type { AdapterFailure } from '../shared/failure.ts';

// The push copy, as each app registers its own at start.
registerMessages({ push: pushCopy });

/** The events the push consumer sends a notification for (#139, #338). */
export const PUSH_EVENT_TYPES = [
  'waitlist.called', 'call_time.completed', 'session.reminder', 'withdrawal.sent', 'tournament.starting', 'promotion.offered',
] as const;

/**
 * The phones a member of the venue gets a push of this kind on: none when they do not want it (their tier lacks it, they
 * turned it off, or for a promotion they gave no marketing consent). A session reminder (kind null) is the member's own
 * setting, so it goes to every phone they turned notifications on for. A promotion offer names its promotion, which goes
 * only as WhatsApp offers it: while it runs, to a tier with the promotions feed, with marketing sends on.
 */
export type FindPushTargets = (venueId: string, memberId: string, pushType: string | null, promotionId?: string) => Promise<readonly WebPushSubscription[]>;

/** Forgets a phone whose browser dropped its subscription. */
export type ForgetPushTarget = (endpoint: string) => Promise<void>;

/** One notification for one member, before it goes to each of their phones. */
interface MemberPush {
  readonly memberId: string;
  readonly pushType: string | null;
  /** For a promotion offer, its promotion. */
  readonly promotionId?: string;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}

/** The notification, null when there is nothing to send, or why the event cannot be read. */
type Built = Result<MemberPush | null, AdapterFailure>;

const unreadable = (eventType: string): Built => err({ code: 'rejected', reason: `${eventType} payload is not readable` });

function seatReady(payload: unknown, now: Date): Built {
  const called = waitlistCalledSchema.safeParse(payload);
  if (!called.success) return unreadable('waitlist.called');
  // A call claimed after its hold ran out would send the member to a seat that is gone: nothing to send.
  if (new Date(called.data.hold_until) <= now) return ok(null);
  const { member_id: memberId, table_name: table, seat, hold_until: holdUntil } = called.data;
  const body = t('push.seatReady.body', { table, seat: String(seat), time: formatTime(new Date(holdUntil)) });
  return ok({ memberId, pushType: 'push.seat_ready', title: t('push.seatReady.title'), body, url: '/', tag: 'seat-ready' });
}

function callTimeDone(payload: unknown): Built {
  const done = callTimeCompletedSchema.safeParse(payload);
  if (!done.success) return unreadable('call_time.completed');
  const { member_id: memberId, session_id: sessionId } = done.data;
  return ok({ memberId, pushType: 'push.call_time_complete', title: t('push.callTimeDone.title'), body: t('push.callTimeDone.body'), url: '/', tag: `call-time-${sessionId}` });
}

function sessionReminder(payload: unknown): Built {
  const due = sessionReminderSchema.safeParse(payload);
  if (!due.success) return unreadable('session.reminder');
  const { member_id: memberId, session_id: sessionId, hours } = due.data;
  const body = t('push.sessionReminder.body', { hours: String(hours) });
  return ok({ memberId, pushType: null, title: t('push.sessionReminder.title'), body, url: '/', tag: `session-reminder-${sessionId}` });
}

function withdrawalSent(payload: unknown): Built {
  const sent = withdrawalSentSchema.safeParse(payload);
  if (!sent.success) return unreadable('withdrawal.sent');
  const { member_id: memberId, withdrawal_request_id: requestId, amount_paise: amount } = sent.data;
  const body = t('push.withdrawalSent.body', { amount: formatMoney(BigInt(amount)) });
  return ok({ memberId, pushType: 'push.withdrawal_sent', title: t('push.withdrawalSent.title'), body, url: '/', tag: `withdrawal-${requestId}` });
}

function tournamentStarting(payload: unknown): Built {
  const starting = tournamentStartingSchema.safeParse(payload);
  if (!starting.success) return unreadable('tournament.starting');
  const { member_id: memberId, tournament_id: tournamentId, name } = starting.data;
  const title = t('push.tournamentStarting.title', { name });
  return ok({ memberId, pushType: 'push.tournament_starting', title, body: t('push.tournamentStarting.body'), url: '/', tag: `tournament-${tournamentId}` });
}

/** A published promotion offered to one member (#86): its title, and what it gives and when it runs. */
function promotionOffered(payload: unknown): Built {
  const offer = promotionOfferedSchema.safeParse(payload);
  if (!offer.success) return unreadable('promotion.offered');
  const { member_id: memberId, promotion_id: promotionId, title, detail, runs } = offer.data;
  const body = [detail, runs].filter((part) => part !== null).join(' · ');
  return ok({ memberId, pushType: 'push.promotion_published', promotionId, title, body, url: '/', tag: `promotion-${promotionId}` });
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long each kind stays worth sending (#593). A push claimed later, after a backfill, is finished unsent. A seat call
 * checks its own hold instead.
 */
const USEFUL_FOR_MS: Readonly<Partial<Record<(typeof PUSH_EVENT_TYPES)[number], number>>> = {
  'call_time.completed': HOUR_MS,
  'session.reminder': HOUR_MS,
  'tournament.starting': HOUR_MS,
  'withdrawal.sent': 24 * HOUR_MS,
  'promotion.offered': 24 * HOUR_MS,
};

function isStale(eventType: (typeof PUSH_EVENT_TYPES)[number], occurredAt: Date | undefined, now: Date): boolean {
  const usefulFor = USEFUL_FOR_MS[eventType];
  if (usefulFor === undefined || occurredAt === undefined) return false;
  return now.getTime() - occurredAt.getTime() > usefulFor;
}

const BUILDERS: Readonly<Record<(typeof PUSH_EVENT_TYPES)[number], (payload: unknown, now: Date) => Built>> = {
  'waitlist.called': seatReady,
  'call_time.completed': callTimeDone,
  'session.reminder': sessionReminder,
  'withdrawal.sent': withdrawalSent,
  'tournament.starting': tournamentStarting,
  'promotion.offered': promotionOffered,
};

function pushFor(delivery: ClaimedDelivery, now: Date): Built {
  const eventType = PUSH_EVENT_TYPES.find((type) => type === delivery.eventType);
  if (eventType === undefined) return err({ code: 'rejected', reason: `no push for ${delivery.eventType}` });
  if (isStale(eventType, delivery.occurredAt, now)) return ok(null);
  return BUILDERS[eventType](delivery.payload, now);
}

/**
 * The push outbox consumer (#139, #338): each event as a notification to every phone the member turned notifications on
 * for, when they want that kind. A messaging consumer, so a messaging stop holds it; practice-venue events never reach
 * it. Each phone is sent to at once. A phone whose browser dropped its subscription is forgotten and the others still get
 * theirs; any other failure tries the delivery again, and a phone that already had it shows it once, as its tag replaces it.
 */
export function createPushConsumer({ push, findTargets, forget, now = () => new Date() }: {
  push: PushAdapter;
  findTargets: FindPushTargets;
  forget: ForgetPushTarget;
  /** For tests; the clock by default. */
  now?: () => Date;
}): Consumer {
  return {
    name: 'push',
    eventTypes: PUSH_EVENT_TYPES,
    isMessaging: true,
    async deliver(delivery) {
      const built = pushFor(delivery, now());
      if (!built.ok || built.value === null) return built;
      const { memberId, pushType, promotionId, ...notification } = built.value;
      const phones = await findTargets(delivery.venueId, memberId, pushType, promotionId);
      // Each of the member's phones at once, so a slow push service holds up only its own.
      const sends = await Promise.all(phones.map(async (subscription) => ({ subscription, sent: await push.send({ subscription, ...notification }) })));
      let failure: AdapterFailure | null = null;
      for (const { subscription, sent } of sends) {
        if (sent.ok) continue;
        if (sent.error.code === 'subscription_gone') await forget(subscription.endpoint);
        else failure = sent.error;
      }
      return failure === null ? ok(null) : err(failure);
    },
  };
}
