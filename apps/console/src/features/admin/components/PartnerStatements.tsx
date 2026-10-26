import { useVenueIssuer, type VenueIssuer } from '@rivr/db';
import { useMisReport, type MisReport } from '@rivr/db/reports';
import { useShareholdingRegister, type RegisterRow } from '@rivr/db/shareholding';
import { lastDayOfMonth, recentClubMonths } from '@rivr/domain/clubDay';
import { fromPaise } from '@rivr/domain/money';
import { holderShare } from '@rivr/domain/shareholding';
import { formatMonth, formatNumber, t } from '@rivr/i18n';
import {
  Button, ChoiceChips, DataTable, Heading, Money, PartnerStatementDocument, PrintSheet, Stack, Text, type DataTableColumn, type PartnerStatement,
} from '@rivr/ui';
import { useState } from 'react';
import { flushSync } from 'react-dom';

/** A holder with a holding on the month's last day, and their statement for the month. */
interface HolderStatement {
  readonly holder: RegisterRow;
  readonly statement: PartnerStatement;
}

/**
 * Save as PDF puts the statement on its A4 sheet, prints it and takes it off again when the printer dialog
 * closes, so the paper holds that statement alone.
 */
function usePrinting() {
  const [isPrinting, setIsPrinting] = useState(false);
  const print = () => {
    flushSync(() => setIsPrinting(true));
    globalThis.addEventListener('afterprint', () => setIsPrinting(false), { once: true });
    globalThis.print();
  };
  return { isPrinting, print };
}

/** Each holder's statement for the month: the MIS's result, and their share at their holding on its last day; none without a holding then. */
export function statementsOf(rows: readonly RegisterRow[], mis: MisReport, issuer: VenueIssuer, month: string): HolderStatement[] {
  return rows.flatMap((holder) => {
    if (holder.basisPoints === null || holder.basisPoints === 0) return [];
    const statement: PartnerStatement = {
      issuer, holder: holder.name, kind: holder.kind, month, heldOn: lastDayOfMonth(month), basisPoints: holder.basisPoints,
      revenue: mis.revenue.map((line) => ({ name: line.name, paise: line.amount })),
      expenses: mis.expenses.map((line) => ({ name: line.name, paise: line.amount })),
      revenuePaise: mis.totalRevenue, expensePaise: mis.totalExpenses, netPaise: mis.net, sharePaise: holderShare(mis.net, BigInt(holder.basisPoints)), isProvisional: mis.isPreview,
    };
    return [{ holder, statement }];
  });
}

function columns(onOpen: (row: HolderStatement) => void): readonly DataTableColumn<HolderStatement>[] {
  return [
    { key: 'holder', header: t('console.shareholders.holder'), cell: (row) => row.holder.name, sortValue: (row) => row.holder.name },
    { key: 'kind', header: t('console.shareholders.kind'), cell: (row) => t(`console.shareholders.kinds.${row.holder.kind}`) },
    {
      key: 'holding', header: t('console.shareholders.share'), align: 'end', sortValue: (row) => row.statement.basisPoints,
      cell: (row) => t('console.shareholders.percentValue', { value: formatNumber(row.statement.basisPoints / 100) }),
    },
    {
      key: 'amount', header: t('console.shareholders.statementShare'), align: 'end', sortValue: (row) => row.statement.sharePaise,
      cell: (row) => <Money paise={fromPaise(row.statement.sharePaise)} />,
    },
    {
      key: 'open', header: '',
      cell: (row) => (
        <Button variant="text" aria-label={t('console.shareholders.openStatementFor', { name: row.holder.name })} onClick={() => onOpen(row)}>
          {t('console.shareholders.openStatement')}
        </Button>
      ),
    },
  ];
}

/** The month's holders and their shares, or the table's loading or error state; one opened shows its statement. */
function MonthStatements({ venueId, month }: { venueId: string; month: string }) {
  const register = useShareholdingRegister(venueId, lastDayOfMonth(month));
  const mis = useMisReport(venueId, month);
  const issuer = useVenueIssuer(venueId);
  const [open, setOpen] = useState<HolderStatement | null>(null);
  const { isPrinting, print } = usePrinting();
  const base = { label: t('console.shareholders.statementsLabel'), columns: columns(setOpen), rowKey: (row: HolderStatement) => row.holder.shareholderId };
  if (register.isError || mis.isError || issuer.isError || issuer.data === null) {
    return <DataTable {...base} status="error" onRetry={() => void Promise.all([register.refetch(), mis.refetch(), issuer.refetch()])} />;
  }
  if (register.data === undefined || mis.data === undefined || issuer.data === undefined) return <DataTable {...base} status="loading" />;
  if (open !== null) {
    return (
      <>
        <PartnerStatementDocument statement={open.statement} onBack={() => setOpen(null)} onSave={print} />
        {isPrinting ? <PrintSheet paper="a4"><PartnerStatementDocument statement={open.statement} /></PrintSheet> : null}
      </>
    );
  }
  return <DataTable {...base} rows={statementsOf(register.data, mis.data, issuer.data, month)} emptyText={t('console.shareholders.statementsEmpty')} />;
}

/**
 * The monthly partner and investor statements (#98): for a club month, each holder's share of its net
 * result at their holding on its last day, and the statement itself, saved as a PDF. A month not yet
 * stored on the 1st gives provisional statements. The practice venue has none.
 */
export function PartnerStatements({ venueId, isPractice }: { venueId: string; isPractice: boolean }) {
  const [months] = useState(() => recentClubMonths(new Date(), 6));
  // Last month first: the month a statement is usually wanted for, its MIS stored on the 1st.
  const [month, setMonth] = useState(months[1] ?? '');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.shareholders.statements')}</Heading>
      {isPractice ? <Text>{t('console.shareholders.statementsPractice')}</Text> : (
        <>
          <Text variant="small" tone="muted">{t('console.shareholders.statementsHint')}</Text>
          <ChoiceChips label={t('console.shareholders.statementMonth')} mode="one" selected={[month]}
            options={months.map((first) => ({ value: first, label: formatMonth(first) }))} onChange={(picked) => setMonth(picked[0] ?? month)} />
          {month === '' ? null : <MonthStatements key={month} venueId={venueId} month={month} />}
        </>
      )}
    </Stack>
  );
}
