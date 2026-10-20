import { usePreferenceActions, type Preferences } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Stack, Switch, Text } from '@rivr/ui';

/** Whether the club's TVs name the member on the waitlist board, or show only their place (#326). Every tier has it. */
export function PrivacySection({ preferences }: { preferences: Preferences }) {
  const { setNameOnTvs } = usePreferenceActions();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.privacy')}</Heading>
      <Stack gap={1}>
        <Switch
          label={t('player.profile.nameOnTvs')}
          hint={t('player.profile.nameOnTvsHint')}
          isOn={preferences.nameOnTvs}
          isDisabled={setNameOnTvs.isPending}
          onChange={(isOn) => setNameOnTvs.mutate(isOn)}
        />
        {setNameOnTvs.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
      </Stack>
    </Stack>
  );
}
