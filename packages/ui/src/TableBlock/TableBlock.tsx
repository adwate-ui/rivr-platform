import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface TableBlockProps {
  heading?: string | undefined;
  intro?: string | undefined;
  /** Two to four column names: `Stake`, `Points an hour`. */
  columns: readonly string[];
  /** Each row as long as the columns, the first cell naming the row. */
  rows: readonly (readonly string[])[];
  /** A line under the table. */
  note?: string | undefined;
}

/**
 * A website block of a small table of figures (decision 0166), as grandpokerarena.com sets out points by
 * stake: a header row, each row's first cell its name, the figures after it, and a note beneath.
 */
export function TableBlock({ heading, intro, columns, rows, note }: TableBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-6 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {intro ? <div className="max-w-text"><Text variant="lead" tone="muted">{intro}</Text></div> : null}
      <table className="w-full max-w-text border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => (
              <th key={column} scope="col" className="py-3 pr-6 font-text text-12 font-medium uppercase tracking-tv text-content-muted">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-hairline">
              {row.map((cell, index) => (index === 0
                ? <th key={cell} scope="row" className="py-3 pr-6 font-text text-16 font-medium text-content">{cell}</th>
                : <td key={`${String(index)}-${cell}`} className="py-3 pr-6 font-text text-16 tabular-nums text-content">{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <div className="max-w-text"><Text variant="small" tone="muted">{note}</Text></div> : null}
    </section>
  );
}
