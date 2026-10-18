import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { PADDING_X, type Space } from '../internal/space.ts';

/** The widest the content may run: a line of text, or one of the target devices. */
export type ContainerWidth = 'text' | 'phone' | 'tablet' | 'console' | 'full';

export interface ContainerProps {
  children: ReactNode;
  width?: ContainerWidth;
  /** Side padding, so content never touches the screen edge. */
  paddingX?: Space;
}

const WIDTH: Record<ContainerWidth, string> = {
  text: 'max-w-text',
  phone: 'max-w-phone',
  tablet: 'max-w-tablet',
  console: 'max-w-console',
  full: '',
};

/** Centres content and caps its width. */
export function Container({ children, width = 'full', paddingX = 4 }: ContainerProps) {
  return <div className={cx('mx-auto w-full', WIDTH[width], PADDING_X[paddingX])}>{children}</div>;
}
