import { t } from '@rivr/i18n';
import { ErrorMessage, Switch, Text } from '@rivr/ui';
import { usePhonePush } from '../hooks/usePhonePush.ts';

/** Push on this phone (#139): the switch, or why this browser cannot have it. */
export function PhonePushSwitch() {
  const phone = usePhonePush();
  if (phone.state === 'unsupported') return <Text>{t('player.profile.phonePushUnsupported')}</Text>;
  return (
    <>
      <Switch
        label={t('player.profile.phonePush')}
        hint={t(phone.state === 'blocked' ? 'player.profile.phonePushBlocked' : 'player.profile.phonePushHint')}
        isOn={phone.state === 'on'}
        isDisabled={phone.isBusy || phone.state === 'loading' || phone.state === 'blocked'}
        onChange={(isOn) => void phone.change(isOn)}
      />
      {phone.failed ? <ErrorMessage>{t('player.profile.saveFailed')}</ErrorMessage> : null}
    </>
  );
}
