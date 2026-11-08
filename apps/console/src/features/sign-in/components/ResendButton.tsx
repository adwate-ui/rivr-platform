import type { IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { Captcha, ResendButton as ResendCode, Stack, useCaptcha } from '@rivr/ui';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';

/**
 * Sends a new code to the number, once a minute has passed since the last one (`@rivr/ui`'s ResendButton counts it down);
 * `onSent` once it has gone.
 */
export function ResendButton({ phone, onSent, onFail }: { phone: IndianMobile; onSent: () => void; onFail: (failure: SignInFailure) => void }) {
  const { requestCode } = useSignIn();
  const captcha = useCaptcha(CAPTCHA_SITE_KEY);
  const resend = async () => {
    const sent = await requestCode.mutateAsync({ phone, captchaToken: captcha.token });
    captcha.renew();
    if (sent.ok) onSent();
    else onFail(sent.error);
    return sent.ok;
  };
  return (
    <Stack gap={2}>
      <Captcha {...captcha.props} />
      <ResendCode onResend={resend} isLoading={requestCode.isPending} isDisabled={!captcha.isReady} />
    </Stack>
  );
}
