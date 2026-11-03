import { t } from '@rivr/i18n';
import { ErrorMessage, Switch, Text } from '@rivr/ui';
import { usePhone } from '../hooks/usePhone.ts';

/** Notifications on this phone: web push in a browser (#139), the lock-screen live status in the native app (decision 0361); the switch, or why this browser cannot have it. */
export function PhonePushSwitch() {
  const phone = usePhone();
  if (phone.state === 'unsupported') return <Text>{t('player.profile.phonePushUnsupported')}</Text>;
  return (
    <>
      <Switch
        label={t('player.profile.phonePush')}
        {...(phone.state === 'blocked' ? { hint: t('player.profile.phonePushBlocked') } : {})}
        isOn={phone.state === 'on'}
        isDisabled={phone.isBusy || phone.state === 'loading' || phone.state === 'blocked'}
        onChange={(isOn) => void phone.change(isOn)}
      />
      {phone.failed ? <ErrorMessage>{t('player.profile.saveFailed')}</ErrorMessage> : null}
    </>
  );
}
