import { formatDate, formatMoney, formatTime, formatWeekday, t } from '@rivr/i18n';
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
}

function when(at: Date): string {
  return t('ui.web.when', { weekday: formatWeekday(at), date: formatDate(at), time: formatTime(at) });
}

function money(tournament: CalendarBlockTournament): string {
  const buyIn = t('ui.web.buyIn', { amount: formatMoney(tournament.buyIn) });
  if (tournament.guarantee === null) return buyIn;
  return t('ui.web.pair', { first: buyIn, second: t('ui.web.guaranteed', { amount: formatMoney(tournament.guarantee) }) });
}

/** A website block of the coming tournaments, live from the schedule, a card each: when, the buy-in and any guarantee. */
export function CalendarBlock({ heading, tournaments }: CalendarBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
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
