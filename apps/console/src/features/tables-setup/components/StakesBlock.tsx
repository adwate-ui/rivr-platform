import { useTablesSetupActions, type SetupStake, type SetupTable } from '@rivr/db';
import { fromPaise, paiseToChips } from '@rivr/domain/money';
import { formatDuration, formatNumber, formatStakes, t } from '@rivr/i18n';
import {
  Button, ConfirmQuestion, DataTable, ErrorMessage, Inline, OverflowMenu, Screen, Stack, StatusMessage, type DataTableColumn, type OverflowMenuItem,
} from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { StakeSheet } from './StakeSheet.tsx';

// The panel open: a new stake's, or a stake's own by its id.
const NEW = 'new';

/** What a row's step did, said under the list: done, or why not. */
interface Outcome {
  readonly ok: boolean;
  readonly text: string;
}

/** A stake as its row shows it: with how many tables play it. */
type StakeRow = SetupStake & { readonly tables: number };

/** How many tables play a stake: `1 table`, `4 tables`, or a dash for none. */
function tablesText(count: number): string {
  if (count === 0) return t('console.tablesSetup.none');
  return count === 1 ? t('console.tablesSetup.tablesOne') : t('console.tablesSetup.tablesMany', { count: formatNumber(count) });
}

interface StakeActionsProps {
  venueId: string;
  stake: StakeRow;
  onChange: () => void;
  onOutcome: (outcome: Outcome) => void;
}

/**
 * A stake's row: Change, which opens it in the panel, and behind its menu Delete, asked first. A stake a table plays is
 * not deleted: Delete is dimmed and says so; the database refuses again on its own count, a deleted table's history too.
 */
function StakeActions({ venueId, stake, onChange, onOutcome }: StakeActionsProps) {
  const { removeStake } = useTablesSetupActions(venueId);
  const [isAsking, setIsAsking] = useState(false);
  const name = stake.name;
  const remove = async () => {
    setIsAsking(false);
    const done = await removeStake.mutateAsync(stake.id);
    if (done.ok) return onOutcome({ ok: true, text: t('console.tablesSetup.stakeDeleted', { name }) });
    // Said under the list, not beside the row: a stake still in use is named.
    return onOutcome({ ok: false, text: done.error === 'stake_in_use' ? t('console.tablesSetup.stakeInUse', { name }) : t(`console.tablesSetup.failures.${done.error}`) });
  };
  const isUsed = stake.tables > 0;
  const items: readonly OverflowMenuItem[] = [{
    id: 'delete', tone: 'danger', isDisabled: isUsed || removeStake.isPending, onSelect: () => setIsAsking(true),
    label: isUsed ? t('console.tablesSetup.stepInPlay', { step: t('console.tablesSetup.delete'), why: t('console.tablesSetup.inUse') }) : t('console.tablesSetup.delete'),
  }];
  return (
    <Stack gap={2}>
      <Inline gap={2} justify="end" align="center">
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.changeStake', { name })} onClick={onChange}>{t('console.tablesSetup.change')}</Button>
        <OverflowMenu label={t('console.tablesSetup.more', { name })} items={items} />
      </Inline>
      {isAsking ? (
        <ConfirmQuestion question={t('console.tablesSetup.deleteStakeQuestion', { name })} confirm={t('console.tablesSetup.deleteConfirm', { name })}
          isBusy={removeStake.isPending} onCancel={() => setIsAsking(false)} onConfirm={() => void remove()} />
      ) : null}
    </Stack>
  );
}

/** The stakes' columns: name, blinds with any straddle, the straddle, call time and tables, then the row's steps. */
function stakeColumns(actions: (stake: StakeRow) => ReactNode): readonly DataTableColumn<StakeRow>[] {
  const typed = (paise: bigint) => String(paiseToChips(fromPaise(paise)));
  return [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (stake) => stake.name, sortValue: (stake) => stake.name, priority: 'primary', filter: 'text' },
    // A stake with a straddle is written with it: 100/200/500 (owner, 15 Nov).
    { key: 'blinds', header: t('console.tablesSetup.blinds'), cell: (stake) => formatStakes(stake.smallBlind, stake.bigBlind, stake.straddle), sortValue: (stake) => Number(stake.bigBlind), align: 'end' },
    { key: 'straddle', header: t('console.tablesSetup.straddle'), align: 'end', filter: 'choice', cell: (stake) => (stake.straddle === null ? t('console.tablesSetup.none') : typed(stake.straddle)) },
    {
      key: 'callTime', header: t('console.tablesSetup.callTime'), align: 'end', sortValue: (stake) => stake.callTimeMinutes,
      cell: (stake) => (stake.callTimeMinutes > 0 ? formatDuration(stake.callTimeMinutes * 60) : t('console.tablesSetup.none')), filter: false,
    },
    { key: 'tables', header: t('console.tablesSetup.tablesColumn'), align: 'end', sortValue: (stake) => stake.tables, cell: (stake) => tablesText(stake.tables), filter: false },
    { key: 'actions', header: '', align: 'end', isWide: true, cell: actions },
  ];
}

interface StakesBlockProps {
  venueId: string;
  stakes: readonly SetupStake[];
  tables: readonly SetupTable[];
}

/**
 * The stakes (redesign RD-17): each with its blinds, call time and how many tables play it, Change on the row and Delete
 * behind its menu. New stake and Change open the panel at the side; with no stakes yet the new one is open.
 */
export function StakesBlock({ venueId, stakes, tables }: StakesBlockProps) {
  const [open, setOpen] = useState<string | null>(stakes.length === 0 ? NEW : null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  const rows = stakes.map((stake) => ({ ...stake, tables: tables.filter((table) => table.stakeId === stake.id).length }));
  const show = (next: string) => { setOutcome(null); setOpen(next); };
  const columns = stakeColumns((stake) => <StakeActions venueId={venueId} stake={stake} onChange={() => show(stake.id)} onOutcome={setOutcome} />);
  return (
    <Screen level={2} title={t('console.tablesSetup.stakes')} onActionsSlot={setExportIn}
      actions={<Button variant="subtle" size="compact" onClick={() => show(NEW)}>{t('console.tablesSetup.newStake')}</Button>}>
      <DataTable exportIn={exportIn} label={t('console.tablesSetup.stakesLabel')} columns={columns} rows={rows} rowKey={(stake) => stake.id}
        emptyText={t('console.tablesSetup.stakesEmpty')} />
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      {open === null ? null : (
        <StakeSheet key={open} venueId={venueId} stake={rows.find((stake) => stake.id === open) ?? null} onClose={() => setOpen(null)} />
      )}
    </Screen>
  );
}
