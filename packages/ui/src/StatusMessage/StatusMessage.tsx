import type { ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';

export interface StatusMessageProps {
  /** That a step went through, such as `Sent to the bar: KOT 12.`; nothing while there is nothing to say. */
  children?: ReactNode;
}

/**
 * That a step went through, read out politely as it appears: ErrorMessage's counterpart (#123). Render it always,
 * with no children until there is something to say, so the region is in place before its words change.
 */
export function StatusMessage({ children }: StatusMessageProps) {
  const isEmpty = children === null || children === undefined || children === false || children === '';
  return <div role="status">{isEmpty ? null : <Text>{children}</Text>}</div>;
}
