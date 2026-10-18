import { useControlState } from '@rivr/db';
import { DisplayShell, KillSwitchBanner, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';

/**
 * The TV's frame. A TV holds no state and recovers on reload; lane B adds pairing, the mode the
 * console assigns, and the clock in the corner.
 */
export function Frame({ children }: { children: ReactNode }) {
  const { isVenueFrozen } = useControlState();
  return (
    <DisplayShell>
      <Stack gap={8}>
        {isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
        {children}
      </Stack>
    </DisplayShell>
  );
}
