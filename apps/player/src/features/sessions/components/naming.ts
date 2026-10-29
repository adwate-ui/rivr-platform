import type { MySession } from '@rivr/db/sessions';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDate, formatDuration, formatNumber, t } from '@rivr/i18n';

/** A session's name: the table played longest, and how many others: `Table 2 and 1 more`. */
export function sessionTitle(session: MySession): string {
  return session.otherTables === 0
    ? session.tableName
    : t('player.sessions.moreTables', { table: session.tableName, count: formatNumber(session.otherTables) });
}

/** A session's line under its name: how long, `6 h 30 min`, and for a tournament (#549) its place in the field first. */
export function sessionLine(session: MySession): string {
  const hours = formatDuration(session.playedSeconds);
  if (session.kind === 'cash') return hours;
  const what = session.place === null || session.entrants === null
    ? t('player.sessions.tournament')
    : t('player.sessions.tournamentPlace', { place: formatNumber(session.place), entrants: formatNumber(session.entrants) });
  return t('player.sessions.sub', { what, hours });
}

/** The club day a session began, as its month counts it: a night past midnight is the day before's, `13 Feb 2026`. */
export function sessionDay(session: MySession): string {
  return formatDate(new Date(`${clubDay(new Date(session.openedAt))}T12:00:00+05:30`));
}
