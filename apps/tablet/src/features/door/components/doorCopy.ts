import type { DoorScan, DoorScanRefusal } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import type { QrScanResult } from '@rivr/ui';

/** What the kiosk says after a scan (decision 0164): welcome, goodbye with the time played, or why nothing happened. */
export function scanResult(outcome: { ok: true; value: DoorScan } | { ok: false; error: DoorScanRefusal }): QrScanResult {
  if (outcome.ok) {
    const scan = outcome.value;
    if (scan.action === 'in') return { title: t('tablet.door.welcome', { name: scan.firstName }), detail: t('tablet.door.welcomeDetail'), isRefused: false };
    const detail = scan.playedSeconds > 0 ? t('tablet.door.goodbyePlayed', { time: formatDuration(scan.playedSeconds) }) : t('tablet.door.goodbyeDetail');
    return { title: t('tablet.door.goodbye', { name: scan.firstName }), detail, isRefused: false };
  }
  const { reason, owedSeconds } = outcome.error;
  if (reason === 'seated') return { title: t('tablet.door.notYet'), detail: t('tablet.door.seated'), isRefused: true };
  if (reason === 'call_time_owed') {
    return { title: t('tablet.door.notYet'), detail: t('tablet.door.callTimeOwed', { time: formatDuration(owedSeconds) }), isRefused: true };
  }
  if (reason === 'card_not_current') return { title: t('tablet.door.tryAgain'), detail: t('tablet.door.cardNotCurrent'), isRefused: true };
  if (reason === 'on_break') return { title: t('tablet.door.seeFrontDesk'), detail: t('tablet.door.onBreak'), isRefused: true };
  return { title: t('tablet.door.seeFrontDesk'), detail: t('tablet.door.unavailable'), isRefused: true };
}
