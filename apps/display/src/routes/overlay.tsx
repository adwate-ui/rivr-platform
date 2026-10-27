import { createRoute } from '@tanstack/react-router';
import { OverlayFrame } from '../features/frame/index.ts';
import { overlayDelay, StreamOverlayScreen } from '../features/modes/index.ts';
import { PairingScreen } from '../features/pairing/index.ts';
import { rootRoute } from './root.tsx';

function Overlay() {
  const { delay } = overlayRoute.useSearch();
  return (
    <OverlayFrame unpaired={<PairingScreen />}>
      <StreamOverlayScreen delaySeconds={delay} />
    </OverlayFrame>
  );
}

/** The final-table stream's overlay for OBS (#125): `/overlay?delay=900`, the clock 900 seconds behind the table. */
export const overlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay',
  validateSearch: (search: Record<string, unknown>) => ({ delay: overlayDelay(search['delay']) }),
  component: Overlay,
});
