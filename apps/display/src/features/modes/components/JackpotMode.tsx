import { useTvJackpot, type TvJackpot } from '@rivr/db';
import { formatMoney, formatTime, t } from '@rivr/i18n';
import { Text, TvJackpotBoard } from '@rivr/ui';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

/** Tonight's high hand as the TV names it: "Four of a kind, Queens"; and where, when and what it paid. */
function highHandText(highHand: NonNullable<TvJackpot['highHand']>): { title: string; line: string } {
  const rank = RANKS.find((known) => known === highHand.rank);
  const name = t(`tv.highHand.${highHand.category}`);
  return {
    title: rank === undefined ? name : t('tv.jackpot.handWithRank', { hand: name, rank: t(`tv.ranks.${rank}`) }),
    line: t('tv.jackpot.highHandLine', { table: highHand.tableName, time: formatTime(new Date(highHand.playedAt)), amount: formatMoney(highHand.payout) }),
  };
}

/** The jackpot (#65): the bad-beat figure large in the display face, tonight's high hand beneath, live. */
export function JackpotMode({ venueId }: { venueId: string }) {
  const jackpot = useTvJackpot(venueId);
  if (jackpot.data === undefined || jackpot.data === null) {
    return <Text variant="tvBody" tone="muted">{t(jackpot.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  const { main, highHand } = jackpot.data;
  return (
    <TvJackpotBoard label={t('tv.badBeatJackpot.title')} amount={main} highHandLabel={t('tv.jackpot.highHandTonight')}
      highHand={highHand === null ? null : highHandText(highHand)} noHighHandText={t('tv.jackpot.noHighHand')} />
  );
}
