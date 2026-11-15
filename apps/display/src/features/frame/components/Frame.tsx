import { useAuthStatus, useTvNotice } from '@rivr/db';
import { DisplayShell } from '@rivr/ui';
import { useEffect, useState, type ReactNode } from 'react';

interface FrameProps {
  children: ReactNode;
  /** What the TV shows until it is paired, or once it is unpaired: its pairing code. */
  unpaired: ReactNode;
}

const MINUTE_MS = 60_000;

/** The moment the header's clock shows: looked at every second, and changed when the minute does, so the boards are not redrawn each second. */
function useClock(): Date {
  const [shown, setShown] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setShown((last) => (Math.floor(now.getTime() / MINUTE_MS) === Math.floor(last.getTime() / MINUTE_MS) ? last : now));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);
  return shown;
}

/**
 * The TV's frame. A TV holds no state beyond its own login and recovers on reload: signed in as a paired TV it shows its
 * boards, and otherwise `unpaired`. It gives every board's header the club's time and, once paired, its foot the club's
 * notice (redesign RD-28).
 */
export function Frame({ children, unpaired }: FrameProps) {
  const authStatus = useAuthStatus();
  const notice = useTvNotice();
  const clockAt = useClock();
  return (
    <DisplayShell clockAt={clockAt} notice={notice.data ?? undefined}>
      {authStatus === 'signed-out' ? unpaired : null}
      {authStatus === 'signed-in' ? children : null}
    </DisplayShell>
  );
}
