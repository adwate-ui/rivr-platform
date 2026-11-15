/**
 * A stake's game as the database gives it, read as the console, the player app and the TVs all read it: Pot-Limit Omaha
 * where it says so, and No-Limit Hold'em otherwise, a stake that names no game (as production's does not) included.
 */
export function playedGame(game: string | null): 'nlh' | 'plo' {
  return game === 'plo' ? 'plo' : 'nlh';
}
