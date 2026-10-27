import { useAuthStatus, useControlState } from '@rivr/db';
import { DisplayShell, KillSwitchBanner, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';

interface FrameProps {
  children: ReactNode;
  /** What the TV shows until it is paired, or once it is unpaired: its pairing code. */
  unpaired: ReactNode;
}

/**
 * The TV's frame. A TV holds no state beyond its own login and recovers on reload: signed in as a
 * paired TV it shows its mode, and otherwise `unpaired`. Lane B adds the clock in the corner.
 */
export function Frame({ children, unpaired }: FrameProps) {
  const { isVenueFrozen } = useControlState();
  const authStatus = useAuthStatus();
  return (
    <DisplayShell>
      <Stack gap={8}>
        {isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
        {authStatus === 'signed-out' ? unpaired : null}
        {authStatus === 'signed-in' ? children : null}
      </Stack>
    </DisplayShell>
  );
}
