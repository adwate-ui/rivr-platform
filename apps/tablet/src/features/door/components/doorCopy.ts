import type { DoorScan, DoorScanFailure, DoorScanRefusal } from '@rivr/db';
import { formatDuration, t, type MessageKey } from '@rivr/i18n';
import type { QrScanResult } from '@rivr/ui';

/**
 * Why nothing happened, in words: a member or the venue frozen is said as such, not as a card that could not be read
 * (F4-15). Call time owed says how long, below; anything else, that the card could not be read.
 */
const REFUSALS: Partial<Record<DoorScanFailure, { title: MessageKey; detail: MessageKey }>> = {
  seated: { title: 'tablet.door.notYet', detail: 'tablet.door.seated' },
  card_not_current: { title: 'tablet.door.tryAgain', detail: 'tablet.door.cardNotCurrent' },
  on_break: { title: 'tablet.door.seeFrontDesk', detail: 'tablet.door.onBreak' },
  not_allowed: { title: 'tablet.door.seeFrontDesk', detail: 'tablet.door.notPaired' },
  stopped: { title: 'tablet.door.seeFrontDesk', detail: 'tablet.door.stopped' },
  paused: { title: 'tablet.door.seeFrontDesk', detail: 'tablet.door.paused' },
};

/** What the kiosk says after a scan (decision 0164): welcome, goodbye with the time played, or why nothing happened. */
export function scanResult(outcome: { ok: true; value: DoorScan } | { ok: false; error: DoorScanRefusal }): QrScanResult {
  if (outcome.ok) {
    const scan = outcome.value;
    if (scan.action === 'in') return { title: t('tablet.door.welcome', { name: scan.firstName }), detail: t('tablet.door.welcomeDetail'), isRefused: false };
    const detail = scan.playedSeconds > 0 ? t('tablet.door.goodbyePlayed', { time: formatDuration(scan.playedSeconds) }) : t('tablet.door.goodbyeDetail');
    return { title: t('tablet.door.goodbye', { name: scan.firstName }), detail, isRefused: false };
  }
  const { reason, owedSeconds } = outcome.error;
  if (reason === 'call_time_owed') {
    return { title: t('tablet.door.notYet'), detail: t('tablet.door.callTimeOwed', { time: formatDuration(owedSeconds) }), isRefused: true };
  }
  const copy = REFUSALS[reason] ?? { title: 'tablet.door.seeFrontDesk', detail: 'tablet.door.unavailable' };
  return { title: t(copy.title), detail: t(copy.detail), isRefused: true };
}
