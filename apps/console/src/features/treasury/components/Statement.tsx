import { useAccountStatement, type PaymentAccount, type StatementLine } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Heading, Inline, Input, Money, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { entryLabel } from './accountCopy.ts';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const DAY_MS = 86_400_000;

function columns(): readonly DataTableColumn<StatementLine>[] {
  return [
    { key: 'when', header: t('console.accounts.when'), cell: (row) => `${formatDate(new Date(row.occurredAt))}, ${formatTime(new Date(row.occurredAt))}` },
    { key: 'what', header: t('console.accounts.what'), cell: (row) => (row.memo === null ? entryLabel(row.kind) : `${entryLabel(row.kind)} · ${row.memo}`) },
    { key: 'amount', header: t('console.accounts.amount'), align: 'end', cell: (row) => (row.kind === 'opening_balance' ? '' : <Money paise={row.amount} />) },
    { key: 'balance', header: t('console.accounts.balance'), align: 'end', cell: (row) => <Money paise={row.balance} /> },
  ];
}

/** The statement's lines in order, or the table's loading or error state. */
function StatementRows({ accountId, from, to }: { accountId: string; from: string; to: string }) {
  // Up to the midnight after the last day, in India time (no daylight saving), as the statement counts entries before it.
  const statement = useAccountStatement(accountId, new Date(`${from}T00:00:00+05:30`).toISOString(),
    new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY_MS).toISOString());
  const base = { label: t('console.accounts.statementLabel'), columns: columns(), rowKey: (row: StatementLine) => `${row.occurredAt}:${row.kind}:${row.balance}` };
  if (statement.data === undefined && statement.isError) return <DataTable {...base} status="error" onRetry={() => void statement.refetch()} />;
  if (statement.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={statement.data} emptyText={t('console.accounts.noEntries')} />;
}

/**
 * A payment account's statement for a period of India-time days (#94): its balance before the period,
 * then each entry, oldest first, with the balance after it.
 */
export function Statement({ accounts }: { accounts: readonly PaymentAccount[] }) {
  const today = IST_DAY.format(new Date());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [period, setPeriod] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.accounts.statement')}</Heading>
      <ChoiceChips label={t('console.accounts.statementAccount')} mode="one" selected={accountId === null ? [] : [accountId]}
        options={accounts.map((account) => ({ value: account.id, label: account.name }))} onChange={(picked) => setAccountId(picked[0] ?? null)} />
      <Inline gap={4} wrap>
        <Input type="date" label={t('console.accounts.statementFrom')} value={period.from} onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
        <Input type="date" label={t('console.accounts.statementTo')} value={period.to} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
      </Inline>
      {accountId === null || period.from === '' || period.to === ''
        ? <Text tone="muted">{t('console.accounts.statementEmpty')}</Text>
        : <StatementRows accountId={accountId} from={period.from} to={period.to} />}
    </Stack>
  );
}
