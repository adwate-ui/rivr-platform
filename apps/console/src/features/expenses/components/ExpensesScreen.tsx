import { useExpenseCategories, usePaymentAccounts, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen, Stack } from '@rivr/ui';
import { Categories } from './Categories.tsx';
import { ExpenseList } from './ExpenseList.tsx';
import { RequestForm } from './RequestForm.tsx';

/**
 * Expenses (#95; additions "Expenses and payment accounts"): the cage or a treasury manager asks for an
 * expense with a photo of its receipt; a treasury manager who did not ask approves it, and only then
 * does it post from its payment account to its category. Treasury managers keep the categories.
 */
export function ExpensesScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.expenses.title');
  const { permissions, venueId } = staff.venue;
  const canDecide = permissions.includes('treasury.manage');
  if (!canDecide && !permissions.includes('cage.transact')) return <Screen title={title} status="error" errorText={t('console.expenses.notAllowed')} />;
  return <ExpensesView title={title} venueId={venueId} canDecide={canDecide} />;
}

function ExpensesView({ title, venueId, canDecide }: { title: string; venueId: string; canDecide: boolean }) {
  const categories = useExpenseCategories(venueId);
  const accounts = usePaymentAccounts(venueId);
  if (categories.isPending || accounts.isPending) return <Screen title={title} status="loading" />;
  if (categories.isError || accounts.isError) {
    return <Screen title={title} status="error" onRetry={() => { void categories.refetch(); void accounts.refetch(); }} />;
  }
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8} stackBelow="medium">
        <ExpenseList venueId={venueId} canDecide={canDecide} />
        <Stack gap={8}>
          <RequestForm venueId={venueId} categories={categories.data} accounts={accounts.data.filter((account) => account.isActive)} />
          {canDecide ? <Categories venueId={venueId} categories={categories.data} /> : null}
        </Stack>
      </Grid>
    </Screen>
  );
}
