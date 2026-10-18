import type { IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { useCountdown } from '../hooks/useCountdown.ts';

// Auth sends at most one code a minute to a number (config.template.toml, max_frequency).
const RESEND_AFTER_SECONDS = 60;

/** Sends a new code to the number, once a minute has passed since the last one. */
export function ResendButton({ phone, onFail }: { phone: IndianMobile; onFail: (failure: SignInFailure) => void }) {
  const { requestCode } = useSignIn();
  const countdown = useCountdown(RESEND_AFTER_SECONDS);
  const resend = async () => {
    const sent = await requestCode.mutateAsync({ phone });
    if (sent.ok) countdown.restart();
    else onFail(sent.error);
  };
  return (
    <Button variant="text" fullWidth isDisabled={countdown.left > 0} isLoading={requestCode.isPending} onClick={() => void resend()}>
      {countdown.left > 0 ? t('player.signIn.resendIn', { seconds: countdown.left }) : t('player.signIn.resend')}
    </Button>
  );
}
