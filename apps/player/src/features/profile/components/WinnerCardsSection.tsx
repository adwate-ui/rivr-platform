import { useFeature } from '@rivr/db';
import { useMyWinnerCards, useShareWinnerCard, type MyWinnerCard } from '@rivr/db/winnerCards';
import { formatDate, formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Heading, LoadState, Stack, Switch, Text } from '@rivr/ui';

/** What the card celebrates, with the prize: `Weeknight Turbo: ₹1,20,000`. */
function whatOf(card: MyWinnerCard): string {
  const prize = formatMoney(card.prizePaise);
  if (card.kind === 'high_hand') return t('player.profile.winnerCardHighHand', { prize });
  if (card.kind === 'jackpot') return t('player.profile.winnerCardJackpot', { prize });
  return t('player.profile.winnerCardTournament', { event: card.eventName ?? '', prize });
}

/** One card: what and when, a link to it once drawn, and whether the member shares it. */
function WinnerCardRow({ card }: { card: MyWinnerCard }) {
  const share = useShareWinnerCard();
  const what = whatOf(card);
  const date = formatDate(new Date(card.wonAt));
  return (
    <Stack gap={2}>
      <Text>{what}</Text>
      <Text variant="small" tone="muted">{date}</Text>
      {card.imageUrl === null
        ? <Text variant="small" tone="muted">{t('player.profile.winnerCardDrawing')}</Text>
        : <Button variant="text" href={card.imageUrl}>{t('player.profile.winnerCardSee')}</Button>}
      <Switch
        label={t('player.profile.winnerCardShare', { what, date })}
        isOn={card.isShared}
        isDisabled={share.isPending}
        onChange={(isShared) => share.mutate({ cardId: card.cardId, isShared })}
      />
      {share.data?.ok === false ? <ErrorMessage>{t('player.profile.saveFailed')}</ErrorMessage> : null}
    </Stack>
  );
}

/** Winner cards (#155): each of the member's wins, shared on the club's social only while they say so. Shown once they have one. */
export function WinnerCardsSection() {
  const access = useFeature('social.winner_cards');
  const cards = useMyWinnerCards();
  // Members with no cards see nothing; one whose cards could not be read can try again.
  if (cards.data === undefined && !cards.isError) return null;
  if (cards.data?.length === 0) return null;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.winnerCards')}</Heading>
      {cards.data === undefined ? <LoadState isError onRetry={() => void cards.refetch()} /> : null}
      <FeatureGate access={access}>
        <Text tone="muted">{t('player.profile.winnerCardsHint')}</Text>
        {cards.data?.map((card) => <WinnerCardRow key={card.cardId} card={card} />)}
      </FeatureGate>
    </Stack>
  );
}
