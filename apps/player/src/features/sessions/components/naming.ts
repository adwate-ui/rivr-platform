import type { MySession } from '@rivr/db/sessions';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDate, formatDuration, formatNumber, formatStakes, t } from '@rivr/i18n';

/** A session's name: its table, each table of a night its own session (the owner, 9 Nov), or the tournament. */
export function sessionTitle(session: MySession): string {
  return session.tableName;
}

/** A cash session's stakes, `100/200` or `100/200/500` with a straddle, under its table in the list (F-211); a tournament has none. */
export function sessionStakes(session: MySession): string | undefined {
  return session.kind === 'cash' ? formatStakes(session.smallBlind, session.bigBlind, session.straddle) : undefined;
}

/** A tournament's line: `Tournament`, with how many entered once the club has typed it, `Tournament · 58 entries` (redesign RD-26). */
export function tournamentLine(session: MySession): string {
  if (session.entrants === null) return t('player.sessions.tournament');
  return session.entrants === 1 ? t('player.sessions.tournamentOneEntry') : t('player.sessions.tournamentEntries', { entries: formatNumber(session.entrants) });
}

/** A session's line under its name: how long, `6 h 30 min`; a tournament, which has no time played, says what it is. */
export function sessionLine(session: MySession): string {
  return session.kind === 'cash' ? formatDuration(session.playedSeconds) : tournamentLine(session);
}

/** The club day a session began, as its month counts it: a night past midnight is the day before's, `13 Feb 2026`. */
export function sessionDay(session: MySession): string {
  return formatDate(new Date(`${clubDay(new Date(session.openedAt))}T12:00:00+05:30`));
}
