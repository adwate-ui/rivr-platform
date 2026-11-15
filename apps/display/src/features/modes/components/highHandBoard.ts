import type { TvHighHand, TvHighHandPayout } from '@rivr/db';
import { formatHighHand, formatHighHandRules, formatListedHand, formatNumber, formatTime, t } from '@rivr/i18n';
import type { TvHighHandBoardProps } from '@rivr/ui';

// A payout's row stays lit for five minutes.
const NEW_FOR_MS = 5 * 60_000;

/** A first name and initial, or "Member #17" for a member who hid their name on the TVs, as the hours leaderboard has them. */
function nameOf(payout: TvHighHandPayout): string {
  if (payout.name !== null) return payout.name;
  return payout.memberNumber === null ? t('tv.hiddenName') : t('tv.leaderboard.member', { number: String(payout.memberNumber) });
}

/**
 * The High hand bonus board's body from what the TV read (redesign RD-25), for HighHandMode: each hand with its Bonus, the rules on a line,
 * and tonight's payouts, the newest lit while it is under five minutes old at `now`.
 */
export function toHighHandBoard(board: TvHighHand, now: Date): TvHighHandBoardProps {
  return {
    handsTitle: t('tv.highHand.hands'), payoutsTitle: t('tv.highHand.paidTonight'), emptyText: t('tv.highHand.noneYet'),
    hands: board.reward.hands.map((listed) => ({ id: listed.hand, name: formatListedHand(listed.hand), bonus: formatNumber(listed.chips) })),
    rules: formatHighHandRules(board.reward.rules).join(' · '),
    payouts: board.payouts.map((payout, index) => ({
      id: payout.id, name: nameOf(payout), bonus: formatNumber(payout.chips),
      detail: t('tv.highHand.payout', { hand: formatHighHand(payout.hand, payout.rank), table: payout.table, time: formatTime(new Date(payout.at)) }),
      isNew: index === 0 && now.getTime() - new Date(payout.at).getTime() < NEW_FOR_MS,
    })),
  };
}
