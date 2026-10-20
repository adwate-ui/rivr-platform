import type { ReactNode } from 'react';

/**
 * What the browser prints, and only that (#69): its children stay off the screen, and while one is on the page,
 * printing leaves out everything else and prints it from the paper's top-left corner at a thermal receipt's printed
 * width (styles.css). The cage prints a receipt this way, on the printer the cage computer prints to, as the owner
 * chose for #412, putting the sheet on the page only while it prints.
 */
export function PrintSheet({ children }: { children: ReactNode }) {
  return <div data-print-sheet className="hidden print:block">{children}</div>;
}
