import { SIZE, type Space } from '../internal/space.ts';

export interface SpacerProps {
  /** A fixed gap from the spacing scale. Without it the spacer takes all remaining space. */
  size?: Space;
}

/** Empty space inside a Stack or Inline: a fixed step, or everything left over. */
export function Spacer({ size }: SpacerProps) {
  const classes = size === undefined ? 'min-h-0 min-w-0 flex-1' : `shrink-0 ${SIZE[size]}`;
  return <div aria-hidden="true" className={classes} />;
}
