import { useState } from 'react';
import { cx } from '../internal/classes.ts';

export interface ItemPhotoProps {
  /** The photo's address, or null until the club adds one. */
  src: string | null;
  /** The item's name, whose first letter stands in until there is a photo. Not read out: the name is beside the tile. */
  name: string;
  /** `sm` on a line of the menu, `md` (the default) beside a reward. */
  size?: 'sm' | 'md';
}

const WIDTH = { sm: 'w-16', md: 'w-24' } as const;
const INITIAL = { sm: 'text-24', md: 'text-36' } as const;

/**
 * A reward's or a dish's photo in a 4:3 tile (AS-11): the club's own photograph, never stock (ui.md), or until one is
 * added, or if it does not load, the item's first letter in the display face on the raised surface. Hidden from screen
 * readers: the item's name beside it says what it is.
 */
export function ItemPhoto({ src, name, size = 'md' }: ItemPhotoProps) {
  // The address that failed to load, so a new photo is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shown = src !== null && src !== failedSrc ? src : null;
  return (
    <span aria-hidden="true" className={cx('flex aspect-photo shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-raised', WIDTH[size])}>
      {shown ? (
        <img src={shown} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailedSrc(shown)} />
      ) : (
        <span className={cx('font-display leading-none text-content-muted', INITIAL[size])}>{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
