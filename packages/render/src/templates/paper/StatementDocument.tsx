import { formatDate, formatDayMonth, t } from '@rivr/i18n';
import { DocumentPage, DocumentTable, type Issuer } from '@rivr/ui';

/** One movement in the period, with the balance after it, as the ledger gives them. */
export interface StatementMovement {
  /** An ISO timestamp; dated in IST. */
  at: string;
  description: string;
  amountPaise: bigint;
  balancePaise: bigint;
}

export interface StatementDocumentProps {
  issuer: Issuer;
  /** Whose statement it is: a partner, an investor, a payment account. */
  holder: string;
  /** The period, ISO dates, both days included. */
  from: string;
  to: string;
  openingPaise: bigint;
  movements: readonly StatementMovement[];
  closingPaise: bigint;
}

/** A statement on an A4 page, `tokens.viewport.a4`: the holder and period, each movement, the opening and closing balances. */
export function StatementDocument({ issuer, holder, from, to, openingPaise, movements, closingPaise }: StatementDocumentProps) {
  const period = t('documents.statement.between', { from: formatDate(new Date(from)), to: formatDate(new Date(to)) });
  const details = [
    { label: t('documents.statement.holder'), value: holder },
    { label: t('documents.statement.period'), value: period },
  ];
  const columns = [
    { label: t('documents.statement.date') },
    { label: t('documents.statement.description') },
    { label: t('documents.statement.amount'), isAmount: true },
    { label: t('documents.statement.balance'), isAmount: true },
  ];
  // The opening balance heads the movements, as on a bank statement; the closing balance ends them.
  const opening = [formatDayMonth(new Date(from)), t('documents.statement.opening'), '', openingPaise];
  const rows = movements.map((movement) => [formatDayMonth(new Date(movement.at)), movement.description, movement.amountPaise, movement.balancePaise]);
  return (
    <DocumentPage issuer={issuer} title={t('documents.statement.title')} details={details} note={t('documents.computerGenerated')}>
      <DocumentTable
        caption={t('documents.statement.caption')}
        columns={columns}
        rows={[opening, ...rows]}
        totals={[{ label: t('documents.statement.closing'), paise: closingPaise }]}
      />
    </DocumentPage>
  );
}
