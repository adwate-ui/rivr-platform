import { usePaymentAccounts, useStaffVenue, type PaymentAccount } from '@rivr/db';
import { t } from '@rivr/i18n';
import { DataTable, Grid, Heading, Money, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { AddAccountForm, TransferForm } from './AccountForms.tsx';
import { kindLabel } from './accountCopy.ts';
import { Statement } from './Statement.tsx';

function columns(): readonly DataTableColumn<PaymentAccount>[] {
  return [
    { key: 'name', header: t('console.accounts.account'), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: 'kind', header: t('console.accounts.kind'), cell: (row) => kindLabel(row.kind) },
    { key: 'details', header: t('console.accounts.details'), cell: (row) => row.details ?? '' },
    { key: 'balance', header: t('console.accounts.balance'), align: 'end', sortValue: (row) => row.balance, cell: (row) => <Money paise={row.balance} /> },
  ];
}

/**
 * Accounts (#94; additions "Expenses and payment accounts"): every payment account (the drawer, each
 * UPI handle and bank account) with its balance, and a statement for each over a period. Treasury
 * managers add accounts and move money between them. Ledger readers see it.
 */
export function AccountsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.accounts.title');
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('ledger.read')) return <Screen title={title} status="error" errorText={t('console.accounts.notAllowed')} />;
  return <AccountsView title={title} venueId={venueId} canManage={permissions.includes('treasury.manage')} />;
}

function AccountsView({ title, venueId, canManage }: { title: string; venueId: string; canManage: boolean }) {
  const accounts = usePaymentAccounts(venueId);
  if (accounts.isPending) return <Screen title={title} status="loading" />;
  if (accounts.isError) return <Screen title={title} status="error" onRetry={() => void accounts.refetch()} />;
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8} stackBelow="medium">
        <Stack gap={4}>
          <Heading level={2}>{t('console.accounts.list')}</Heading>
          <DataTable label={t('console.accounts.list')} columns={columns()} rowKey={(row) => row.id} rows={accounts.data} emptyText={t('console.accounts.noAccounts')} />
          <Text variant="small" tone="muted">{t('console.accounts.balanceHint')}</Text>
        </Stack>
        {canManage ? (
          <Stack gap={8}>
            <TransferForm venueId={venueId} accounts={accounts.data.filter((account) => account.isActive)} />
            <AddAccountForm venueId={venueId} />
          </Stack>
        ) : null}
      </Grid>
      <Statement accounts={accounts.data} />
    </Screen>
  );
}
