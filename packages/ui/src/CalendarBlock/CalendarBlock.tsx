import { formatDate, formatMoney, formatTime, formatWeekday, t } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Stack } from '../Stack/Stack.tsx';
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

/** A website block of the coming tournaments, live from the schedule: when, the buy-in and any guarantee. */
export function CalendarBlock({ heading, tournaments }: CalendarBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-10">
      {heading ? <Heading level={2}>{heading}</Heading> : null}
      {tournaments.length === 0 ? <Text tone="muted">{t('ui.web.noTournaments')}</Text> : null}
      <Stack gap={4} divided>
        {tournaments.map((tournament) => (
          <Stack key={`${tournament.name}-${tournament.startsAt.toISOString()}`} gap={1}>
            <Text weight="medium">{tournament.name}</Text>
            <Text>{when(tournament.startsAt)}</Text>
            <Text tone="muted">{money(tournament)}</Text>
          </Stack>
        ))}
      </Stack>
    </section>
  );
}
