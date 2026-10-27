import { useAuthStatus, useControlState } from '@rivr/db';
import { DisplayShell, KillSwitchBanner, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';

interface FrameProps {
  children: ReactNode;
  /** What the TV shows until it is paired, or once it is unpaired: its pairing code. */
  unpaired: ReactNode;
  /** The stream overlay (#125): unless it is signed out, it draws its own transparent page, the kill-switch banner too. */
  isOverlay?: boolean;
}

/**
 * The TV's frame. A TV holds no state beyond its own login and recovers on reload: signed in as a
 * paired TV it shows its mode, and otherwise `unpaired`. Lane B adds the clock in the corner.
 */
export function Frame({ children, unpaired, isOverlay = false }: FrameProps) {
  const { isVenueFrozen } = useControlState();
  const authStatus = useAuthStatus();
  if (isOverlay && authStatus !== 'signed-out') return children;
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
