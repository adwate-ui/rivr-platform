import { useEffect, useState } from 'react';

/**
 * The phone's clock, a new moment each second while `isTicking`, and at once when the app comes back into view (decision
 * 0320): Tonight's timers count down from it to times the server gave, so they stay right after the phone slept.
 */
export function useNow(isTicking: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isTicking) return undefined;
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isTicking]);
  return now;
}
