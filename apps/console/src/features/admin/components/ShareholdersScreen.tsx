import { useStaffVenue } from '@rivr/db';
import { useShareholdingHistory, useShareholdingRegister, type HoldingRecord, type RegisterRow } from '@rivr/db/shareholding';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { DataTable, Grid, Heading, Input, Screen, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { PartnerStatements } from './PartnerStatements.tsx';
import { AddHolderForm, RecordHoldingForm } from './RegisterForms.tsx';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const dayLabel = (day: string) => formatDate(new Date(`${day}T12:00:00+05:30`));
// A share in basis points as a percentage: 1250 is 12.5%.
const percent = (basisPoints: number) => t('console.shareholders.percentValue', { value: formatNumber(basisPoints / 100) });

function registerColumns(): readonly DataTableColumn<RegisterRow>[] {
  return [
    { key: 'holder', header: t('console.shareholders.holder'), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: 'kind', header: t('console.shareholders.kind'), cell: (row) => t(`console.shareholders.kinds.${row.kind}`) },
    {
      key: 'share', header: t('console.shareholders.share'), align: 'end', sortValue: (row) => row.basisPoints ?? -1,
      cell: (row) => (row.basisPoints === null ? t('console.shareholders.noHolding') : percent(row.basisPoints)),
    },
    { key: 'since', header: t('console.shareholders.since'), cell: (row) => (row.effectiveFrom === null ? '' : dayLabel(row.effectiveFrom)) },
  ];
}

function historyColumns(): readonly DataTableColumn<HoldingRecord>[] {
  return [
    { key: 'day', header: t('console.shareholders.effectiveFrom'), cell: (row) => dayLabel(row.effectiveFrom), sortValue: (row) => row.effectiveFrom },
    { key: 'holder', header: t('console.shareholders.holder'), cell: (row) => row.name },
    { key: 'share', header: t('console.shareholders.share'), align: 'end', cell: (row) => percent(row.basisPoints) },
    { key: 'note', header: t('console.shareholders.note'), cell: (row) => row.note ?? '' },
    { key: 'by', header: t('console.shareholders.recordedBy'), cell: (row) => row.recordedBy },
  ];
}

/** The register on a day: each holder and their share then. */
function RegisterRows({ venueId, on }: { venueId: string; on: string }) {
  const register = useShareholdingRegister(venueId, on);
  const base = {
    label: t('console.shareholders.registerLabel'), columns: registerColumns(), rowKey: (row: RegisterRow) => row.shareholderId,
    exportFilter: t('console.exportFilters.day', { day: on }),
  };
  if (register.data === undefined && register.isError) return <DataTable {...base} status="error" onRetry={() => void register.refetch()} />;
  if (register.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={register.data} emptyText={t('console.shareholders.empty')} />;
}

/** The register on the day chosen; no day, no register. */
function Register({ venueId, on, onDay }: { venueId: string; on: string; onDay: (day: string) => void }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.shareholders.register')}</Heading>
      <Input type="date" label={t('console.shareholders.on')} value={on} onChange={(event) => onDay(event.target.value)} />
      {on === '' ? null : <RegisterRows venueId={venueId} on={on} />}
    </Stack>
  );
}

/** Every holding recorded, newest day first. */
function History({ venueId }: { venueId: string }) {
  const history = useShareholdingHistory(venueId);
  const base = { label: t('console.shareholders.historyLabel'), columns: historyColumns(), rowKey: (row: HoldingRecord) => `${row.shareholderId}:${row.effectiveFrom}` };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.shareholders.history')}</Heading>
      {history.data === undefined && history.isError ? <DataTable {...base} status="error" onRetry={() => void history.refetch()} /> : null}
      {history.data === undefined && !history.isError ? <DataTable {...base} status="loading" /> : null}
      {history.data === undefined ? null : <DataTable {...base} rows={history.data} emptyText={t('console.shareholders.historyEmpty')} />}
    </Stack>
  );
}

/**
 * Shareholders (#97; additions "Shareholding register"): partners and investors, with holdings that
 * change on the days they are recorded from, and their monthly statements (#98). Super admins only; every
 * change is audited.
 */
export function ShareholdersScreen() {
  const staff = useStaffVenue();
  const [on, setOn] = useState(() => IST_DAY.format(new Date()));
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.shareholders.title');
  const { permissions, venueId, isPractice } = staff.venue;
  if (!permissions.includes('shareholding.manage')) return <Screen title={title} status="error" errorText={t('console.shareholders.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Grid columns={2} gap={8} stackBelow="medium">
          <Stack gap={8}>
            <Register venueId={venueId} on={on} onDay={setOn} />
            <History venueId={venueId} />
          </Stack>
          <Stack gap={8}>
            <RecordHoldingForm venueId={venueId} />
            <AddHolderForm venueId={venueId} />
          </Stack>
        </Grid>
        <PartnerStatements venueId={venueId} isPractice={isPractice} />
      </Stack>
    </Screen>
  );
}
