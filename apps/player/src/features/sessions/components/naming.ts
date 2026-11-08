import type { MySession } from '@rivr/db/sessions';
import { clubDay } from '@rivr/domain/clubDay';
import { formatDate, formatDuration, formatNumber, formatStakes, t } from '@rivr/i18n';

/** A session's name: its table, each table of a night its own session (the owner, 9 Nov), or the tournament. */
export function sessionTitle(session: MySession): string {
  return session.tableName;
}

/** A cash session's stakes, `100/200`, under its table in the list (F-211); a tournament's place is in its line already. */
export function sessionStakes(session: MySession): string | undefined {
  return session.kind === 'cash' ? formatStakes(session.smallBlind, session.bigBlind) : undefined;
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
