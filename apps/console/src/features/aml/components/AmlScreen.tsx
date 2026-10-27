import { useStaffVenue } from '@rivr/db';
import { useAmlRegister, type SarEntry } from '@rivr/db/aml';
import { t } from '@rivr/i18n';
import { Button, DataTable, Money, Screen, Stack, Text, Time, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { SarEntryPanel } from './SarEntryPanel.tsx';

function statusOf(entry: SarEntry): string {
  return entry.outcome === null ? t('console.aml.toReview') : t(`console.aml.outcomes.${entry.outcome}`);
}

function columns(onOpen: (entryId: string) => void): readonly DataTableColumn<SarEntry>[] {
  return [
    {
      key: 'member', header: t('console.aml.member'), sortValue: (row) => row.fullName,
      cell: (row) => (
        <Button variant="text" aria-label={t('console.aml.open', { name: row.fullName })} onClick={() => onOpen(row.id)}>
          {t('console.aml.memberLine', { name: row.fullName, number: String(row.memberNumber) })}
        </Button>
      ),
    },
    { key: 'pattern', header: t('console.aml.pattern'), cell: (row) => t(`console.aml.kinds.${row.kind}`), sortValue: (row) => row.kind },
    { key: 'found', header: t('console.aml.found'), cell: (row) => <Time at={new Date(row.detectedAt)} show="day" />, sortValue: (row) => Date.parse(row.detectedAt) },
    { key: 'cash', header: t('console.aml.cash'), align: 'end', cell: (row) => <Money paise={row.cash} />, sortValue: (row) => Number(row.cash) },
    { key: 'status', header: t('console.aml.status'), cell: (row) => statusOf(row), sortValue: (row) => (row.isOpen ? 0 : 1) },
  ];
}

function AmlRegister({ venueId }: { venueId: string }) {
  const register = useAmlRegister(venueId);
  const [openId, setOpenId] = useState<string | null>(null);
  const state = register.isPending ? { status: 'loading' as const }
    : register.isError ? { status: 'error' as const, onRetry: () => void register.refetch() }
    : { rows: register.data, emptyText: t('console.aml.empty') };
  const chosen = register.data?.find((entry) => entry.id === openId) ?? null;
  return (
    <Stack gap={6}>
      <Text>{t('console.aml.intro')}</Text>
      <DataTable label={t('console.aml.tableLabel')} columns={columns(setOpenId)} rowKey={(row) => row.id} {...state} />
      {chosen === null ? null : <SarEntryPanel venueId={venueId} entry={chosen} />}
    </Stack>
  );
}

/**
 * The AML register (#105; scope-v1 module 12; decision 0234), for staff who review AML: each pattern found in a
 * member's cash buy-ins, open ones first; opened, its buy-ins and the review.
 */
export function AmlScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.aml.title');
  if (!staff.venue.permissions.includes('aml.review')) return <Screen title={title} status="error" errorText={t('console.aml.notAllowed')} />;
  return (
    <Screen title={title}>
      <AmlRegister venueId={staff.venue.venueId} />
    </Screen>
  );
}
