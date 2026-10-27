import { formatMoney, t } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Stakes } from '../Stakes/Stakes.tsx';
import { Text } from '../Text/Text.tsx';

/** One game and stake the club runs, as the website shows it. Money in paise. */
export interface GamesBlockGame {
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly buyInMin: bigint;
  readonly buyInMax: bigint;
  /** A compulsory straddle, as in the Private Room; null where there is none. */
  readonly straddle: bigint | null;
  /** Its tables open now. */
  readonly tablesOpen: number;
  /** Seats free at those tables (#130); shown when given and any table runs. */
  readonly openSeats?: number | undefined;
  /** Members waiting for it; shown when any are. */
  readonly waiting?: number | undefined;
}

export interface GamesBlockProps {
  heading?: string | undefined;
  games: readonly GamesBlockGame[];
}

function buyIn(game: GamesBlockGame): string {
  if (game.buyInMin === game.buyInMax) return t('ui.web.buyIn', { amount: formatMoney(game.buyInMin) });
  return t('ui.web.buyInRange', { min: formatMoney(game.buyInMin), max: formatMoney(game.buyInMax) });
}

function running({ tablesOpen, openSeats, waiting = 0 }: GamesBlockGame): string {
  const tables = tablesOpen === 0 ? t('ui.web.notRunning') : tablesOpen === 1 ? t('ui.web.oneTable') : t('ui.web.tables', { count: tablesOpen });
  const parts = [tables];
  if (tablesOpen > 0 && openSeats !== undefined) parts.push(openSeats === 1 ? t('ui.web.oneOpenSeat') : t('ui.web.openSeats', { count: openSeats }));
  if (waiting > 0) parts.push(t('ui.web.waiting', { count: waiting }));
  return parts.reduce((first, second) => t('ui.web.pair', { first, second }));
}

/** A website block of the games and stakes the club runs, live from the floor, a card each: buy-in and tables running. */
export function GamesBlock({ heading, games }: GamesBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {games.length === 0 ? <Text tone="muted">{t('ui.web.noGames')}</Text> : null}
      <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
        {games.map((game) => (
          <li key={game.name} className="flex flex-col gap-3 rounded-lg border border-hairline p-6">
            <Stakes smallBlind={game.smallBlind} bigBlind={game.bigBlind} size="display" />
            <Text weight="medium">{game.name}</Text>
            <Text tone="muted">
              {game.straddle === null ? buyIn(game) : t('ui.web.pair', { first: buyIn(game), second: t('ui.web.straddle', { amount: formatMoney(game.straddle) }) })}
            </Text>
            <Text variant="small" tone={game.tablesOpen === 0 ? 'muted' : 'default'}>{running(game)}</Text>
          </li>
        ))}
      </ul>
    </section>
  );
}
