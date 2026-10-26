import { useTournamentFloorActions, type BalancePrompt, type TournamentSeatRow } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Inline, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

/** Where a player is: their seat, waiting, the place they went out in, or refunded. */
function whereOf(row: TournamentSeatRow): string {
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
  onChange: OnChange;
}

/** A bust or a refund, asked twice in the same place: the first press turns the button to its confirmation. */
function Confirmed({ label, name, confirm, onConfirm }: { label: string; name: string; confirm: string; onConfirm: () => void }) {
  const [isAsking, setAsking] = useState(false);
  if (!isAsking) return <Button variant="text" aria-label={name} onClick={() => setAsking(true)}>{label}</Button>;
  return <Button variant="danger" onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</Button>;
}

/** A seated player busts or moves as a prompt asks; an alternate is refunded. */
function RowActions({ row, prompts, canRun, onChange }: ActionsProps) {
  const target = prompts.find((prompt) => prompt.from === row.table)?.to;
  if (row.status === 'alternate') {
    return <Confirmed label={t('console.tournaments.refund')} name={t('console.tournaments.refundName', { name: row.fullName })}
      confirm={t('console.tournaments.confirmRefund')} onConfirm={() => onChange({ change: 'refund', entryId: row.entryId })} />;
  }
  if (row.status !== 'seated' || !canRun) return null;
  return (
    <Inline gap={2} justify="end">
      {target === undefined ? null : (
        <Button variant="text" aria-label={t('console.tournaments.moveName', { name: row.fullName, table: target })}
          onClick={() => onChange({ change: 'move', entryId: row.entryId, table: target })}>{t('console.tournaments.moveTo', { table: target })}</Button>
      )}
      <Confirmed label={t('console.tournaments.bust')} name={t('console.tournaments.bustName', { name: row.fullName })}
        confirm={t('console.tournaments.confirmBust')} onConfirm={() => onChange({ change: 'bust', entryId: row.entryId })} />
    </Inline>
  );
}

interface PlayersTableProps {
  rows: readonly TournamentSeatRow[];
  prompts: readonly BalancePrompt[];
  canRun: boolean;
  onChange: OnChange;
}

/** The tournament's players (#120): seated by table and seat, alternates, then those out by place. */
export function PlayersTable({ rows, prompts, canRun, onChange }: PlayersTableProps) {
  const columns: DataTableColumn<TournamentSeatRow>[] = [
    { key: 'player', header: t('console.tournaments.player'),
      cell: (row) => (row.entryNumber > 1 ? t('console.tournaments.playerEntry', { name: row.fullName, number: row.entryNumber }) : row.fullName) },
    { key: 'where', header: t('console.tournaments.where'), cell: whereOf },
    { key: 'chips', header: t('console.tournaments.chipsColumn'), align: 'end', cell: (row) => formatNumber(row.chips) },
    { key: 'actions', header: t('console.tournaments.actions'), align: 'end',
      cell: (row) => <RowActions row={row} prompts={prompts} canRun={canRun} onChange={onChange} /> },
  ];
  return <DataTable label={t('console.tournaments.floor')} columns={columns} rowKey={(row) => row.entryId} rows={rows}
    emptyText={t('console.tournaments.noPlayers')} />;
}
