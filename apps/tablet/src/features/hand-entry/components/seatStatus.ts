import type { TabletPlayer } from '@rivr/db';
import { isCallTimeEnding, minutesLeftToSay } from '@rivr/domain/callTime';
import { t } from '@rivr/i18n';
import type { RingSeatStatus } from '@rivr/ui';

/** What the ring says of a seat without a tap (F-189), one thing at most: leaving first, as the floor needs the seat, then call time ending, then away. */
export function ringStatus(player: TabletPlayer): RingSeatStatus | undefined {
  if (player.isLeaving) return { kind: 'leaving', label: t('tablet.seats.leaving') };
  if (player.callTimeLeft !== null && isCallTimeEnding(player.callTimeLeft)) {
    return { kind: 'ending', label: t('tablet.seats.ending', { minutes: minutesLeftToSay(player.callTimeLeft) }) };
  }
  return player.isAway ? { kind: 'away', label: t('tablet.seats.away') } : undefined;
}
