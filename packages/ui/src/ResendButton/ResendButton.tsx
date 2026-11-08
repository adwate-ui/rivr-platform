import { formatMinutesSeconds, t } from '@rivr/i18n';
import { useEffect, useState } from 'react';
import { Button } from '../Button/Button.tsx';

// Auth sends at most one code a minute to a number (config.template.toml, max_frequency).
const RESEND_AFTER_SECONDS = 60;

/** Seconds left until a new code may be asked for, counting down once a second; `restart()` after a resend. */
function useCountdown(seconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [left]);
  const restart = () => {
    setEndsAt(Date.now() + seconds * 1000);
    setNow(Date.now());
  };
  return { left, restart };
}

export interface ResendButtonProps {
  /** Asks for a new code; true once it has gone, which starts the minute again. */
  onResend: () => Promise<boolean>;
  /** While a code is being asked for. */
  isLoading: boolean;
  /** Held back for something else, such as the captcha before it is ready. */
  isDisabled?: boolean;
}

/**
 * A sign-in step's way to a new code, in the player app and the console alike (F-133): "Resend code in 0:24" until a
 * minute has passed since the last one, then "Resend code".
 */
export function ResendButton({ onResend, isLoading, isDisabled = false }: ResendButtonProps) {
  const countdown = useCountdown(RESEND_AFTER_SECONDS);
  const resend = async () => {
    if (await onResend()) countdown.restart();
  };
  return (
    <Button variant="text" fullWidth isDisabled={countdown.left > 0 || isDisabled} isLoading={isLoading} onClick={() => void resend()}>
      {countdown.left > 0 ? t('ui.signIn.resendIn', { time: formatMinutesSeconds(countdown.left) }) : t('ui.signIn.resend')}
    </Button>
  );
}
