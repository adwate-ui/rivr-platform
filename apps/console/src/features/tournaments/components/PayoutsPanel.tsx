import type { VenueTournament } from '@rivr/db';
import type { Paise } from '@rivr/domain/money';
import { payoutTable, prizePool } from '@rivr/domain/tournament';
import { formatMoney, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { BagForm } from './BagForm.tsx';
import { FinishForm } from './FinishForm.tsx';
import { PayoutResults } from './PayoutResults.tsx';
import { SatelliteTickets } from './SatelliteTickets.tsx';
import { SharesForm } from './SharesForm.tsx';

/** The prizes as things stand, first place first: the shares of the pool, the guarantee's overlay in it; none until the shares are set or anyone has entered. */
function prizesNow(tournament: VenueTournament): Paise[] {
  if (tournament.payoutShares === null || tournament.field.entries === 0) return [];
  return payoutTable(prizePool(tournament.field.pool, tournament.guarantee).pool, tournament.payoutShares, tournament.field.entries);
}

/** The prize pool, with any overlay the guarantee needs, and the bounty on each head. */
function PoolLines({ tournament }: { tournament: VenueTournament }) {
  const { pool, overlay } = prizePool(tournament.field.pool, tournament.guarantee);
  return (
    <Stack gap={1}>
      <Text>{overlay > 0n ? t('console.tournaments.payouts.prizePoolOverlay', { pool: formatMoney(pool), overlay: formatMoney(overlay) })
        : t('console.tournaments.payouts.prizePool', { pool: formatMoney(pool) })}</Text>
      {tournament.bounty === null ? null
        : <Text tone="muted">{t(`console.tournaments.payouts.bountyLine.${tournament.bounty.kind}`, { amount: formatMoney(tournament.bounty.amount) })}</Text>}
    </Stack>
  );
}

interface PrizeRow {
  readonly place: number;
  readonly prize: Paise;
}

/** The prizes' columns, in the console's language. */
const prizeColumns = (): DataTableColumn<PrizeRow>[] => [
  { key: 'place', header: t('console.tournaments.payouts.place'), cell: (row) => String(row.place) },
  { key: 'prize', header: t('console.tournaments.payouts.prize'), align: 'end', cell: (row) => formatMoney(row.prize) },
];

interface PayoutsPanelProps {
  venueId: string;
  tournament: VenueTournament;
  /** The venue's tournaments, among them a flight's Day 2. */
  others: readonly VenueTournament[];
  canRun: boolean;
}

/**
 * A tournament's payouts (#117, #121; decisions 0205, 0206): the prize pool and the prizes as things stand,
 * the places' shares and the finish for staff who run tournaments, and what was paid.
 */
function PrizePayouts({ venueId, tournament, canRun }: { venueId: string; tournament: VenueTournament; canRun: boolean }) {
  const prizes = prizesNow(tournament);
  const isOpen = tournament.finishedAt === null;
  return (
    <Stack gap={6}>
      <Heading level={2} variant="section">
        {tournament.payoutShares === null ? t('console.tournaments.payouts.title') : t('console.tournaments.payouts.titleTop', { count: tournament.payoutShares.length })}
      </Heading>
      <PoolLines tournament={tournament} />
      {isOpen ? <DataTable label={t('console.tournaments.payouts.prizesLabel')} columns={prizeColumns()} rowKey={(row) => String(row.place)}
        rows={prizes.map((prize, index) => ({ place: index + 1, prize }))} emptyText={t('console.tournaments.payouts.noShares')} /> : null}
      {isOpen && canRun ? <SharesForm venueId={venueId} tournament={tournament} /> : null}
      {isOpen && canRun ? <FinishForm venueId={venueId} tournament={tournament} prizes={prizes} /> : null}
      <PayoutResults tournament={tournament} />
    </Stack>
  );
}

/** A tournament's payouts; a Day 1 flight's bag instead, and a finished satellite's tickets too (#519, #524). */
export function PayoutsPanel({ venueId, tournament, others, canRun }: PayoutsPanelProps) {
  const isOpen = tournament.finishedAt === null;
  if (tournament.dayTwoId !== null) {
    // A Day 1 flight pays nothing itself: its players left are bagged and go through to Day 2 (#524).
    return isOpen && canRun ? <BagForm venueId={venueId} flight={tournament} dayTwo={others.find((each) => each.id === tournament.dayTwoId)} /> : null;
  }
  return (
    <Stack gap={6}>
      <PrizePayouts venueId={venueId} tournament={tournament} canRun={canRun} />
      {tournament.satelliteTargetId !== null && !isOpen ? <SatelliteTickets tournamentId={tournament.id} /> : null}
    </Stack>
  );
}
