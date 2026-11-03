import { createContext, use } from 'react';
import type { Navigate } from './navigation.ts';

/** What a PlayerShell tells the screens in it: the member's initial for a tab screen's header, and whether it runs edge to edge. */
export interface PlayerFrame {
  avatar: { initial: string | undefined; href: string } | undefined;
  onNavigate: Navigate | undefined;
  isFullBleed: boolean;
}

/** Null outside a PlayerShell: the console's and the other apps' screens are as they were. */
export const PlayerFrameContext = createContext<PlayerFrame | null>(null);

/** The PlayerShell around this screen, if any. */
export function usePlayerFrame(): PlayerFrame | null {
  return use(PlayerFrameContext);
}
