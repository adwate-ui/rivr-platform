import { useTablesSetupActions, type SetupTable } from '@rivr/db';
import { tableRetireRefusal, type TableRetireRefusal } from '@rivr/domain/tables';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ConfirmButton, Inline } from '@rivr/ui';

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
 * A table's actions (decision 0432): Change; Deactivate, which hides it from everything live and keeps its history, or
 * Reactivate, which brings it back closed; and Delete, asked twice. Deactivating or deleting a table someone sits at or
 * waits for is refused before it is sent, by @rivr/domain's rule, and the database refuses it again on its own count.
 */
export function TableActions({ venueId, table, isOpen, onChange, onOutcome }: TableActionsProps) {
  const { deactivate, reactivate, remove } = useTablesSetupActions(venueId);
  const refusal = tableRetireRefusal({ seated: table.seated, waiting: table.waiting });
  const name = table.name;
  const refuse = (reason: TableRetireRefusal) => onOutcome({ ok: false, text: t(`console.tablesSetup.retireRefusals.${reason}`, { name }) });
  const run = async (action: Action, done: MessageKey) => {
    const result = await action.mutateAsync(table.id);
    if (result.ok) onOutcome({ ok: true, text: t(done, { name }) });
    else if (result.error === 'players_seated' || result.error === 'players_waiting') refuse(result.error);
    else onOutcome({ ok: false, text: t(`console.tablesSetup.failures.${result.error}`) });
  };
  const retire = (action: Action, done: MessageKey) => (refusal === null ? void run(action, done) : refuse(refusal));
  return (
    <Inline gap={2} justify="end" wrap>
      <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.changeTable', { name })} aria-expanded={isOpen} onClick={onChange}>
        {t('console.tablesSetup.change')}
      </Button>
      {table.isActive ? (
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.deactivateName', { name })} isLoading={deactivate.isPending}
          onClick={() => retire(deactivate, 'console.tablesSetup.deactivated')}>
          {t('console.tablesSetup.deactivate')}
        </Button>
      ) : (
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.reactivateName', { name })} isLoading={reactivate.isPending}
          onClick={() => void run(reactivate, 'console.tablesSetup.reactivated')}>
          {t('console.tablesSetup.reactivate')}
        </Button>
      )}
      <DeleteButton name={name} isRefused={refusal !== null} isBusy={remove.isPending} onDelete={() => retire(remove, 'console.tablesSetup.deleted')} />
    </Inline>
  );
}

/** Delete, asked twice; a table in play is refused at once rather than asked twice first. */
function DeleteButton({ name, isRefused, isBusy, onDelete }: { name: string; isRefused: boolean; isBusy: boolean; onDelete: () => void }) {
  if (isRefused) {
    return <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.deleteName', { name })} onClick={onDelete}>{t('console.tablesSetup.delete')}</Button>;
  }
  return (
    <ConfirmButton variant="subtle" size="small" label={t('console.tablesSetup.delete')} name={t('console.tablesSetup.deleteName', { name })}
      confirm={t('console.tablesSetup.deleteConfirm', { name })} isBusy={isBusy} onConfirm={onDelete} />
  );
}
