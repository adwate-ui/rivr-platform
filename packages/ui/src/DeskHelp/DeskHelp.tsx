import { t } from '@rivr/i18n';
import { createContext, use, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';

/** The club's numbers for calls and WhatsApp, `+918796580435`; null for one the club has not set. */
export interface DeskContact {
  readonly phone: string | null;
  readonly whatsapp: string | null;
}

const DeskContactContext = createContext<DeskContact | null>(null);

/** Gives every `DeskHelp` under it the club's numbers: the player app, around every screen; null until they are read. */
export function DeskHelpProvider({ contact, children }: { contact: DeskContact | null; children: ReactNode }) {
  return <DeskContactContext value={contact}>{children}</DeskContactContext>;
}

/**
 * The way to reach the front desk (8 Nov audit, F-184; WCAG 3.2.6): Call the desk and WhatsApp the desk, side by side, in
 * the same place on every screen that has it, at its foot. `StepScreen` draws it under the step's action, and Profile under
 * Sign out. Nothing without a `DeskHelpProvider`, so the console's steps show none, and neither for a number not set.
 */
export function DeskHelp() {
  const contact = use(DeskContactContext);
  if (contact === null || (contact.phone === null && contact.whatsapp === null)) return null;
  return (
    <div role="group" aria-label={t('ui.deskHelp.label')} className="flex flex-wrap items-center justify-center gap-x-4">
      {contact.phone === null ? null : <Button variant="text" href={`tel:${contact.phone}`}>{t('ui.deskHelp.call')}</Button>}
      {/* wa.me takes the number without its plus. */}
      {contact.whatsapp === null ? null : <Button variant="text" href={`https://wa.me/${contact.whatsapp.replace(/^\+/, '')}`} opensNewTab>{t('ui.deskHelp.whatsapp')}</Button>}
    </div>
  );
}
