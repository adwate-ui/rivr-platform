import { formatDate, formatMonth, formatNumber, t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { DocumentPage, type DocumentDetail, type Issuer } from '../DocumentPage/DocumentPage.tsx';
import { DocumentTable } from '../DocumentTable/DocumentTable.tsx';

/** A revenue or expense account and what it took in the month, as the MIS gives it. */
export interface PartnerStatementLine {
  readonly name: string;
  readonly paise: bigint;
}

/**
 * A partner's or investor's statement for a club month (#98): the club's result from the month's MIS
 * and their share of it, at their holding on the month's last day. Amounts come worked out; nothing is
 * worked out again here.
 */
export interface PartnerStatement {
  readonly issuer: Issuer;
  readonly holder: string;
  readonly kind: 'partner' | 'investor';
  /** The club month's first day, `2026-11-01`. */
  readonly month: string;
  /** The month's last day, on which the holding is read, `2026-11-30`. */
  readonly heldOn: string;
  /** The holding in basis points: 1250 is 12.5%. */
  readonly basisPoints: number;
  readonly revenue: readonly PartnerStatementLine[];
  readonly expenses: readonly PartnerStatementLine[];
  /** The month's revenue, its expenses and its net result, as the MIS totals them. */
  readonly revenuePaise: bigint;
  readonly expensePaise: bigint;
  readonly netPaise: bigint;
  /** The holder's share of the net, as @rivr/domain holderShare gives it. */
  readonly sharePaise: bigint;
  /** True while the month's MIS is not yet stored, so its figures may still change. */
  readonly isProvisional: boolean;
}

export interface PartnerStatementDocumentProps {
  statement: PartnerStatement;
  /** Offers Save as PDF above the page (the browser's own print), left off the page itself. */
  onSave?: () => void;
  /** Offers Back beside it, also left off the page. */
  onBack?: () => void;
}

/** A holding as the statement prints it: 1250 is `12.5%`. */
const percent = (basisPoints: number): string => `${formatNumber(basisPoints / 100)}%`;

function detailsOf(statement: PartnerStatement): DocumentDetail[] {
  const details = [
    { label: t('documents.partnerStatement.holder'), value: statement.holder },
    { label: t('documents.partnerStatement.month'), value: formatMonth(statement.month) },
    {
      label: t('documents.partnerStatement.holding'),
      value: t('documents.partnerStatement.holdingOn', { share: percent(statement.basisPoints), day: formatDate(new Date(`${statement.heldOn}T12:00:00+05:30`)) }),
    },
  ];
  return statement.isProvisional ? [...details, { label: t('documents.partnerStatement.status'), value: t('documents.partnerStatement.provisional') }] : details;
}

/**
 * A partner's or investor's monthly statement on an A4 page, `tokens.viewport.a4` (#98): the club's
 * revenue and expenses by account, the month's net result, and the holder's share of it. @rivr/render
 * draws it to PDF; the console shows it and saves it as a PDF. Its copy is the `documents` namespace,
 * which the caller registers.
 */
export function PartnerStatementDocument({ statement, onSave, onBack }: PartnerStatementDocumentProps) {
  // Expenses print as given, each marked as taken from the result, beneath the revenue.
  const rows = [
    ...statement.revenue.map((line) => [line.name, line.paise]),
    ...statement.expenses.map((line) => [t('documents.partnerStatement.less', { name: line.name }), line.paise]),
  ];
  return (
    <div className="flex flex-col gap-4">
      {onSave || onBack ? (
        <div className="flex gap-2 print:hidden">
          {onBack ? <Button variant="text" onClick={onBack}>{t('documents.invoice.back')}</Button> : null}
          {onSave ? <Button onClick={onSave}>{t('documents.invoice.save')}</Button> : null}
        </div>
      ) : null}
      <DocumentPage issuer={statement.issuer} title={t(`documents.partnerStatement.title.${statement.kind}`)} details={detailsOf(statement)}
        note={t('documents.computerGenerated')}>
        <DocumentTable
          caption={t('documents.partnerStatement.caption')}
          columns={[{ label: t('documents.partnerStatement.item') }, { label: t('documents.partnerStatement.amount'), isAmount: true }]}
          rows={rows}
          totals={[
            { label: t('documents.partnerStatement.revenue'), paise: statement.revenuePaise },
            { label: t('documents.partnerStatement.expenses'), paise: statement.expensePaise },
            { label: t('documents.partnerStatement.net'), paise: statement.netPaise },
            { label: t('documents.partnerStatement.share', { share: percent(statement.basisPoints) }), paise: statement.sharePaise },
          ]}
        />
      </DocumentPage>
    </div>
  );
}
