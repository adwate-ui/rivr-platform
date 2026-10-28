import { t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

/** How a cell reads, in four named bands, never a gradient: strong, fair, weak, or too few answers to say. */
export type HeatmapBand = 'strong' | 'fair' | 'weak' | 'thin';

/** One cell: its figure ("44%"), what it is of ("18/41"), and its band. */
export interface HeatmapCell {
  readonly value: string;
  readonly detail: string;
  readonly band: HeatmapBand;
}

export interface HeatmapRow {
  readonly name: string;
  /** One per column; null where nothing was answered. */
  readonly cells: readonly (HeatmapCell | null)[];
}

export interface HeatmapProps {
  /** What the grid is, for screen readers: "Accuracy by street and position". */
  label: string;
  /** The corner header, naming the rows: "Street". */
  corner: string;
  columns: readonly string[];
  rows: readonly HeatmapRow[];
  /** What shows when nothing has been answered. */
  emptyText: string;
}

const BAND_CLASS: Readonly<Record<HeatmapBand, string>> = {
  strong: 'bg-action text-on-action',
  fair: 'bg-raised text-content',
  weak: 'bg-alert text-on-alert',
  thin: 'text-content-muted',
};
const BANDS: readonly HeatmapBand[] = ['strong', 'fair', 'weak', 'thin'];

/**
 * Two dimensions at once (#136): each cell prints its figure over what it is of, in one of four named bands, the
 * band said in words too. A cell with too few answers is grey, and an empty one blank.
 */
export function Heatmap({ label, corner, columns, rows, emptyText }: HeatmapProps) {
  if (rows.length === 0) return <Text tone="muted">{emptyText}</Text>;
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table aria-label={label} className="w-full border-collapse font-text text-14">
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left font-medium text-content-muted">{corner}</th>
              {columns.map((column) => <th key={column} scope="col" className="p-2 text-center font-medium text-content-muted">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row" className="p-2 text-left font-medium text-content">{row.name}</th>
                {row.cells.map((cell, index) => (
                  <td key={`${row.name}-${columns[index] ?? String(index)}`} className={cx('border border-hairline p-2 text-center', cell === null ? undefined : BAND_CLASS[cell.band])}>
                    {cell === null ? null : (
                      <>
                        <span className="block font-semibold">{cell.value}</span>
                        <span className="block text-12">{cell.detail}</span>
                        <span className="sr-only">{t(`ui.heatmap.bands.${cell.band}`)}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={t('ui.heatmap.legend')} className="flex flex-wrap gap-3">
        {BANDS.map((band) => (
          <li key={band} className={cx('rounded-sm px-2 py-1 font-text text-12', BAND_CLASS[band])}>{t(`ui.heatmap.bands.${band}`)}</li>
        ))}
      </ul>
    </div>
  );
}
