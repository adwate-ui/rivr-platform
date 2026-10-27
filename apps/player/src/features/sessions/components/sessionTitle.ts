import type { MySession } from '@rivr/db/sessions';
import { formatNumber, t } from '@rivr/i18n';

/** A session's name: the table played longest, and how many others: `Table 2 and 1 more`. */
export function sessionTitle(session: MySession): string {
  return session.otherTables === 0
    ? session.tableName
    : t('player.sessions.moreTables', { table: session.tableName, count: formatNumber(session.otherTables) });
}
