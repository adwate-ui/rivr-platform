import type { IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Captcha, ResendButton as ResendCode, Stack, useCaptcha } from '@rivr/ui';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';

/** Sends a new code to the number once a minute has passed since the last one (`@rivr/ui`'s ResendButton counts it down). */
export function ResendButton({ phone, onFail }: { phone: IndianMobile; onFail: (failure: SignInFailure) => void }) {
  const { requestCode } = useSignIn();
  const captcha = useCaptcha(CAPTCHA_SITE_KEY);
  const resend = async () => {
    const sent = await requestCode.mutateAsync({ phone, captchaToken: captcha.token });
    captcha.renew();
    if (!sent.ok) onFail(sent.error);
    return sent.ok;
  };
  return (
    <Stack gap={2}>
      <Captcha {...captcha.props} />
      <ResendCode label={t('player.signIn.resend')} waitingLabel={(time) => t('player.signIn.resendIn', { time })} onResend={resend}
        isLoading={requestCode.isPending} isDisabled={!captcha.isReady} />
    </Stack>
  );
}
