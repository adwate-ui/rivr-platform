import { useStaffVenue } from '@rivr/db';
import { useTdsLedger, type TdsLedgerRow } from '@rivr/db/tds';
import type { Paise } from '@rivr/domain/money';
import { formatNumber, t } from '@rivr/i18n';
import { DataTable, Grid, Heading, Inline, Input, Money, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { ReturnExtract } from './ReturnExtract.tsx';
import { recentQuarters } from './tdsCsv.ts';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

const money = (key: string, header: string, paise: (row: TdsLedgerRow) => Paise): DataTableColumn<TdsLedgerRow> => ({
  key, header, align: 'end', sortValue: paise, cell: (row) => <Money paise={paise(row)} />,
});

function columns(): readonly DataTableColumn<TdsLedgerRow>[] {
  return [
    { key: 'member', header: t('console.tds.member'), cell: (row) => row.fullName, sortValue: (row) => row.fullName },
    { key: 'pan', header: t('console.tds.pan'), cell: (row) => (row.panLast4 === null ? t('console.tds.noPan') : t('console.tds.panEnding', { last4: row.panLast4 })) },
    { key: 'payments', header: t('console.tds.payments'), align: 'end', sortValue: (row) => row.payments, cell: (row) => formatNumber(row.payments) },
    money('paid', t('console.tds.paid'), (row) => row.paid),
    money('withheld', t('console.tds.withheld'), (row) => row.withheld),
    money('shadow', t('console.tds.shadow'), (row) => row.shadow),
  ];
}

/** The ledger's rows for the days chosen, or the table's loading or error state. */
function LedgerRows({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const ledger = useTdsLedger(venueId, from, to);
  const base = {
    label: t('console.tds.ledgerLabel'), columns: columns(), rowKey: (row: TdsLedgerRow) => row.memberId,
    exportFilter: t('console.exportFilters.period', { from, to }),
  };
  if (ledger.data === undefined && ledger.isError) return <DataTable {...base} status="error" onRetry={() => void ledger.refetch()} />;
  if (ledger.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={ledger.data} emptyText={t('console.tds.empty')} initialSort={{ key: 'withheld', direction: 'descending' }} />;
}

/** The withholding ledger (#93) for India days, this quarter so far to begin with. */
function Ledger({ venueId, today }: { venueId: string; today: string }) {
  const [period, setPeriod] = useState({ from: recentQuarters(today)[0] ?? today, to: today });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tds.ledger')}</Heading>
      <Inline gap={4} wrap>
        <Input type="date" label={t('console.tds.from')} value={period.from} onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
        <Input type="date" label={t('console.tds.to')} value={period.to} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
      </Inline>
      {period.from === '' || period.to === '' ? null : <LedgerRows venueId={venueId} from={period.from} to={period.to} />}
      <Text variant="small" tone="muted">{t('console.tds.shadowHint')}</Text>
    </Stack>
  );
}

/**
 * TDS (#93; scope-v1 module 5): the withholding ledger by member for any days, for ledger readers, and
 * the quarterly return extract for staff who export tables.
 */
export function TdsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.tds.title');
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('ledger.read')) return <Screen title={title} status="error" errorText={t('console.tds.notAllowed')} />;
  const today = IST_DAY.format(new Date());
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8} stackBelow="medium">
        <Ledger venueId={venueId} today={today} />
        {permissions.includes('exports.table') ? <ReturnExtract venueId={venueId} quarters={recentQuarters(today)} /> : null}
      </Grid>
    </Screen>
  );
}
