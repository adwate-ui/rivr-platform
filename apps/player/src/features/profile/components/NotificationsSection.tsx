import { PUSH_CHOICES, useFeature, usePreferenceActions, type Preferences, type PushChoice } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { FeatureGate, Heading, Stack, Switch, Text } from '@rivr/ui';
import { PhonePushSwitch } from './PhonePushSwitch.tsx';

const PUSH_COPY: Readonly<Record<PushChoice, { label: MessageKey; hint: MessageKey }>> = {
  'push.seat_ready': { label: 'player.profile.seatCalls', hint: 'player.profile.seatCallsHint' },
  'push.call_time_complete': { label: 'player.profile.callTime', hint: 'player.profile.callTimeHint' },
  'push.withdrawal_sent': { label: 'player.profile.withdrawals', hint: 'player.profile.withdrawalsHint' },
  'push.tournament_starting': { label: 'player.profile.tournamentStarts', hint: 'player.profile.tournamentStartsHint' },
};

/** One kind of push notification: its switch for tiers that have it, its name and the tiers that do for the rest. */
function NotificationSwitch({ type, isOn }: { type: PushChoice; isOn: boolean }) {
  const access = useFeature(type);
  const { setNotification } = usePreferenceActions();
  return (
    <>
      {access.state === 'locked' ? <Text>{t(PUSH_COPY[type].label)}</Text> : null}
      <FeatureGate access={access}>
        <Switch
          label={t(PUSH_COPY[type].label)}
          hint={t(PUSH_COPY[type].hint)}
          isOn={isOn}
          isDisabled={setNotification.isPending}
          onChange={(next) => setNotification.mutate({ type, isOn: next })}
        />
        {setNotification.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
      </FeatureGate>
    </>
  );
}

/** Push notifications by kind, then promotions, which are the marketing consent (DPDP). */
export function NotificationsSection({ preferences }: { preferences: Preferences }) {
  const { setMarketing } = usePreferenceActions();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.notifications')}</Heading>
      <Stack gap={1}>
        <PhonePushSwitch />
        {PUSH_CHOICES.map((type) => (
          <NotificationSwitch key={type} type={type} isOn={!preferences.notificationsOff.includes(type)} />
        ))}
        <Switch
          label={t('player.profile.marketing')}
          hint={t('player.profile.marketingHint')}
          isOn={preferences.marketing}
          isDisabled={setMarketing.isPending}
          onChange={(isOn) => setMarketing.mutate(isOn)}
        />
        {setMarketing.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
      </Stack>
    </Stack>
  );
}
