import { formatDate, formatIsoDay, formatMoney, formatMonth, formatTime, formatWeekday, t } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** One tournament on the calendar. Money in paise; the time in UTC, shown in IST. */
export interface CalendarBlockTournament {
  readonly name: string;
  readonly startsAt: Date;
  readonly buyIn: bigint;
  /** The prize pool the club guarantees; null for a tournament without one. */
  readonly guarantee: bigint | null;
}

export interface CalendarBlockProps {
  heading?: string | undefined;
  tournaments: readonly CalendarBlockTournament[];
  /** The month to set out day by day above the list (#617), as `2026-11`; none shows the list alone. */
  month?: string | undefined;
}

const WEEKDAYS = ['ui.web.weekday.mon', 'ui.web.weekday.tue', 'ui.web.weekday.wed', 'ui.web.weekday.thu', 'ui.web.weekday.fri',
  'ui.web.weekday.sat', 'ui.web.weekday.sun'] as const;

function when(at: Date): string {
  return t('ui.web.when', { weekday: formatWeekday(at), date: formatDate(at), time: formatTime(at) });
}

function money(tournament: CalendarBlockTournament): string {
  const buyIn = t('ui.web.buyIn', { amount: formatMoney(tournament.buyIn) });
  if (tournament.guarantee === null) return buyIn;
  return t('ui.web.pair', { first: buyIn, second: t('ui.web.guaranteed', { amount: formatMoney(tournament.guarantee) }) });
}

/** The month's days in weeks from Monday, as their day of the month, with null before the first and after the last. */
function weeksOf(month: string): (number | null)[][] {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const before = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [...Array<null>(before).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const weeks: (number | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    const week = cells.slice(start, start + 7);
    weeks.push([...week, ...Array<null>(7 - week.length).fill(null)]);
  }
  return weeks;
}

/** The month day by day, Monday first, each day with its tournaments' names. */
function MonthGrid({ month, tournaments }: { month: string; tournaments: readonly CalendarBlockTournament[] }) {
  const onDay = (day: number) => tournaments.filter((tournament) => formatIsoDay(tournament.startsAt) === `${month}-${String(day).padStart(2, '0')}`);
  return (
    <div className="flex flex-col gap-4">
      <Heading level={3} variant="subsection">{formatMonth(month)}</Heading>
      <table aria-label={t('ui.web.monthCalendar')} className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col" className="pb-2 font-text text-12 font-medium uppercase tracking-tv text-content-muted">{t(weekday)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(month).map((week) => (
            <tr key={week.find((day) => day !== null)}>
              {week.map((day, index) => (
                <td key={day ?? `empty-${String(index)}`} className="h-touch border border-hairline p-1 align-top">
                  {day === null ? null : (
                    <div className="flex flex-col gap-1">
                      <Text variant="caption" tone="muted">{day}</Text>
                      {onDay(day).map((tournament) => <Text key={tournament.name} variant="caption" weight="medium" truncate>{tournament.name}</Text>)}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A website block of the coming tournaments, live from the schedule: the month day by day, then a card each with when, the buy-in and any guarantee. */
export function CalendarBlock({ heading, tournaments, month }: CalendarBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {month ? <MonthGrid month={month} tournaments={tournaments} /> : null}
      {tournaments.length === 0 ? <Text tone="muted">{t('ui.web.noTournaments')}</Text> : null}
      <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
        {tournaments.map((tournament) => (
          <li key={`${tournament.name}-${tournament.startsAt.toISOString()}`} className="flex flex-col gap-2 rounded-lg border border-hairline p-6">
            <Text variant="lead" weight="medium">{tournament.name}</Text>
            <Text>{when(tournament.startsAt)}</Text>
            <Text tone="muted">{money(tournament)}</Text>
          </li>
        ))}
      </ul>
    </section>
  );
}
