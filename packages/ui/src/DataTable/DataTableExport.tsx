import { formatRupeesForFile, t } from '@rivr/i18n';
import { createContext, isValidElement, useContext, useState, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { csvFile, xlsxFile, type ExportCell } from './exportFiles.ts';

/** What an export asks to be recorded before its file is saved (#102): the table, its filters, the format and the rows. */
export interface TableExportRequest {
  readonly what: string;
  readonly filter: string;
  readonly format: 'csv' | 'xlsx';
  readonly rows: number;
}

/** Records an export, as the console's audit log does; resolves false when it was not recorded, and then nothing is saved. */
export type TableExporter = (request: TableExportRequest) => Promise<boolean>;

const ExportContext = createContext<TableExporter | null>(null);

/** Offers Export CSV and Export XLSX on every DataTable beneath it, each recorded by the exporter before its file is saved (#102). */
export function DataTableExportProvider({ exporter, children }: { exporter: TableExporter | null; children: ReactNode }) {
  return <ExportContext value={exporter}>{children}</ExportContext>;
}

/** The exporter above a table, or null where none is offered. */
export function useTableExporter(): TableExporter | null {
  return useContext(ExportContext);
}

/** The parts of a column an export reads. */
interface ExportColumn<Row> {
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number | bigint;
  readonly exportValue?: (row: Row) => ExportCell;
}

/** The words a cell shows: its text, or the text inside the elements it draws (a Text, a Button's label). */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/**
 * A cell as the file gives it: the column's own export value; else a Money cell's rupees, a figure a
 * spreadsheet adds up; else the number it sorts by; else the words it shows.
 */
function exportCell<Row>(column: ExportColumn<Row>, row: Row): ExportCell {
  if (column.exportValue !== undefined) return column.exportValue(row);
  const node = column.cell(row);
  if (isValidElement<{ paise?: unknown }>(node) && typeof node.props.paise === 'bigint') return Number(formatRupeesForFile(node.props.paise));
  const value = column.sortValue?.(row);
  return typeof value === 'number' ? value : textOf(node);
}

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** Saves a file through the browser's download: `members-2026-10-26.csv`. */
function save(file: Blob, label: string, format: 'csv' | 'xlsx') {
  const stem = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'table';
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stem}-${IST_DAY.format(new Date())}.${format}`;
  link.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface ExportBarProps<Row> {
  readonly exporter: TableExporter;
  /** The table's name, as the audit log records what was exported. */
  readonly label: string;
  readonly columns: readonly ExportColumn<Row>[];
  /** The rows as shown: filtered and sorted. */
  readonly rows: readonly Row[];
  /** Every filter in force, in words: the screen's, then the table's own. */
  readonly filter: string;
}

/**
 * Export CSV and Export XLSX (#102): the rows as shown, in the columns that have a heading. The export is
 * recorded first; one that is not recorded saves nothing and says so.
 */
export function ExportBar<Row>({ exporter, label, columns, rows, filter }: ExportBarProps<Row>) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const run = async (format: 'csv' | 'xlsx') => {
    setState('busy');
    const isRecorded = await exporter({ what: label, filter, format, rows: rows.length }).catch(() => false);
    if (!isRecorded) return setState('failed');
    const named = columns.filter((column) => column.header !== '');
    const headers = named.map((column) => column.header);
    const cells = rows.map((row) => named.map((column) => exportCell(column, row)));
    save(format === 'csv' ? csvFile(headers, cells) : xlsxFile(label, headers, cells), label, format);
    setState('idle');
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button isLoading={state === 'busy'} onClick={() => void run('csv')}>{t('ui.dataTable.exportCsv')}</Button>
        <Button isLoading={state === 'busy'} onClick={() => void run('xlsx')}>{t('ui.dataTable.exportXlsx')}</Button>
      </div>
      {state === 'failed' ? <ErrorMessage>{t('ui.dataTable.exportFailed')}</ErrorMessage> : null}
    </div>
  );
}
