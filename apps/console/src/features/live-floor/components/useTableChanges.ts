import { useSeatActions, type FloorTable } from '@rivr/db';
import { t } from '@rivr/i18n';
import { useChangeToast } from './useChangeToast.ts';

/**
 * The floor managers' changes to a table (floor.manage): open or close it for tonight, and the main table it feeds as a
 * must-move table. Each is undone by the same function with what was there before (decision 0447).
 */
export function useTableChanges(venueId: string) {
  const say = useChangeToast();
  const { setOpen, setMustMove } = useSeatActions(venueId);
  return {
    setOpen: async (table: FloorTable, isOpen: boolean) =>
      say(await setOpen.mutateAsync({ tableId: table.id, isOpen }),
        t(isOpen ? 'console.floor.toast.tableOpened' : 'console.floor.toast.tableClosed', { table: table.name }),
        () => setOpen.mutateAsync({ tableId: table.id, isOpen: !isOpen })),
    setMustMove: async (table: FloorTable, main: FloorTable | null) => {
      const before = table.mustMoveToTableId;
      const text = main === null
        ? t('console.floor.toast.mustMoveCleared', { table: table.name })
        : t('console.floor.toast.mustMove', { table: table.name, main: main.name });
      say(await setMustMove.mutateAsync({ tableId: table.id, mainTableId: main?.id ?? null }), text,
        () => setMustMove.mutateAsync({ tableId: table.id, mainTableId: before }));
    },
    isBusy: setOpen.isPending || setMustMove.isPending,
  };
}

export type TableChanges = ReturnType<typeof useTableChanges>;
