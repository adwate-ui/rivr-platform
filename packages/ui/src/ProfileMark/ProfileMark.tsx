import type { ReactNode } from 'react';

export interface ProfileMarkProps {
  /** The member's initial, shown until there is a photo. */
  initial: string;
  /** The member's verified selfie, a filling `KycPhoto` (decision 0300); the initial without one. */
  photo?: ReactNode;
}

/** The member at the head of Profile (decision 0320): their photo, or their initial, in a 64 px gold-edged circle. */
export function ProfileMark({ initial, photo }: ProfileMarkProps) {
  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold font-display text-28 text-content">
      {photo ?? <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
