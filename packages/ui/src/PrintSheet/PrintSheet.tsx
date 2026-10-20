import type { ReactNode } from 'react';

/**
 * What the browser prints, and only that (#69): its children stay off the screen, and while one is on the page,
 * printing leaves out everything else (styles.css). The cage prints a receipt this way, on the printer the cage
 * computer prints to, as the owner chose for #412.
 */
export function PrintSheet({ children }: { children: ReactNode }) {
  return <div className="rivr-print-sheet hidden print:block">{children}</div>;
}
