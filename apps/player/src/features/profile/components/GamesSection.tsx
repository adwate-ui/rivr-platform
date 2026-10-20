import { GAMES, usePreferenceActions, useStakes, type Game, type Preferences, type Stake } from '@rivr/db';
import { formatStakes, t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips, Heading, Stack, Text } from '@rivr/ui';

const GAME_LABEL: Readonly<Record<Game, MessageKey>> = {
  nlh: 'player.profile.nlh',
  plo: 'player.profile.plo',
  tournaments: 'player.profile.tournaments',
};

/** The chip for alerts at any stake. */
const ANY = 'any';

const stakeKey = (stake: Stake | null) => (stake === null ? ANY : `${stake.smallBlind}/${stake.bigBlind}`);

/**
 * The stake row, as the prototype's Profile has it: the club's stakes from its table types, or any
 * (#206). A stake saved that the club no longer runs keeps its chip, so the member sees it and can change it.
 */
function StakeChips({ preferences, stakes, isSaving, onSave }: {
  preferences: Preferences;
  stakes: readonly Stake[];
  isSaving: boolean;
  onSave: (stake: Stake | null) => void;
}) {
  const saved = preferences.stake;
  const choices = saved === null || stakes.some((stake) => stakeKey(stake) === stakeKey(saved)) ? stakes : [...stakes, saved];
  const options = [
    { value: ANY, label: t('player.profile.anyStake') },
    ...choices.map((stake) => ({ value: stakeKey(stake), label: formatStakes(stake.smallBlind, stake.bigBlind) })),
  ];
  return (
    <ChoiceChips
      label={t('player.profile.stake')}
      mode="one"
      options={options}
      selected={[stakeKey(saved)]}
      isDisabled={isSaving}
      onChange={([value]) => onSave(choices.find((stake) => stakeKey(stake) === value) ?? null)}
    />
  );
}

/**
 * The games a member wants waitlist alerts for, and the stake: one the club runs, or any. Changing the
 * games keeps the stake as it is.
 */
export function GamesSection({ preferences }: { preferences: Preferences }) {
  const { saveGames } = usePreferenceActions();
  const stakes = useStakes();
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
      {stakes.isError ? <Text tone="muted">{t('common.loadFailed')}</Text> : null}
      {stakes.data && stakes.data.length > 0 ? (
        <StakeChips preferences={preferences} stakes={stakes.data} isSaving={saveGames.isPending}
          onSave={(stake) => saveGames.mutate({ games: preferences.games, stake })} />
      ) : null}
      {saveGames.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
    </Stack>
  );
}
