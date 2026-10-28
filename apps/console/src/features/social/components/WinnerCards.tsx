import { useWinnerCardsToPost, type SharedWinnerCard } from '@rivr/db/winnerCards';
import { formatDayTime, formatMoney, t } from '@rivr/i18n';
import { Button, DataTable, Heading, Stack, type DataTableColumn } from '@rivr/ui';

/** What the card celebrates: the tournament's name, a high hand or the jackpot. */
function wonOf(card: SharedWinnerCard): string {
  if (card.kind === 'high_hand') return t('console.social.winnerCards.highHand');
  if (card.kind === 'jackpot') return t('console.social.winnerCards.jackpot');
  return card.eventName ?? '';
}

const COLUMNS: readonly DataTableColumn<SharedWinnerCard>[] = [
  { key: 'player', header: t('console.social.winnerCards.player'), cell: (row) => row.playerName },
  { key: 'won', header: t('console.social.winnerCards.won'), cell: (row) => wonOf(row) },
  { key: 'prize', header: t('console.social.winnerCards.prize'), align: 'end', cell: (row) => formatMoney(row.prizePaise) },
  { key: 'shared', header: t('console.social.winnerCards.shared'), cell: (row) => formatDayTime(new Date(row.sharedAt)) },
  { key: 'download', header: t('console.social.winnerCards.download'), align: 'end', cell: (row) => (
    row.imageUrl === null ? null : <Button variant="text" href={row.imageUrl}>{t('console.social.winnerCards.card', { name: row.playerName })}</Button>
  ) },
];

/** Winner cards their players share (#155), to download and post; one a player stops sharing leaves the list at once. */
export function WinnerCards({ venueId }: { venueId: string }) {
  const cards = useWinnerCardsToPost(venueId);
  const base = { label: t('console.social.winnerCards.table'), columns: COLUMNS, rowKey: (row: SharedWinnerCard) => row.cardId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.social.winnerCards.title')}</Heading>
      {cards.data === undefined && cards.isError ? <DataTable {...base} status="error" onRetry={() => void cards.refetch()} /> : null}
      {cards.data === undefined && !cards.isError ? <DataTable {...base} status="loading" /> : null}
      {cards.data === undefined ? null : <DataTable {...base} rows={cards.data} emptyText={t('console.social.winnerCards.none')} />}
    </Stack>
  );
}
