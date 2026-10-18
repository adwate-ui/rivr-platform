import * as RadixLabel from '@radix-ui/react-label';
import type { ReactNode } from 'react';

/**
 * `field` is a form field's caption, small and muted as in the prototype's sign-in; `setting` is the
 * name of a setting, such as a switch's, in the body colour.
 */
export type LabelVariant = 'field' | 'setting';

export interface LabelProps {
  children: ReactNode;
  /** The id of the control this label names. */
  htmlFor: string;
  id?: string;
  variant?: LabelVariant;
}

const VARIANT: Record<LabelVariant, string> = {
  field: 'font-text text-13 leading-snug font-regular text-content-muted',
  setting: 'font-text text-14 leading-snug font-medium text-content',
};

/** Names a form control. Clicking it focuses the control. */
export function Label({ children, htmlFor, id, variant = 'field' }: LabelProps) {
  return (
    <RadixLabel.Root htmlFor={htmlFor} id={id} className={VARIANT[variant]}>
      {children}
    </RadixLabel.Root>
  );
}
