import type { ReactNode } from 'react';
import { Heading } from '../Heading/Heading.tsx';

export interface DriverShellProps {
  children: ReactNode;
  /** The screen's heading, for example "Pickups". */
  title: string;
  /** Pinned to the bottom, for the one action the driver takes next. */
  footer?: ReactNode;
  /** Above everything, for the offline or kill-switch banner. */
  banner?: ReactNode;
}

/** The cab driver app frame on a phone: banner, the screen title, the screen, and a pinned action. */
export function DriverShell({ children, title, footer, banner }: DriverShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-surface text-content">
      {banner}
      <header className="flex h-header shrink-0 items-center border-b border-hairline px-4">
        <Heading level={1} variant="section">
          {title}
        </Heading>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
      {footer ? <div className="sticky bottom-0 z-nav border-t border-hairline bg-raised p-4">{footer}</div> : null}
    </div>
  );
}
