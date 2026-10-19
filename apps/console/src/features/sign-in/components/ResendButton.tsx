import type { IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Captcha, Stack, useCaptcha } from '@rivr/ui';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';
import { useCountdown } from '../hooks/useCountdown.ts';

// Auth sends at most one code a minute to a number (config.template.toml, max_frequency).
const RESEND_AFTER_SECONDS = 60;

/** Sends a new code to the number, once a minute has passed since the last one. */
export function ResendButton({ phone, onFail }: { phone: IndianMobile; onFail: (failure: SignInFailure) => void }) {
  const { requestCode } = useSignIn();
  const countdown = useCountdown(RESEND_AFTER_SECONDS);
  const captcha = useCaptcha(CAPTCHA_SITE_KEY);
  const resend = async () => {
    const sent = await requestCode.mutateAsync({ phone, captchaToken: captcha.token });
    captcha.renew();
    if (sent.ok) countdown.restart();
    else onFail(sent.error);
  };
  return (
    <Stack gap={2}>
      <Captcha {...captcha.props} />
      <Button variant="text" fullWidth isDisabled={countdown.left > 0 || !captcha.isReady} isLoading={requestCode.isPending} onClick={() => void resend()}>
        {countdown.left > 0 ? t('common.signIn.resendIn', { seconds: countdown.left }) : t('common.signIn.resend')}
      </Button>
    </Stack>
  );
}
