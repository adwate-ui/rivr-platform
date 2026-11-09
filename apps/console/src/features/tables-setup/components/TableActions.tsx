import { useTablesSetupActions, type SetupTable } from '@rivr/db';
import { tableRetireRefusal } from '@rivr/domain/tables';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ConfirmQuestion, Inline, OverflowMenu, Stack, type OverflowMenuItem } from '@rivr/ui';
import { useState } from 'react';

/** What a table's action did, said under the list: done, or why not. */
export interface TableOutcome {
  readonly ok: boolean;
  readonly text: string;
}

interface TableActionsProps {
  venueId: string;
  table: SetupTable;
  /** Whether the table's own form is open under its row. */
  isOpen: boolean;
  /** Opens or closes the table's own form under its row. */
  onChange: () => void;
  onOutcome: (outcome: TableOutcome) => void;
}

type Action = ReturnType<typeof useTablesSetupActions>['deactivate'];

/**
 * A table's actions (decision 0466): Change on the row; behind its ⋯, Deactivate, which hides it from everything live and
 * keeps its history, or Reactivate, which brings it back closed; and Delete, asked first. While someone sits at the table
 * or waits for it, Deactivate and Delete are dimmed and say why, by @rivr/domain's rule; the database refuses them again
 * on its own count.
 */
export function TableActions({ venueId, table, isOpen, onChange, onOutcome }: TableActionsProps) {
  const { deactivate, reactivate, remove } = useTablesSetupActions(venueId);
  const [isAskingDelete, setIsAskingDelete] = useState(false);
  const refusal = tableRetireRefusal({ seated: table.seated, waiting: table.waiting });
  const name = table.name;
  const run = async (action: Action, done: MessageKey) => {
    const result = await action.mutateAsync(table.id);
    if (result.ok) onOutcome({ ok: true, text: t(done, { name }) });
    else if (result.error === 'players_seated' || result.error === 'players_waiting') onOutcome({ ok: false, text: t(`console.tablesSetup.retireRefusals.${result.error}`, { name }) });
    else onOutcome({ ok: false, text: t(`console.tablesSetup.failures.${result.error}`) });
  };
  const isBusy = deactivate.isPending || reactivate.isPending || remove.isPending;
  const retiring = (id: string, step: string, onSelect: () => void): OverflowMenuItem => ({
    id, tone: 'danger', isDisabled: refusal !== null || isBusy, onSelect,
    label: refusal === null ? step : t('console.tablesSetup.stepInPlay', { step, why: t(`console.tablesSetup.inPlay.${refusal}`) }),
  });
  const items: readonly OverflowMenuItem[] = [
    table.isActive
      ? retiring('deactivate', t('console.tablesSetup.deactivate'), () => void run(deactivate, 'console.tablesSetup.deactivated'))
      : { id: 'reactivate', label: t('console.tablesSetup.reactivate'), isDisabled: isBusy, onSelect: () => void run(reactivate, 'console.tablesSetup.reactivated') },
    retiring('delete', t('console.tablesSetup.delete'), () => setIsAskingDelete(true)),
  ];
  return (
    <Stack gap={2}>
      <Inline gap={2} justify="end" align="center">
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.changeTable', { name })} aria-expanded={isOpen} onClick={onChange}>
          {t('console.tablesSetup.change')}
        </Button>
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
