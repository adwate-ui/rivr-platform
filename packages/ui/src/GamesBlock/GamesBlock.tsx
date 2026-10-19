import { formatMoney, t } from '@rivr/i18n';
import { Heading } from '../Heading/Heading.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
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
}

export interface GamesBlockProps {
  heading?: string | undefined;
  games: readonly GamesBlockGame[];
}

function buyIn(game: GamesBlockGame): string {
  if (game.buyInMin === game.buyInMax) return t('ui.web.buyIn', { amount: formatMoney(game.buyInMin) });
  return t('ui.web.buyInRange', { min: formatMoney(game.buyInMin), max: formatMoney(game.buyInMax) });
}

function running(tablesOpen: number): string {
  if (tablesOpen === 0) return t('ui.web.notRunning');
  return tablesOpen === 1 ? t('ui.web.oneTable') : t('ui.web.tables', { count: tablesOpen });
}

/** A website block of the games and stakes the club runs, live from the floor: buy-in and tables running. */
export function GamesBlock({ heading, games }: GamesBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-10">
      {heading ? <Heading level={2}>{heading}</Heading> : null}
      {games.length === 0 ? <Text tone="muted">{t('ui.web.noGames')}</Text> : null}
      <Stack gap={4} divided>
        {games.map((game) => (
          <Stack key={game.name} gap={1}>
            <Inline gap={3} align="baseline" wrap>
              <Text weight="medium">{game.name}</Text>
              <Stakes smallBlind={game.smallBlind} bigBlind={game.bigBlind} tone="muted" />
            </Inline>
            <Text tone="muted">
              {game.straddle === null ? buyIn(game) : t('ui.web.pair', { first: buyIn(game), second: t('ui.web.straddle', { amount: formatMoney(game.straddle) }) })}
            </Text>
            <Text variant="small" tone={game.tablesOpen === 0 ? 'muted' : 'default'}>{running(game.tablesOpen)}</Text>
          </Stack>
        ))}
      </Stack>
    </section>
  );
}
