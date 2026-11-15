import { useSeatActions, useTablesSetupActions, type SeatFailure, type SetupTable } from '@rivr/db';
import { tableRetireRefusal } from '@rivr/domain/tables';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ConfirmQuestion, Inline, OverflowMenu, Stack, type OverflowMenuItem } from '@rivr/ui';
import { useState } from 'react';

/** What a table's step did, said under the list: done, or why not. */
export interface TableOutcome {
  readonly ok: boolean;
  readonly text: string;
}

interface TableActionsProps {
  venueId: string;
  table: SetupTable;
  /** Opens the table in the panel at the side. */
  onChange: () => void;
  onOutcome: (outcome: TableOutcome) => void;
}

type Action = ReturnType<typeof useTablesSetupActions>['deactivate'];

/** Why a table did not open or close: players still at it, the role, a freeze, or it was not sent. */
function openFailureText(failure: SeatFailure, name: string): string {
  if (failure === 'table_in_use') return t('console.tablesSetup.retireRefusals.players_seated', { name });
  if (failure === 'not_allowed' || failure === 'paused') return t(`console.tablesSetup.failures.${failure}`);
  return t('console.tablesSetup.failures.unavailable');
}

/** Opens a closed table or closes an open one for tonight, and says what that did. */
function useOpenOrClose({ venueId, table, onOutcome }: Pick<TableActionsProps, 'venueId' | 'table' | 'onOutcome'>) {
  const { setOpen } = useSeatActions(venueId);
  const name = table.name;
  const openOrClose = async () => {
    const result = await setOpen.mutateAsync({ tableId: table.id, isOpen: !table.isOpen });
    if (result.ok) onOutcome({ ok: true, text: t(table.isOpen ? 'console.tablesSetup.closedNow' : 'console.tablesSetup.opened', { name }) });
    else onOutcome({ ok: false, text: openFailureText(result.error, name) });
  };
  return { openOrClose, isPending: setOpen.isPending };
}

/**
 * A table's row (redesign RD-17; decision 0466): Change, which opens it in the panel; behind its menu, Open or Close for
 * tonight; Deactivate, which hides it from everything live and keeps its history, or Reactivate, which brings it back
 * closed; and Delete, asked first. While someone sits at the table or waits for it, Deactivate and Delete are dimmed and
 * say why, by @rivr/domain's rule; the database refuses them again on its own count.
 */
export function TableActions({ venueId, table, onChange, onOutcome }: TableActionsProps) {
  const { deactivate, reactivate, remove } = useTablesSetupActions(venueId);
  const tonight = useOpenOrClose({ venueId, table, onOutcome });
  const [isAskingDelete, setIsAskingDelete] = useState(false);
  const refusal = tableRetireRefusal({ seated: table.seated, waiting: table.waiting });
  const name = table.name;
  const run = async (action: Action, done: MessageKey) => {
    const result = await action.mutateAsync(table.id);
    if (result.ok) onOutcome({ ok: true, text: t(done, { name }) });
    else if (result.error === 'players_seated' || result.error === 'players_waiting') onOutcome({ ok: false, text: t(`console.tablesSetup.retireRefusals.${result.error}`, { name }) });
    else onOutcome({ ok: false, text: t(`console.tablesSetup.failures.${result.error}`) });
  };
  const isBusy = deactivate.isPending || reactivate.isPending || remove.isPending || tonight.isPending;
  const retiring = (id: string, step: string, onSelect: () => void): OverflowMenuItem => ({
    id, tone: 'danger', isDisabled: refusal !== null || isBusy, onSelect,
    label: refusal === null ? step : t('console.tablesSetup.stepInPlay', { step, why: t(`console.tablesSetup.inPlay.${refusal}`) }),
  });
  const items: readonly OverflowMenuItem[] = [
    // An inactive table is opened by nobody: reactivate it first.
    ...(table.isActive ? [{ id: 'open', label: t(table.isOpen ? 'console.tablesSetup.close' : 'console.tablesSetup.open'), isDisabled: isBusy, onSelect: () => void tonight.openOrClose() }] : []),
    table.isActive
      ? retiring('deactivate', t('console.tablesSetup.deactivate'), () => void run(deactivate, 'console.tablesSetup.deactivated'))
      : { id: 'reactivate', label: t('console.tablesSetup.reactivate'), isDisabled: isBusy, onSelect: () => void run(reactivate, 'console.tablesSetup.reactivated') },
    retiring('delete', t('console.tablesSetup.delete'), () => setIsAskingDelete(true)),
  ];
  return (
    <Stack gap={2}>
      <Inline gap={2} justify="end" align="center">
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.changeTable', { name })} onClick={onChange}>{t('console.tablesSetup.change')}</Button>
        <OverflowMenu label={t('console.tablesSetup.more', { name })} items={items} />
      </Inline>
      {isAskingDelete ? (
        <ConfirmQuestion question={t('console.tablesSetup.deleteQuestion', { name })} confirm={t('console.tablesSetup.deleteConfirm', { name })}
          isBusy={remove.isPending} onCancel={() => setIsAskingDelete(false)}
          onConfirm={() => { setIsAskingDelete(false); void run(remove, 'console.tablesSetup.deleted'); }} />
      ) : null}
    </Stack>
  );
}
