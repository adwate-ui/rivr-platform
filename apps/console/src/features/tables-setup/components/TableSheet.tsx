import { useTablesSetupActions, type SetupStake, type SetupTable, type TableOrder } from '@rivr/db';
import { chipsToPaise, fromPaise, paiseToChips } from '@rivr/domain/money';
import { isMinBuyIn, stakeTableRefusal, suggestedMinBuyIn } from '@rivr/domain/tables';
import { t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { SaveFooter } from './SaveFooter.tsx';
import { useSave } from './useSave.ts';

// A table seats 2 to 10, as game_table's check has it: the fixed row (owner, 15 Nov).
const SEATS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

// The minimum buy-in is typed in whole rupees.
const rupeesOf = (paise: bigint) => String(paiseToChips(fromPaise(paise)));

/** The table as typed: its name, its stake (none chosen yet for a new one), its seats and its minimum buy-in in rupees. */
interface TableDraft {
  name: string;
  stakeId: string | null;
  seats: string;
  minBuyIn: string;
  /** Whether the admin typed the minimum buy-in: until then choosing a stake fills in its suggestion. */
  hasOwnMinBuyIn: boolean;
}

/** The form's values to start from: the table's own, or a new nine-seat table with no stake chosen. */
function startFrom(table: SetupTable | null): TableDraft {
  if (table === null) return { name: '', stakeId: null, seats: '9', minBuyIn: '', hasOwnMinBuyIn: false };
  return { name: table.name, stakeId: table.stakeId, seats: String(table.seats), minBuyIn: rupeesOf(table.minBuyIn), hasOwnMinBuyIn: false };
}

/** The minimum buy-in typed, in paise, when it is a whole ₹50 above zero (@rivr/domain isMinBuyIn); else null. */
function minBuyInOf(typed: string): bigint | null {
  if (!/^\d{1,9}$/.test(typed)) return null;
  const amount = chipsToPaise(BigInt(typed));
  return isMinBuyIn(amount) ? amount : null;
}

/**
 * The table as it would be saved, or why it cannot be yet: something is missing, or it is given a stake that has no call
 * time (@rivr/domain stakeTableRefusal; the stake it already has is not given again).
 */
function orderFrom(draft: TableDraft, stakes: readonly SetupStake[], table: SetupTable | null): TableOrder | { readonly refusal: string } {
  const stake = stakes.find((one) => one.id === draft.stakeId);
  const minBuyIn = minBuyInOf(draft.minBuyIn);
  if (draft.name.trim() === '' || stake === undefined || minBuyIn === null) return { refusal: t('console.tablesSetup.tableIncomplete') };
  const refusal = stake.id === table?.stakeId ? null : stakeTableRefusal(stake.callTimeMinutes);
  if (refusal !== null) return { refusal: t(`console.tablesSetup.failures.${refusal}`) };
  return { tableId: table?.id ?? null, name: draft.name, stakeId: stake.id, seats: Number(draft.seats), minBuyIn };
}

/**
 * The minimum buy-in a stake just chosen fills in: the table's own figure on the stake the table has, else 50 big blinds
 * of the stake (@rivr/domain suggestedMinBuyIn); nothing for no stake.
 */
function filledFor(stakeId: string | null, stakes: readonly SetupStake[], table: SetupTable | null): { minBuyIn?: string } {
  if (table !== null && stakeId === table.stakeId) return { minBuyIn: rupeesOf(table.minBuyIn) };
  const stake = stakes.find((one) => one.id === stakeId);
  return stake === undefined ? {} : { minBuyIn: rupeesOf(suggestedMinBuyIn(fromPaise(stake.bigBlind))) };
}

interface TableSheetProps {
  venueId: string;
  stakes: readonly SetupStake[];
  /** The table to change, or null for a new one. */
  table: SetupTable | null;
  onClose: () => void;
}

/**
 * A table made or changed in the panel at the side (redesign RD-17): its name, its seats from the fixed row of 2 to 10,
 * its stake, and its own minimum buy-in, filled in at 50 big blinds of the stake chosen (@rivr/domain suggestedMinBuyIn)
 * until the admin types another, always a whole ₹50. A stake with no call time is refused before it is sent. Saved, it
 * says so in a toast and closes; refused, it says why until a field is edited. The caller keys it by each opening.
 */
export function TableSheet({ venueId, stakes, table, onClose }: TableSheetProps) {
  const { saveTable } = useTablesSetupActions(venueId);
  const toast = useToast();
  const [draft, setDraft] = useState(() => startFrom(table));
  const { failure, save, clearFailure } = useSave(async () => {
    const order = orderFrom(draft, stakes, table);
    if ('refusal' in order) return order.refusal;
    const done = await saveTable.mutateAsync(order);
    if (!done.ok) return t(`console.tablesSetup.failures.${done.error}`);
    toast(t(table === null ? 'console.tablesSetup.tableAdded' : 'console.tablesSetup.saved', { name: draft.name.trim() }));
    onClose();
    return null;
  });
  const set = (change: Partial<TableDraft>) => {
    clearFailure();
    setDraft({ ...draft, ...change });
  };
  const chooseStake = (stakeId: string | null) => set({ stakeId, ...(draft.hasOwnMinBuyIn || stakeId === draft.stakeId ? {} : filledFor(stakeId, stakes, table)) });
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={<SaveFooter isSaving={saveTable.isPending} onCancel={onClose} onSave={() => void save()} />}
      title={table === null ? t('console.tablesSetup.newTable') : t('console.tablesSetup.changeTable', { name: table.name })}>
      <Stack gap={5}>
        <Input label={t('console.tablesSetup.tableName')} value={draft.name} maxLength={40} onChange={(event) => set({ name: event.target.value })} />
        <ChoiceChips label={t('console.tablesSetup.seats')} mode="one" look="subtle" selected={[draft.seats]} options={SEATS.map((count) => ({ value: count, label: count }))}
          onChange={(picked) => set({ seats: picked[0] ?? draft.seats })} />
        <ChoiceChips label={t('console.tablesSetup.stake')} mode="one" look="subtle" selected={draft.stakeId === null ? [] : [draft.stakeId]}
          options={stakes.map((stake) => ({ value: stake.id, label: stake.name }))} onChange={(picked) => chooseStake(picked[0] ?? null)} />
        <Input label={t('console.tablesSetup.minBuyIn')} prefix={t('console.tablesSetup.rupee')} hint={t('console.tablesSetup.minBuyInRule')} value={draft.minBuyIn} inputMode="numeric" maxLength={9}
          onChange={(event) => set({ minBuyIn: event.target.value.trim(), hasOwnMinBuyIn: true })} />
        {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
