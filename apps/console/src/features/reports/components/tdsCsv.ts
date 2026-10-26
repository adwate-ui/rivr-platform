import type { TdsDeduction } from '@rivr/db/tds';
import { formatRupeesForFile, t } from '@rivr/i18n';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * A CSV cell, always quoted (quotes doubled), so no separator a spreadsheet might use splits it; a name a
 * spreadsheet would read as a formula (`=`, `+`, `-`, `@`) is kept as text with a leading apostrophe.
 */
function cell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** A rate in basis points as the file gives it: 3000 is `30.00`. */
const ratePercent = (basisPoints: number) => `${Math.trunc(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}`;

/**
 * The quarterly return extract as a CSV file's text (#93): a heading row, then one row per deduction,
 * dated in India time, amounts in rupees with two decimals. Lines end in CRLF, as spreadsheets expect.
 */
export function tdsCsv(deductions: readonly TdsDeduction[]): string {
  const headings = [
    t('console.tds.columns.deductedAt'), t('console.tds.columns.name'), t('console.tds.columns.pan'), t('console.tds.columns.section'),
    t('console.tds.columns.taxedWinnings'), t('console.tds.columns.rate'), t('console.tds.columns.tds'),
  ];
  const rows = deductions.map((deduction) => [
    IST_DAY.format(new Date(deduction.deductedAt)), deduction.fullName, deduction.pan, deduction.section, formatRupeesForFile(deduction.taxedWinnings),
    ratePercent(deduction.rateBasisPoints), formatRupeesForFile(deduction.tds),
  ]);
  return `${[headings, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}

/** The quarter's first day for each of the last four quarters, this one first, from a day in India (`2026-10-26`). */
export function recentQuarters(today: string): string[] {
  const [year = 0, month = 1] = today.split('-').map(Number);
  const first = month - ((month - 1) % 3);
  return [0, 3, 6, 9].map((back) => {
    const start = new Date(Date.UTC(year, first - 1 - back, 1));
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`;
  });
}
