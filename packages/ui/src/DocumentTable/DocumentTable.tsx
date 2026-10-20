import { formatMoney } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

/** A column of a document's table; amounts sit to the right. */
export interface DocumentColumn {
  label: string;
  isAmount?: boolean;
}

/** A sum beneath the table: `CGST at 9%`, `Total`. */
export interface DocumentTotal {
  label: string;
  paise: bigint;
}

/** A cell: words, or an amount in paise. */
export type DocumentCell = string | bigint;

export interface DocumentTableProps {
  /** Heard by screen readers: what the table lists. */
  caption: string;
  columns: readonly DocumentColumn[];
  rows: readonly (readonly DocumentCell[])[];
  /** Beneath the rows, each as given; the last, what is due or the closing balance, is set larger. */
  totals?: readonly DocumentTotal[] | undefined;
}

function cellText(cell: DocumentCell): string {
  return typeof cell === 'bigint' ? formatMoney(cell) : cell;
}

function amountClass(isAmount: boolean | undefined): string {
  return isAmount ? 'whitespace-nowrap text-end tabular-nums' : 'text-start';
}

function TotalRow({ total, span, isLast }: { total: DocumentTotal; span: number; isLast: boolean }) {
  return (
    <tr className={cx(isLast && 'border-t border-on-cream text-18 font-semibold')}>
      <th scope="row" colSpan={span} className="py-2 text-end font-medium">
        {total.label}
      </th>
      <td className="py-2 pl-6 whitespace-nowrap text-end tabular-nums">{formatMoney(total.paise)}</td>
    </tr>
  );
}

/** The table of an A4 document: an invoice's lines and tax, a statement's movements. Amounts are shown as given. */
export function DocumentTable({ caption, columns, rows, totals = [] }: DocumentTableProps) {
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-on-cream">
          {columns.map((column, index) => (
            <th
              key={column.label}
              scope="col"
              className={cx('py-2 text-12 font-medium uppercase tracking-wide', index > 0 && 'pl-6', amountClass(column.isAmount))}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-hairline">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className={cx('py-2 align-top', cellIndex > 0 && 'pl-6', amountClass(columns[cellIndex]?.isAmount))}>
                {cellText(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        {totals.map((total, index) => (
          <TotalRow key={total.label} total={total} span={columns.length - 1} isLast={index === totals.length - 1} />
        ))}
      </tfoot>
    </table>
  );
}
