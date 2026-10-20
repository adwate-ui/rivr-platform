import { useChipInventory, useStaffVenue, useTreasury, type ChipInventory, type Treasury } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Heading, Inline, Money, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { OpenShiftForm } from './ChipCountForm.tsx';
import { ChipsInCage } from './ChipsInCage.tsx';
import { balanceRows, shiftLine } from './treasuryCopy.ts';

/**
 * Treasury (#24; scope-v1 module 5), as in the prototype: what the venue holds for players, the chips in play and
 * the cage float, from the ledger. Beside it, the cage's shift: a cashier opens it with the float and a count of the
 * chips by denomination, and counts again during it; #45 closes it. Ledger readers see it; only the cage counts.
 */
export function TreasuryScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.treasury.title');
  if (!staff.venue.permissions.includes('ledger.read')) return <Screen title={title} status="error" errorText={t('console.treasury.notAllowed')} />;
  return <TreasuryView title={title} venueId={staff.venue.venueId} canCount={staff.venue.permissions.includes('cage.transact')} />;
}

function TreasuryView({ title, venueId, canCount }: { title: string; venueId: string; canCount: boolean }) {
  const treasury = useTreasury(venueId);
  const chips = useChipInventory(venueId);
  const [notice, setNotice] = useState<string | null>(null);
  if (treasury.isPending || chips.isPending) return <Screen title={title} status="loading" />;
  if (treasury.isError || chips.isError) {
    return <Screen title={title} status="error" onRetry={() => { void treasury.refetch(); void chips.refetch(); }} />;
  }
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        <Balances treasury={treasury.data} />
        <Stack gap={8}>
          {notice === null ? null : <Text tone="money">{notice}</Text>}
          <Shift venueId={venueId} treasury={treasury.data} inventory={chips.data} canCount={canCount} onOpened={() => setNotice(t('console.treasury.opened'))} />
          {treasury.data.shift === null ? null : (
            <ChipsInCage venueId={venueId} inventory={chips.data} canCount={canCount} onCounted={() => setNotice(t('console.treasury.saved'))} />
          )}
        </Stack>
      </Grid>
    </Screen>
  );
}

/** The prototype's list: each figure on its own line, the label to the left and the amount to the right. */
function Balances({ treasury }: { treasury: Treasury }) {
  return (
    <Stack gap={4} divided>
      {balanceRows(treasury).map((row) => (
        <Inline key={row.label} justify="between" gap={4}>
          <Text tone="muted">{row.label}</Text>
          {row.paise === null ? <Text tone="muted">{t('console.treasury.noFloat')}</Text> : <Money paise={row.paise} />}
        </Inline>
      ))}
    </Stack>
  );
}

/** The cage's shift: when it opened and who opened it, or, with none open, the cashier's form to open one. */
function Shift({ venueId, treasury, inventory, canCount, onOpened }: {
  venueId: string;
  treasury: Treasury;
  inventory: ChipInventory;
  canCount: boolean;
  onOpened: () => void;
}) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.treasury.shift')}</Heading>
      {treasury.shift === null ? <Text tone="muted">{t('console.treasury.noShift')}</Text> : <Text>{shiftLine(treasury.shift)}</Text>}
      {treasury.shift === null && canCount ? <OpenShiftForm venueId={venueId} lines={inventory.lines} onOpened={onOpened} /> : null}
    </Stack>
  );
}
