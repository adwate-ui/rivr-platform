import type { ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';

/** A column: one tier. */
export interface TierMatrixTier {
  readonly id: string;
  readonly name: string;
}

/** A row: one feature, and what each tier's cell holds (the console puts a choice there). */
export interface TierMatrixRow {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  /** By tier id. A tier with nothing here shows an empty cell. */
  readonly cells: Readonly<Record<string, ReactNode>>;
}

export interface TierMatrixProps {
  /** What the table is, read as its name: "Features by tier". */
  label: string;
  /** The first column's header: "Feature". */
  featureHeader: string;
  tiers: readonly TierMatrixTier[];
  rows: readonly TierMatrixRow[];
  /** When there are no rows at all. */
  emptyText: string;
}

/**
 * The tier x feature matrix (additions "Tier-gated features", console Tiers screen): a real table, so a
 * screen reader names each cell by its feature (row header) and tier (column header), with rows that grow
 * to fit what their cells hold. Wider than the screen, it scrolls sideways on its own; the box is positioned, so a
 * cell's screen-reader-only label (absolutely placed) stays inside it rather than widening the page.
 */
export function TierMatrix({ label, featureHeader, tiers, rows, emptyText }: TierMatrixProps) {
  if (rows.length === 0) return <Text tone="muted">{emptyText}</Text>;
  return (
    <div className="relative overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className="pb-3 pr-4 text-left align-bottom">
              <Text variant="label">{featureHeader}</Text>
            </th>
            {tiers.map((tier) => (
              <th key={tier.id} scope="col" className="pb-3 pr-4 text-left align-bottom">
                <Text variant="label">{tier.name}</Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-hairline">
              <th scope="row" className="py-3 pr-4 text-left align-top font-normal">
                <Text weight="semibold">{row.name}</Text>
                {row.description === undefined ? null : <Text variant="small" tone="muted">{row.description}</Text>}
              </th>
              {tiers.map((tier) => (
                <td key={tier.id} className="py-3 pr-4 align-top">{row.cells[tier.id] ?? null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
