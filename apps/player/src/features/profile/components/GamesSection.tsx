import { GAMES, usePreferenceActions, type Game, type Preferences } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips, Heading, Stack, Text } from '@rivr/ui';

const GAME_LABEL: Readonly<Record<Game, MessageKey>> = {
  nlh: 'player.profile.nlh',
  plo: 'player.profile.plo',
  tournaments: 'player.profile.tournaments',
};

/**
 * The games a member wants waitlist alerts for. The stake joins them once the club's table types
 * exist (#34); a stake already saved is kept as it is.
 */
export function GamesSection({ preferences }: { preferences: Preferences }) {
  const { saveGames } = usePreferenceActions();
  const options = GAMES.map((game) => ({ value: game, label: t(GAME_LABEL[game]) }));
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.alerts')}</Heading>
      <Text tone="muted">{t('player.profile.alertsHint')}</Text>
      <ChoiceChips
        label={t('player.profile.games')}
        options={options}
        selected={preferences.games}
        isDisabled={saveGames.isPending}
        onChange={(games) => saveGames.mutate({ games, stake: preferences.stake })}
      />
      {saveGames.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
    </Stack>
  );
}
