export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
}

/** A 1 px gold hairline at 25%: the way RIVR separates content. */
export function Divider({ orientation = 'horizontal' }: DividerProps) {
  if (orientation === 'vertical') {
    return <div role="separator" aria-orientation="vertical" className="self-stretch border-l border-hairline" />;
  }
  return <hr className="w-full border-t border-hairline" />;
}
