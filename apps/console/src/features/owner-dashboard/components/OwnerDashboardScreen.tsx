import { useStaffVenue } from '@rivr/db';
import { useOwnerSignals, useOwnerSnapshot, type OwnerSnapshot } from '@rivr/db/ownerDashboard';
import { alerts, formatDayMonth, formatDayTime, formatMoney, formatNumber, t } from '@rivr/i18n';
import { Chart, DataTable, Heading, Inline, Money, Number, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import type { ReactNode } from 'react';

type Account = OwnerSnapshot['cash'][number];
type Alert = OwnerSnapshot['alerts'][number];

const accountColumns = (): readonly DataTableColumn<Account>[] => [
  { key: 'account', header: t('console.ownerDashboard.account'), cell: (row) => row.name },
  { key: 'balance', header: t('console.ownerDashboard.balance'), align: 'end', sortValue: (row) => row.balance, cell: (row) => <Money paise={row.balance} /> },
];

/** An alert's kind in words, as the owner's WhatsApp says it (#100): never its details. */
const alertWords = (kind: string) => Object.entries(alerts.kinds).find(([known]) => known === kind)?.[1] ?? alerts.other;

const alertColumns = (): readonly DataTableColumn<Alert>[] => [
  { key: 'what', header: t('console.ownerDashboard.alert'), cell: (row) => alertWords(row.kind) },
  { key: 'when', header: t('console.ownerDashboard.when'), align: 'end', cell: (row) => formatDayTime(new Date(row.raisedAt)) },
];

/** One figure: what it is, then the figure. */
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{label}</Text>
      {children}
    </Stack>
  );
}

/** Tonight and the room: the rake and hands since 06:00, the tables running, who is seated and in the room. */
function Tonight({ snapshot }: { snapshot: OwnerSnapshot }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.ownerDashboard.tonight')}</Heading>
      <Figure label={t('console.ownerDashboard.rakeTonight')}><Money paise={snapshot.rakeTonight} size="display" /></Figure>
      <Text tone="muted">{t('console.ownerDashboard.handsTonight', { count: formatNumber(snapshot.handsTonight) })}</Text>
      <Inline gap={6} wrap>
        <Figure label={t('console.ownerDashboard.tablesOpen')}><Number value={snapshot.tablesOpen} size="title" /></Figure>
        <Figure label={t('console.ownerDashboard.seated')}><Number value={snapshot.seated} size="title" /></Figure>
        <Figure label={t('console.ownerDashboard.inTheRoom')}><Number value={snapshot.inTheRoom} size="title" /></Figure>
      </Inline>
    </Stack>
  );
}

/** The cash position: each payment account's balance, and what the club holds for players. */
function Cash({ snapshot }: { snapshot: OwnerSnapshot }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.ownerDashboard.cash')}</Heading>
      <DataTable label={t('console.ownerDashboard.cashLabel')} columns={accountColumns()} rowKey={(row) => row.name} rows={snapshot.cash}
        emptyText={t('console.ownerDashboard.noAccounts')} />
      <Inline gap={6} wrap>
        <Figure label={t('console.ownerDashboard.playersMoney')}><Money paise={snapshot.playersMoney} size="lead" /></Figure>
        <Figure label={t('console.ownerDashboard.chipsOut')}><Money paise={snapshot.chipsOut} size="lead" /></Figure>
      </Inline>
    </Stack>
  );
}

/** The last fortnight's nights, as a line of rake, its scale and table in rupees. */
function Nights({ snapshot }: { snapshot: OwnerSnapshot }) {
  return (
    <Chart kind="line" title={t('console.ownerDashboard.nights')} labelName={t('console.ownerDashboard.night')}
      labels={snapshot.nights.map((night) => formatDayMonth(new Date(`${night.day}T12:00:00+05:30`)))}
      series={[{ name: t('console.ownerDashboard.rake'), values: snapshot.nights.map((night) => globalThis.Number(night.rake)) }]}
      formatValue={(paise) => formatMoney(BigInt(Math.round(paise)))} emptyText={t('console.ownerDashboard.nightsEmpty')} />
  );
}

/** The dashboard's sections, one above the other, for a phone. */
function Dashboard({ venueId }: { venueId: string }) {
  const snapshot = useOwnerSnapshot(venueId);
  useOwnerSignals(venueId);
  if (snapshot.data === undefined && snapshot.isError) {
    return <Screen title={t('console.ownerDashboard.title')} status="error" onRetry={() => void snapshot.refetch()} />;
  }
  if (snapshot.data === undefined) return <Screen title={t('console.ownerDashboard.title')} status="loading" />;
  return (
    <Screen title={t('console.ownerDashboard.title')}>
      <Stack gap={8}>
        <Text variant="small" tone="muted">{t('console.ownerDashboard.live')}</Text>
        <Tonight snapshot={snapshot.data} />
        <Nights snapshot={snapshot.data} />
        <Cash snapshot={snapshot.data} />
        <Stack gap={4}>
          <Heading level={2}>{t('console.ownerDashboard.alerts')}</Heading>
          <DataTable label={t('console.ownerDashboard.alertsLabel')} columns={alertColumns()} rowKey={(row) => row.id} rows={snapshot.data.alerts}
            emptyText={t('console.ownerDashboard.noAlerts')} />
        </Stack>
      </Stack>
    </Screen>
  );
}

/**
 * The owner dashboard (#101; tech plan item 22): a phone's view of the console for the owner and super
 * admins: tonight's rake and hands, the tables running and the room, the rake of the last fortnight, the
 * cash position and the latest alerts, live as they change. The practice venue has none.
 */
export function OwnerDashboardScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.ownerDashboard.title');
  const { permissions, venueId, isPractice } = staff.venue;
  if (!permissions.includes('dashboards.read')) return <Screen title={title} status="error" errorText={t('console.ownerDashboard.notAllowed')} />;
  if (isPractice) return <Screen title={title} status="error" errorText={t('console.ownerDashboard.practice')} />;
  return <Dashboard venueId={venueId} />;
}
