import { zodResolver } from '@hookform/resolvers/zod';
import { tallyLedgerSchema } from '@rivr/contracts/tally';
import { useSetTallyLedger, useTallyAccounts, type TallyAccount, type TallyFailure } from '@rivr/db/tally';
import { t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Input, Stack, Text, type DataTableColumn, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

type LedgerForm = ReturnType<typeof useForm<z.input<typeof tallyLedgerSchema>, unknown, z.output<typeof tallyLedgerSchema>>>;

function columns(onPick: (account: TallyAccount) => void): readonly DataTableColumn<TallyAccount>[] {
  return [
    { key: 'code', header: t('console.tally.code'), cell: (row) => row.accountCode, sortValue: (row) => row.accountCode },
    { key: 'name', header: t('console.tally.name'), cell: (row) => row.accountName ?? t('console.tally.membersOnly') },
    {
      key: 'ledger', header: t('console.tally.tallyLedger'), sortValue: (row) => row.tallyLedger ?? '',
      cell: (row) => row.tallyLedger ?? t('console.tally.notMapped'),
    },
    {
      key: 'map', header: '',
      cell: (row) => (
        <Button variant="text" aria-label={t('console.tally.mapLabel', { code: row.accountCode })} onClick={() => onPick(row)}>{t('console.tally.mapOne')}</Button>
      ),
    },
  ];
}

/** The venue's money accounts and their Tally ledgers, or the table's loading or error state. */
function AccountRows({ venueId, onPick }: { venueId: string; onPick: (account: TallyAccount) => void }) {
  const accounts = useTallyAccounts(venueId);
  const base = { label: t('console.tally.ledgersLabel'), columns: columns(onPick), rowKey: (row: TallyAccount) => row.accountCode };
  if (accounts.data === undefined && accounts.isError) return <DataTable {...base} status="error" onRetry={() => void accounts.refetch()} />;
  if (accounts.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={accounts.data} emptyText={t('console.tally.empty')} />;
}

/** The account picked from the table, and the Tally ledger it posts to. */
function MapForm({ venueId, form }: { venueId: string; form: LedgerForm }) {
  const setLedger = useSetTallyLedger(venueId);
  const [outcome, setOutcome] = useState<TallyFailure | 'done' | null>(null);
  const accountCode = useWatch({ control: form.control, name: 'accountCode' });
  const errors = form.formState.errors;
  const ledgerField = form.register('tallyLedger');
  const submit = form.handleSubmit(async (mapping) => {
    const done = await setLedger.mutateAsync(mapping);
    setOutcome(done.ok ? 'done' : done.error);
    if (done.ok) form.reset({ accountCode: '', tallyLedger: '' });
  });
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.tally.map')}</Heading>
      <Text>{accountCode === '' ? t('console.tally.chooseAccount') : t('console.tally.mapping', { code: accountCode })}</Text>
      <Input {...ledgerField} label={t('console.tally.ledgerName')} autoComplete="off"
        error={errors.tallyLedger ? t('console.tally.invalidLedger') : undefined} />
      {errors.accountCode ? <ErrorMessage>{t('console.tally.chooseAccount')}</ErrorMessage> : null}
      <Button isLoading={setLedger.isPending} onClick={() => void submit()}>{t('console.tally.save')}</Button>
      <StatusMessage>{outcome === 'done' ? t('console.tally.saved') : null}</StatusMessage>
      {outcome === null || outcome === 'done' ? null : <ErrorMessage>{t(`console.tally.failures.${outcome}`)}</ErrorMessage>}
    </Stack>
  );
}

/** Which Tally ledger each money account posts to (#96): pick an account in the table, then name its ledger. */
export function TallyLedgers({ venueId }: { venueId: string }) {
  const [resolver] = useState(() => zodResolver(tallyLedgerSchema));
  const form: LedgerForm = useForm({ resolver, defaultValues: { accountCode: '', tallyLedger: '' } });
  const pick = (account: TallyAccount) => form.reset({ accountCode: account.accountCode, tallyLedger: account.tallyLedger ?? '' });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tally.ledgers')}</Heading>
      <Text variant="small" tone="muted">{t('console.tally.ledgersHint')}</Text>
      <MapForm venueId={venueId} form={form} />
      <AccountRows venueId={venueId} onPick={pick} />
    </Stack>
  );
}
