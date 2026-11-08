import { CLUB_CONTACT } from '@rivr/contracts/club';
import { DeskHelpProvider, ToastProvider } from '@rivr/ui';
import type { ReactNode } from 'react';
import { CookieChoices } from './CookieChoices.tsx';

/**
 * Around every screen (decision 0320): the toasts that confirm a member's own action, the first launch's cookie choice over
 * whatever screen is open, and the club's number for the way to the front desk (decision 0540).
 */
export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <DeskHelpProvider contact={CLUB_CONTACT}>
      <ToastProvider>
        {children}
        <CookieChoices />
      </ToastProvider>
    </DeskHelpProvider>
  );
}
