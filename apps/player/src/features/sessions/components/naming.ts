import type { MySession } from '@rivr/db/sessions';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDate, formatNumber, t } from '@rivr/i18n';

/** A session's name: the table played longest, and how many others: `Table 2 and 1 more`. */
export function sessionTitle(session: MySession): string {
  return session.otherTables === 0
    ? session.tableName
    : t('player.sessions.moreTables', { table: session.tableName, count: formatNumber(session.otherTables) });
}

/** The club day a session began, as its month counts it: a night past midnight is the day before's, `13 Feb 2026`. */
export function sessionDay(session: MySession): string {
  return formatDate(new Date(`${clubDay(new Date(session.openedAt))}T12:00:00+05:30`));
}
