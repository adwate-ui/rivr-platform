import * as RadixLabel from '@radix-ui/react-label';
import type { ReactNode } from 'react';

export interface LabelProps {
  children: ReactNode;
  /** The id of the control this label names. */
  htmlFor: string;
  id?: string;
}

/** Names a form control. Clicking it focuses the control. */
export function Label({ children, htmlFor, id }: LabelProps) {
  return (
    <RadixLabel.Root htmlFor={htmlFor} id={id} className="font-text text-14 leading-snug font-medium text-content">
      {children}
    </RadixLabel.Root>
  );
}
