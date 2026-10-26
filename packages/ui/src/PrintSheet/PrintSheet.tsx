import type { ReactNode } from 'react';

/**
 * What the browser prints, and only that (#69): its children stay off the screen, and while one is on the page,
 * printing leaves out everything else and prints it from the paper's top-left corner (styles.css). A `receipt`
 * prints at a thermal receipt's printed width: the cage prints a receipt this way, on the printer the cage
 * computer prints to, as the owner chose for #412, putting the sheet on the page only while it prints. An `a4`
 * sheet prints an A4 document, such as a partner's statement (#98), edge to edge on A4 paper.
 */
export function PrintSheet({ children, paper = 'receipt' }: { children: ReactNode; paper?: 'receipt' | 'a4' }) {
  return <div data-print-sheet={paper} className="hidden print:block">{children}</div>;
}
