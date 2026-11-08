/** The calendar and the joiners as SQL rows: sim.night and sim.joiner are filled from TypeScript, so both sides agree. */
import type { Night } from '../calendar/calendar.ts';
import type { Joiner } from '../people/growth.ts';

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

/** One insert of every night: its date, players expected, whether it is a peak, and its scripted events. */
export function nightRows(nights: readonly Night[]): string {
  const values = nights.map(
    (night) => `(${night.n}, ${quote(night.date)}, ${night.expected}, ${night.peak}, array[${night.events.map(quote).join(', ')}]::text[])`,
  );
  return `insert into sim.night (n, date, expected, peak, events) values\n${values.join(',\n')};`;
}

/** One insert of every joiner of nights 1 to N, numbered from 1 within their night. Empty when nobody joins. */
export function joinerRows(joinersByNight: ReadonlyMap<number, readonly Joiner[]>): string {
  const values = [...joinersByNight].flatMap(([n, joiners]) =>
    joiners.map((joiner, index) => `(${n}, ${index + 1}, ${quote(joiner.persona)}, ${quote(joiner.source)})`),
  );
  return values.length === 0 ? '' : `insert into sim.joiner (n, idx, persona, source) values\n${values.join(',\n')};`;
}
