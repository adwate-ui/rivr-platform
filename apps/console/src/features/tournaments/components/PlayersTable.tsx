import { useTournamentFloorActions, type BalancePrompt, type TournamentSeatRow } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Inline, type DataTableColumn } from '@rivr/ui';
import { BustAction } from './BustAction.tsx';
import { ConfirmButton } from './ConfirmButton.tsx';

/** Where a player is: their place once finished, their seat, waiting, the place they went out in, or refunded. */
function whereOf(row: TournamentSeatRow): string {
  if (row.status === 'seated' && row.place !== null) return t('console.tournaments.finishedPlace', { place: row.place });
  if (row.status === 'seated') return t('console.tournaments.seatAt', { table: row.table ?? 0, seat: row.seat ?? 0 });
  if (row.status === 'alternate') return t('console.tournaments.alternate');
  if (row.status === 'busted') return t('console.tournaments.bustedPlace', { place: row.place ?? 0 });
  return t('console.tournaments.refunded');
}

type OnChange = ReturnType<typeof useTournamentFloorActions>['floor']['mutate'];

interface ActionsProps {
  row: TournamentSeatRow;
  prompts: readonly BalancePrompt[];
  canRun: boolean;
  hasBounty: boolean;
  onAskBust: (row: TournamentSeatRow) => void;
  onChange: OnChange;
}

/** A seated player busts or moves as a prompt asks; an alternate is refunded. */
function RowActions({ row, prompts, canRun, hasBounty, onAskBust, onChange }: ActionsProps) {
  const target = prompts.find((prompt) => prompt.from === row.table)?.to;
  if (row.status === 'alternate') {
    return <ConfirmButton label={t('console.tournaments.refund')} name={t('console.tournaments.refundName', { name: row.fullName })}
      confirm={t('console.tournaments.confirmRefund')} onConfirm={() => onChange({ change: 'refund', entryId: row.entryId })} />;
  }
  if (row.status !== 'seated' || !canRun) return null;
  return (
    <Inline gap={2} justify="end">
      {target === undefined ? null : (
        <Button variant="text" aria-label={t('console.tournaments.moveName', { name: row.fullName, table: target })}
          onClick={() => onChange({ change: 'move', entryId: row.entryId, table: target })}>{t('console.tournaments.moveTo', { table: target })}</Button>
      )}
      <BustAction row={row} hasBounty={hasBounty} onAsk={onAskBust} onBust={() => onChange({ change: 'bust', entryId: row.entryId })} />
    </Inline>
  );
}

interface PlayersTableProps {
  rows: readonly TournamentSeatRow[];
  prompts: readonly BalancePrompt[];
  canRun: boolean;
  /** A bounty tournament (#117): a bust asks who knocked them out, through `onAskBust`. */
  hasBounty: boolean;
  onAskBust: (row: TournamentSeatRow) => void;
  onChange: OnChange;
}

/** The tournament's players (#120): seated by table and seat, alternates, then those out by place. */
export function PlayersTable({ rows, prompts, canRun, hasBounty, onAskBust, onChange }: PlayersTableProps) {
  const columns: DataTableColumn<TournamentSeatRow>[] = [
    { key: 'player', header: t('console.tournaments.player'),
      cell: (row) => (row.entryNumber > 1 ? t('console.tournaments.playerEntry', { name: row.fullName, number: row.entryNumber }) : row.fullName) },
    { key: 'where', header: t('console.tournaments.where'), cell: whereOf },
    { key: 'chips', header: t('console.tournaments.chipsColumn'), align: 'end', cell: (row) => formatNumber(row.chips) },
    { key: 'actions', header: t('console.tournaments.actions'), align: 'end',
      cell: (row) => <RowActions row={row} prompts={prompts} canRun={canRun} hasBounty={hasBounty} onAskBust={onAskBust} onChange={onChange} /> },
  ];
  return <DataTable label={t('console.tournaments.floor')} columns={columns} rowKey={(row) => row.entryId} rows={rows}
    emptyText={t('console.tournaments.noPlayers')} />;
}
