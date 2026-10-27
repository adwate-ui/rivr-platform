import type { MySession } from '@rivr/db/sessions';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDate, formatNumber, formatStakes, t } from '@rivr/i18n';

/** A session's name: the table played longest, and how many others: `Table 2 and 1 more`. */
export function sessionTitle(session: MySession): string {
  return session.otherTables === 0
    ? session.tableName
    : t('player.sessions.moreTables', { table: session.tableName, count: formatNumber(session.otherTables) });
}

/** A session's stakes, `100/200`, or for a tournament (#549) its place in the field: `Tournament · place 4 of 61`. */
export function sessionStake(session: MySession): string {
  if (session.kind === 'cash') return formatStakes(session.smallBlind, session.bigBlind);
  return session.place === null || session.entrants === null
    ? t('player.sessions.tournament')
    : t('player.sessions.tournamentPlace', { place: formatNumber(session.place), entrants: formatNumber(session.entrants) });
}

/** The club day a session began, as its month counts it: a night past midnight is the day before's, `13 Feb 2026`. */
export function sessionDay(session: MySession): string {
  return formatDate(new Date(`${clubDay(new Date(session.openedAt))}T12:00:00+05:30`));
}
