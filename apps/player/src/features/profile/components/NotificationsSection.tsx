import { PUSH_CHOICES, useFeature, usePreferenceActions, type Preferences, type PushChoice } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { FeatureGate, Stack, Switch, Text } from '@rivr/ui';
import { AnalyticsSwitch } from './AnalyticsSwitch.tsx';
import { PhonePushSwitch } from './PhonePushSwitch.tsx';

const PUSH_COPY: Readonly<Record<PushChoice, { label: MessageKey; hint: MessageKey }>> = {
  'push.seat_ready': { label: 'player.profile.seatCalls', hint: 'player.profile.seatCallsHint' },
  'push.call_time_complete': { label: 'player.profile.callTime', hint: 'player.profile.callTimeHint' },
  'push.withdrawal_sent': { label: 'player.profile.withdrawals', hint: 'player.profile.withdrawalsHint' },
  'push.tournament_starting': { label: 'player.profile.tournamentStarts', hint: 'player.profile.tournamentStartsHint' },
};

/** One kind of push, behind its feature: on or off for this member. */
function NotificationSwitch({ type, isOn }: { type: PushChoice; isOn: boolean }) {
  const access = useFeature(type);
  const { setNotification } = usePreferenceActions();
  return (
    <FeatureGate access={access}>
      <Switch label={t(PUSH_COPY[type].label)} hint={t(PUSH_COPY[type].hint)} isOn={isOn} isDisabled={setNotification.isPending}
        onChange={(next) => setNotification.mutate({ type, isOn: next })} />
      {setNotification.data?.ok === false ? <Text variant="small">{t('player.profile.saveFailed')}</Text> : null}
    </FeatureGate>
  );
}

/**
 * Notifications (brief 3.9): push on this phone, then Seat calls, Call time, Tournaments (each a push this member can turn
 * off), Offers (marketing consent), Name on club TVs and Analytics (the cookie choice), each with its line.
 */
export function NotificationsSection({ preferences }: { preferences: Preferences }) {
  const { setMarketing, setNameOnTvs } = usePreferenceActions();
  return (
    <Stack gap={1}>
      <PhonePushSwitch />
      {PUSH_CHOICES.map((type) => <NotificationSwitch key={type} type={type} isOn={!preferences.notificationsOff.includes(type)} />)}
      <Switch label={t('player.profile.marketing')} hint={t('player.profile.marketingHint')} isOn={preferences.marketing}
        isDisabled={setMarketing.isPending} onChange={(isOn) => setMarketing.mutate(isOn)} />
      <Switch label={t('player.profile.nameOnTvs')} hint={t('player.profile.nameOnTvsHint')} isOn={preferences.nameOnTvs}
        isDisabled={setNameOnTvs.isPending} onChange={(isOn) => setNameOnTvs.mutate(isOn)} />
      {setMarketing.data?.ok === false || setNameOnTvs.data?.ok === false ? <Text variant="small">{t('player.profile.saveFailed')}</Text> : null}
      <AnalyticsSwitch />
    </Stack>
  );
}
