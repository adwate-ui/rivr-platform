import { err, ok, waitlistMovedSchema, type Result } from '@rivr/contracts';
import { formatOrdinal, formatTime, push as pushCopy, registerMessages, t } from '@rivr/i18n';
import { z } from 'zod';
import type { LiveStatus, LiveStatusAdapter, LiveStatusDevice } from '../live-status/types.ts';
import type { ClaimedDelivery, Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';

// The push copy, as each app registers its own at start: the lock screen's words are push.liveStatus.
registerMessages({ push: pushCopy });

/**
 * The events that change what a lock screen shows (decision 0323): a list that moved (decision 0360), a seat call, a
 * member sitting, moving, stepping away and back, leaving, and their call time growing, nearing its end or met.
 */
export const LIVE_STATUS_EVENT_TYPES = [
  'waitlist.moved', 'waitlist.called', 'seat.taken', 'seat.moved', 'seat.away', 'seat.back', 'seat.left', 'call_time.updated', 'call_time.ending',
  'call_time.completed',
] as const;

/** What a member's phone should show now, as the database reads it when the status goes (live_status_targets). */
export interface LiveStatusFacts {
  /** Nothing shows when null: no place and no seat, or not wanted (the member's switches, their tier). */
  readonly state: 'waiting' | 'seat_ready' | 'seated' | null;
  /** The member's place on the list, which "I'm on my way" answers. */
  readonly entryId: string | null;
  /** The table asked for (waiting), called to (seat ready) or sat at. */
  readonly tableName: string | null;
  readonly seat: number | null;
  /** The game, `NLH 50/100`. */
  readonly game: string | null;
  /** The place on the list; null while the floor has not approved the join. */
  readonly place: number | null;
  /** The countdown's start and end (the hold, or the call time); no end while seated means the call time is not running. */
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  /** Whether the member may order food and drink to the seat. */
  readonly canOrder: boolean;
}

/** One phone an event's status goes to, what it shows now and what it should show. */
export interface LiveStatusTarget {
  readonly deviceId: string;
  readonly device: LiveStatusDevice;
  /** What the phone shows, as last sent; null when nothing. */
  readonly shown: string | null;
  readonly facts: LiveStatusFacts;
}

/** The member's phones, and with a list (`tableTypeId`), the phones of everyone waiting on it, never the practice venue's. */
export type FindLiveStatusTargets = (venueId: string, memberId: string, tableTypeId: string | null) => Promise<readonly LiveStatusTarget[]>;

/** Keeps what a phone now shows (null: nothing, which ends an iPhone's Live Activity). */
export type NoteLiveStatusShown = (deviceId: string, shown: string | null) => Promise<void>;

/** Forgets a phone whose token the push service no longer knows. */
export type ForgetLiveStatusDevice = (deviceId: string) => Promise<void>;

const memberEventSchema = z.object({ member_id: z.uuid() });

/** Whose phones an event reaches: the member's, and everyone's on the list when it moved. */
function subjectOf({ eventType, payload }: ClaimedDelivery): Result<{ memberId: string; tableTypeId: string | null }, AdapterFailure> {
  if (!LIVE_STATUS_EVENT_TYPES.some((type) => type === eventType)) return err({ code: 'rejected', reason: `no live status for ${eventType}` });
  const unreadable = err({ code: 'rejected', reason: `${eventType} payload is not readable` } as const);
  if (eventType === 'waitlist.moved') {
    const moved = waitlistMovedSchema.safeParse(payload);
    return moved.success ? ok({ memberId: moved.data.member_id, tableTypeId: moved.data.table_type_id }) : unreadable;
  }
  const event = memberEventSchema.safeParse(payload);
  return event.success ? ok({ memberId: event.data.member_id, tableTypeId: null }) : unreadable;
}

const countdownOf = (facts: LiveStatusFacts) =>
  facts.startsAt === null || facts.endsAt === null ? null : { startsAt: new Date(facts.startsAt), endsAt: new Date(facts.endsAt) };

/** A place, as Tonight says it: Next in line, 2nd in line, or Requested until the floor approves the join. */
function waiting(facts: LiveStatusFacts): LiveStatus {
  const line = facts.place === null ? t('push.liveStatus.requested')
    : facts.place === 1 ? t('push.liveStatus.next') : t('push.liveStatus.place', { ordinal: formatOrdinal(facts.place) });
  const label = facts.tableName === null ? t('push.liveStatus.waitlistAny') : t('push.liveStatus.waitlist', { table: facts.tableName });
  return { kind: 'waiting', meta: facts.game ?? '', label, value: line, countdown: null, action: null, alert: null };
}

/** The seat call: the hold counting down, "I'm on my way", and the Seat ready push's words to sound with. */
function seatReady(facts: LiveStatusFacts): LiveStatus | null {
  const countdown = countdownOf(facts);
  if (countdown === null) return null;
  const body = t('push.seatReady.body', { table: facts.tableName ?? '', seat: String(facts.seat ?? ''), time: formatTime(countdown.endsAt) });
  return {
    kind: 'seat_ready',
    meta: facts.game ?? '',
    label: t('push.liveStatus.heldFor'),
    value: null,
    countdown,
    action: facts.entryId === null ? null : { title: t('push.liveStatus.onMyWay'), url: `/?accept=${facts.entryId}` },
    alert: { title: t('push.seatReady.title'), body },
  };
}

/** Seated: the call time counting down while it runs (nothing shows while it does not), and Order to the seat. */
function seated(facts: LiveStatusFacts): LiveStatus | null {
  const countdown = countdownOf(facts);
  if (countdown === null) return null;
  return {
    kind: 'seated',
    meta: t('push.liveStatus.seat', { table: facts.tableName ?? '', seat: String(facts.seat ?? '') }),
    label: t('push.liveStatus.callTimeLeft'),
    value: null,
    countdown,
    action: facts.canOrder ? { title: t('push.liveStatus.order'), url: '/fnb' } : null,
    alert: null,
  };
}

/** What the phone should show, from the facts; null for nothing. */
function liveStatusOf(facts: LiveStatusFacts): LiveStatus | null {
  if (facts.state === 'waiting') return waiting(facts);
  if (facts.state === 'seat_ready') return seatReady(facts);
  return facts.state === 'seated' ? seated(facts) : null;
}

type Deps = { liveStatus: LiveStatusAdapter; noteShown: NoteLiveStatusShown; forget: ForgetLiveStatusDevice };

/** Shows one phone its status when it changed: the failure to try again for, or null. */
async function refresh(target: LiveStatusTarget, { liveStatus, noteShown, forget }: Deps): Promise<AdapterFailure | null> {
  const status = liveStatusOf(target.facts);
  const shown = status === null ? null : JSON.stringify(status);
  if (shown === target.shown) return null;
  const sent = await liveStatus.show({ device: target.device, status });
  if (sent.ok) {
    await noteShown(target.deviceId, shown);
    return null;
  }
  if (sent.error.code === 'device_gone') await forget(target.deviceId);
  if (sent.error.code === 'activity_gone') await noteShown(target.deviceId, null);
  if (sent.error.code === 'device_gone' || sent.error.code === 'not_configured') return null;
  // The Live Activity the member swiped away starts again on the next try.
  return sent.error.code === 'activity_gone' ? { code: 'unavailable' } : sent.error;
}

/**
 * The live-status outbox consumer (decision 0323): each event refreshes the lock screens of the phones it reaches, with
 * what the database says each should show at that moment, so a late or repeated event never shows anything old. A phone
 * hears only a change. A messaging consumer, so a messaging stop holds it; practice-venue events never reach it, and the
 * database gives no practice venue's phone. A kind of phone whose credentials are not set is skipped.
 */
export function createLiveStatusConsumer({ liveStatus, findTargets, noteShown, forget }: Deps & { findTargets: FindLiveStatusTargets }): Consumer {
  return {
    name: 'live_status',
    eventTypes: LIVE_STATUS_EVENT_TYPES,
    isMessaging: true,
    async deliver(delivery) {
      const subject = subjectOf(delivery);
      if (!subject.ok) return subject;
      const targets = await findTargets(delivery.venueId, subject.value.memberId, subject.value.tableTypeId);
      // Each phone at once, so a slow push service holds up only its own.
      const failures = (await Promise.all(targets.map((target) => refresh(target, { liveStatus, noteShown, forget }))))
        .filter((found) => found !== null);
      // One phone worth trying again keeps the delivery alive: another phone's refusal must not end its retries.
      const failure = failures.find((found) => found.code !== 'rejected') ?? failures[0];
      return failure === undefined ? ok(null) : err(failure);
    },
  };
}
