import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface PromptBarProps {
  /** What waits for the staff member at the screen, in one line, already translated. */
  message: string;
  /** The buttons that deal with it. */
  actions: ReactNode;
  /** A form one of the actions opened, such as the reason for a rejection, below the line. */
  children?: ReactNode;
}

/**
 * A prompt across the top of the console (#317; design prompt flow 6): something waiting for the staff member,
 * whichever screen they are on, and what they can do about it. It goes once nothing waits.
 */
export function PromptBar({ message, actions, children }: PromptBarProps) {
  return (
    <section className="flex flex-col gap-3 border-b border-hairline bg-raised px-6 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-money"><Icon name="alert" size="sm" /></span>
        {/* Only the line is announced: opening a form below does not read it all out again. */}
        <div role="alert"><Text as="span" weight="medium">{message}</Text></div>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}
