import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface ErrorMessageProps {
  /** What went wrong, then what to do. */
  children: ReactNode;
  /** For a field that points at the message with aria-describedby. */
  id?: string | undefined;
}

/**
 * Why a step did not go through: an alert icon and the message in cream, so it never relies on red
 * text, announced as it appears. Under a field (Input's error) or under the action that failed.
 */
export function ErrorMessage({ children, id }: ErrorMessageProps) {
  return (
    <div role="alert" className="flex items-start gap-2 text-content">
      <Icon name="alert" size="sm" />
      <Text variant="small" {...(id === undefined ? {} : { id })}>
        {children}
      </Text>
    </div>
  );
}
