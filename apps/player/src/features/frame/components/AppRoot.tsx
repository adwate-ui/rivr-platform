import { ToastProvider } from '@rivr/ui';
import type { ReactNode } from 'react';
import { CookieChoices } from './CookieChoices.tsx';

/**
 * Around every screen (decision 0320): the toasts that confirm a member's own action, and the first launch's cookie choice
 * over whatever screen is open.
 */
export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <CookieChoices />
    </ToastProvider>
  );
}
