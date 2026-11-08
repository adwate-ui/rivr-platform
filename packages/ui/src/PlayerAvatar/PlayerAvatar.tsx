import { AvatarLink } from '../AvatarLink/AvatarLink.tsx';
import { usePlayerFrame } from '../internal/playerFrame.ts';

/**
 * The member's photo, or initial, opening Profile (decision 0320), at the end of a tab screen's header row, centred on whatever heads
 * the screen, as in the prototype: a one-line title, the wordmark, or the seat's two lines (decision 0380). Screen puts it in
 * its heading row; a screen that heads itself, as Tonight does, puts it in its own. It is the PlayerShell's `avatar`, so
 * there is none outside a shell or on a screen without one, such as a pushed screen.
 */
export function PlayerAvatar() {
  const frame = usePlayerFrame();
  if (!frame?.avatar) return null;
  return <AvatarLink initial={frame.avatar.initial} photo={frame.avatar.photo} href={frame.avatar.href} onNavigate={frame.onNavigate} />;
}
