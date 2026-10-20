import type { ChipCountLine, ChipInventory } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DataTable, Heading, Inline, Money, Number as Count, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { CountChipsForm } from './ChipCountForm.tsx';
import { countedLine } from './treasuryCopy.ts';

/** Each chip, how many were counted, and what they come to. */
function columns(): DataTableColumn<ChipCountLine>[] {
  return [
    { key: 'chip', header: t('console.treasury.chip'), cell: (line) => line.name },
    {
      key: 'quantity', header: t('console.treasury.quantity'), align: 'end',
      cell: (line) => (line.quantity === null ? t('console.treasury.notCounted') : <Count value={line.quantity} />),
    },
    {
      key: 'value', header: t('console.treasury.value'), align: 'end',
      cell: (line) => (line.total === null ? t('console.treasury.notCounted') : <Money paise={line.total} />),
    },
  ];
}

/**
 * The chips in the cage (#24): the open shift's latest count by denomination, what it comes to, and when and by whom it
 * was counted; a cashier counts again from it.
 */
export function ChipsInCage({ venueId, inventory, canCount, onCounted }: {
  venueId: string;
  inventory: ChipInventory;
  canCount: boolean;
  onCounted: () => void;
}) {
  const [isCounting, setCounting] = useState(false);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.treasury.chips')}</Heading>
      <Text variant="small" tone="muted">{countedLine(inventory)}</Text>
      {isCounting ? (
        <CountChipsForm venueId={venueId} lines={inventory.lines} onDone={(saved) => { setCounting(false); if (saved) onCounted(); }} />
      ) : (
        <DataTable label={t('console.treasury.chips')} columns={columns()} rows={inventory.lines} rowKey={(line) => line.name}
          emptyText={t('console.treasury.notCounted')} />
      )}
      <Inline justify="between" gap={4}>
        <Text weight="medium">{t('console.treasury.inCage')}</Text>
        {inventory.inCage === null ? <Text tone="muted">{t('console.treasury.notCounted')}</Text> : <Money paise={inventory.inCage} />}
      </Inline>
      {canCount && !isCounting ? (
        <Inline>
          <Button variant="secondary" onClick={() => setCounting(true)}>{t('console.treasury.countChips')}</Button>
        </Inline>
      ) : null}
    </Stack>
  );
}
