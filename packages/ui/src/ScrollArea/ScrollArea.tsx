import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import type { ReactNode } from 'react';

export interface ScrollAreaProps {
  children: ReactNode;
  /** Names the scrolling region for screen readers, for example "Movements". */
  label: string;
}

/**
 * A region that scrolls inside its parent's height with a thin hairline scrollbar.
 * It can take keyboard focus, so arrow keys and Page Down scroll it.
 */
export function ScrollArea({ children, label }: ScrollAreaProps) {
  return (
    <RadixScrollArea.Root type="hover" className="relative h-full min-h-0 overflow-hidden">
      <RadixScrollArea.Viewport role="region" aria-label={label} tabIndex={0} className="size-full rounded-md">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar orientation="vertical" className="flex w-2 touch-none select-none p-0">
        <RadixScrollArea.Thumb className="flex-1 rounded-sm bg-hairline" />
      </RadixScrollArea.Scrollbar>
    </RadixScrollArea.Root>
  );
}
