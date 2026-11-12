import { useClubContact } from '@rivr/db';
import { DeskHelpProvider, ToastProvider } from '@rivr/ui';
import type { ReactNode } from 'react';
import { CookieChoices } from './CookieChoices.tsx';

/**
 * Around every screen (decision 0320): the toasts that confirm a member's own action, the first launch's cookie choice over
 * whatever screen is open, and the club's numbers for the way to the front desk (decision 0540), as set under Settings, Club
 * (decision 0582).
 */
export function AppRoot({ children }: { children: ReactNode }) {
  const contact = useClubContact();
  return (
    <DeskHelpProvider contact={contact.data ?? null}>
      <ToastProvider>
        {children}
        <CookieChoices />
      </ToastProvider>
    </DeskHelpProvider>
  );
}
