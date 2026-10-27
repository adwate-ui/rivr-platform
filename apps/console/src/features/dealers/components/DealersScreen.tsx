import { useDealerNights, useDealerRotation, useStaffVenue, type DealerNight, type RotationDealer } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import { hourShares } from '@rivr/domain/staff';
import { formatDuration, formatMoney, formatNumber, formatRupeesForFile, formatTime, t } from '@rivr/i18n';
import { DataTable, ErrorMessage, Heading, Inline, Input, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useMemo, useState } from 'react';

function boardColumns(): readonly DataTableColumn<RotationDealer>[] {
  return [
    { key: 'dealer', header: t('console.dealers.dealer'), cell: (row) => row.dealerName, sortValue: (row) => row.dealerName },
    { key: 'table', header: t('console.dealers.table'), cell: (row) => row.tableName ?? t('console.dealers.resting'), sortValue: (row) => row.tableName ?? '' },
    { key: 'since', header: t('console.dealers.since'), cell: (row) => formatTime(new Date(row.since)), sortValue: (row) => row.since },
    { key: 'time', header: t('console.dealers.time'), align: 'end', cell: (row) => formatDuration(row.minutes * 60), sortValue: (row) => row.minutes },
    {
      key: 'status', header: t('console.dealers.status'),
      cell: (row) => (row.isDue
        ? <Text as="span" weight="semibold">{t('console.dealers.due')}</Text>
        : t(row.state === 'dealing' ? 'console.dealers.dealing' : 'console.dealers.resting')),
      exportValue: (row) => t(row.isDue ? 'console.dealers.due' : row.state === 'dealing' ? 'console.dealers.dealing' : 'console.dealers.resting'),
    },
  ];
}

/** A dealer's period with their share of the tip pool by time dealt, in basis points. */
type NightRow = DealerNight & { readonly tipShare: number };

const percent = (basisPoints: number) => t('console.dealers.percent', { value: formatNumber(basisPoints / 100) });

function nightColumns(): readonly DataTableColumn<NightRow>[] {
  return [
    { key: 'dealer', header: t('console.dealers.dealer'), cell: (row) => row.dealerName, sortValue: (row) => row.dealerName },
    { key: 'downs', header: t('console.dealers.downs'), align: 'end', cell: (row) => formatNumber(row.downs), sortValue: (row) => row.downs },
    { key: 'dealt', header: t('console.dealers.dealt'), align: 'end', cell: (row) => formatDuration(row.dealtSeconds), sortValue: (row) => row.dealtSeconds },
    { key: 'hands', header: t('console.dealers.hands'), align: 'end', cell: (row) => formatNumber(row.hands), sortValue: (row) => row.hands },
    {
      key: 'handsPerHour', header: t('console.dealers.handsPerHour'), align: 'end',
      cell: (row) => (row.handsPerHour === null ? '' : formatNumber(row.handsPerHour)), sortValue: (row) => row.handsPerHour ?? 0,
    },
    { key: 'rake', header: t('console.dealers.rake'), align: 'end', cell: (row) => formatMoney(row.rake), sortValue: (row) => row.rake,
      exportValue: (row) => Number(formatRupeesForFile(row.rake)) },
    { key: 'variance', header: t('console.dealers.variance'), align: 'end', cell: (row) => formatMoney(row.variance), sortValue: (row) => row.variance,
      exportValue: (row) => Number(formatRupeesForFile(row.variance)) },
    { key: 'tipShare', header: t('console.dealers.tipShare'), align: 'end', cell: (row) => percent(row.tipShare), sortValue: (row) => row.tipShare,
      exportValue: (row) => row.tipShare / 100 },
  ];
}

function Board({ venueId }: { venueId: string }) {
  const board = useDealerRotation(venueId);
  const columns = useMemo(() => boardColumns(), []);
  const base = { label: t('console.dealers.board'), columns, rowKey: (row: RotationDealer) => row.staffId };
  if (board.data === undefined && board.isError) return <DataTable {...base} status="error" onRetry={() => void board.refetch()} />;
  if (board.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={board.data} emptyText={t('console.dealers.noBoard')} />;
}

function Nights({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const nights = useDealerNights(venueId, from, to);
  const columns = useMemo(() => nightColumns(), []);
  const base = { label: t('console.dealers.period'), columns, rowKey: (row: NightRow) => row.staffId };
  if (nights.data === undefined && nights.isError) return <DataTable {...base} status="error" onRetry={() => void nights.refetch()} />;
  if (nights.data === undefined) return <DataTable {...base} status="loading" />;
  const shares = hourShares(nights.data.map((night) => night.dealtSeconds));
  const rows = nights.data.map((night, index) => ({ ...night, tipShare: shares[index] ?? 0 }));
  return (
    <Stack gap={2}>
      <Text tone="muted">{t('console.dealers.tipShareHint')}</Text>
      <DataTable {...base} rows={rows} emptyText={t('console.dealers.noNights')}
        exportFilter={t('console.exportFilters.period', { from, to })} />
    </Stack>
  );
}

function DealersBody({ venueId }: { venueId: string }) {
  const [period, setPeriod] = useState(() => ({ from: clubDay(new Date()), to: clubDay(new Date()) }));
  const isValid = period.from !== '' && period.to !== '' && period.from <= period.to;
  return (
    <Screen title={t('console.dealers.title')}>
      <Stack gap={8}>
        <Stack gap={4}>
          <Heading level={2} variant="section">{t('console.dealers.board')}</Heading>
          <Board venueId={venueId} />
        </Stack>
        <Stack gap={4}>
          <Heading level={2} variant="section">{t('console.dealers.period')}</Heading>
          <Inline gap={4} align="start" wrap>
            <Input type="date" label={t('console.dealers.from')} hint={t('console.dealers.periodHint')} value={period.from}
              onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
            <Input type="date" label={t('console.dealers.to')} value={period.to} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
          </Inline>
          {isValid ? <Nights venueId={venueId} from={period.from} to={period.to} /> : <ErrorMessage>{t('console.dealers.invalidPeriod')}</ErrorMessage>}
        </Stack>
      </Stack>
    </Screen>
  );
}

/**
 * Dealers (#124; scope-v1 module 10; decision 0252), for staff who run the floor (floor.manage): the rotation board,
 * read again each minute, and each dealer's downs, time, hands, hands per hour, rake and drop-box variance over the
 * club's days chosen, with their share of the tip pool by time dealt. Tips belong to dealers; the export is the table's.
 */
export function DealersScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('floor.manage')) {
    return <Screen title={t('console.dealers.title')} status="error" errorText={t('console.dealers.notAllowed')} />;
  }
  return <DealersBody venueId={staff.venue.venueId} />;
}
