import type { VenueTournament } from '@rivr/db';
import { t } from '@rivr/i18n';

/** What event a tournament is part of (#519, #524): a satellite for another, a Day 1 flight, or a Day 2 with flights; none otherwise. */
export function eventLine(tournament: VenueTournament, tournaments: readonly VenueTournament[]): string | null {
  const nameOf = (id: string) => tournaments.find((each) => each.id === id)?.name ?? '';
  if (tournament.satelliteTargetId !== null) return t('console.tournaments.events.satelliteFor', { name: nameOf(tournament.satelliteTargetId) });
  if (tournament.dayTwoId !== null) return t('console.tournaments.events.flightOf', { name: nameOf(tournament.dayTwoId) });
  return tournaments.some((each) => each.dayTwoId === tournament.id) ? t('console.tournaments.events.dayTwo') : null;
}
