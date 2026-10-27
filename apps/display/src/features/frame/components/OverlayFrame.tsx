import { useAuthStatus } from '@rivr/db';
import { useState, type ReactNode } from 'react';
import { Frame } from './Frame.tsx';

interface OverlayFrameProps {
  children: ReactNode;
  /** What the overlay shows until it is paired: its pairing code. */
  unpaired: ReactNode;
}

/**
 * The stream overlay's frame (#125, decision 0256): a TV's frame, with its code, until it is paired;
 * then it draws its own transparent page, the kill-switch banner too. Once paired it never puts a code
 * on the stream again: unpaired, it shows nothing until OBS reloads it.
 */
export function OverlayFrame({ children, unpaired }: OverlayFrameProps) {
  const authStatus = useAuthStatus();
  const [wasPaired, setWasPaired] = useState(false);
  if (authStatus === 'signed-in' && !wasPaired) setWasPaired(true);
  if (authStatus !== 'signed-out' || wasPaired) return children;
  return <Frame unpaired={unpaired}>{children}</Frame>;
}
