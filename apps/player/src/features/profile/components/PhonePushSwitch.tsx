import { t } from '@rivr/i18n';
import { ErrorMessage, Switch } from '@rivr/ui';
import type { usePhone } from '../hooks/usePhone.ts';

/** Notifications on this phone: web push in a browser (#139), the lock-screen live status in the native app (decision 0361); a row in every state, off and saying why where this phone cannot have it (F-169). */
export function PhonePushSwitch({ phone }: { phone: ReturnType<typeof usePhone> }) {
  const why = phone.state === 'unsupported' ? t('player.profile.phonePushUnsupported') : phone.state === 'blocked' ? t('player.profile.phonePushBlocked') : null;
  return (
    <>
      <Switch
        label={t('player.profile.phonePush')}
        {...(why === null ? {} : { hint: why })}
        isOn={phone.state === 'on'}
        isDisabled={phone.isBusy || phone.state === 'loading' || why !== null}
        onChange={(isOn) => void phone.change(isOn)}
      />
      {phone.failed ? <ErrorMessage>{t('player.profile.saveFailed')}</ErrorMessage> : null}
    </>
  );
}
