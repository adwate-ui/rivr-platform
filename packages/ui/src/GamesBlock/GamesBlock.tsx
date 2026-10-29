import { formatMoney, t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
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
}

export interface GamesBlockProps {
  heading?: string | undefined;
  games: readonly GamesBlockGame[];
  /** The way to reserve a seat at one of them: a WhatsApp message to the club (#617). */
  reserve?: { readonly label: string; readonly href: string } | undefined;
}

function buyIn(game: GamesBlockGame): string {
  if (game.buyInMin === game.buyInMax) return t('ui.web.buyIn', { amount: formatMoney(game.buyInMin) });
  return t('ui.web.buyInRange', { min: formatMoney(game.buyInMin), max: formatMoney(game.buyInMax) });
}

/**
 * A website block of the games and stakes the club runs, a card each: the stakes, the game and the buy-in. It shows the
 * stakes only, never how many tables run or wait (#617), and a way to reserve a seat.
 */
export function GamesBlock({ heading, games, reserve }: GamesBlockProps) {
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
          </li>
        ))}
      </ul>
      {reserve && games.length > 0 ? <div><Button variant="primary" href={reserve.href}>{reserve.label}</Button></div> : null}
    </section>
  );
}
