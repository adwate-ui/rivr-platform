import { useEffect, useState } from 'react';

/**
 * Seconds left until a new code may be requested, counting down once a second from `seconds`.
 * `restart()` starts it again after a resend. Auth refuses a second code inside a minute.
 */
export function useCountdown(seconds: number) {
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
