import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface ErrorMessageProps {
  /** What went wrong, then what to do. */
  children: ReactNode;
  /** For a field that points at the message with aria-describedby. */
  id?: string | undefined;
  /** `dot`, a red 8 px dot before the words: the player redesign's field error (decision 0320). `icon` elsewhere. */
  look?: 'icon' | 'dot';
}

/**
 * Why a step did not go through: an alert icon (or, in the player app, a red dot) and the message in cream, so it never
 * relies on red text, announced as it appears. Under a field (Input's error) or under the action that failed.
 */
export function ErrorMessage({ children, id, look = 'icon' }: ErrorMessageProps) {
  return (
    <div role="alert" className="flex items-start gap-2 text-content">
      {look === 'dot' ? (
        <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-alert" />
      ) : <Icon name="alert" size="sm" />}
      <Text variant="small" {...(id === undefined ? {} : { id })}>
        {children}
      </Text>
    </div>
  );
}
