import type { ReactNode } from 'react';

export interface TabletShellProps {
  children: ReactNode;
  /** The table this tablet is fixed to, for example "Table 3". */
  tableName: string;
  /** Controls at the top right, such as the hand counter or End of down. */
  actions?: ReactNode;
  /** Above everything, for the slim offline banner or the kill-switch banner. */
  banner?: ReactNode;
}

/** The dealer tablet frame, landscape 1180 by 820: banner, the table name, and the screen. */
export function TabletShell({ children, tableName, actions, banner }: TabletShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-surface text-content">
      {banner}
      <header className="flex h-header shrink-0 items-center justify-between gap-4 border-b border-hairline px-6">
        <p className="font-text text-20 leading-snug font-semibold">{tableName}</p>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-6 py-6">{children}</main>
    </div>
  );
}
