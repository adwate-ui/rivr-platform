import { t } from '@rivr/i18n';
import { createContext, use, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';

/** The club's number, as `tel:` and wa.me take it: `+918796580435` and `918796580435`. */
export interface DeskContact {
  readonly phone: string;
  readonly whatsapp: string;
}

const DeskContactContext = createContext<DeskContact | null>(null);

/** Gives every `DeskHelp` under it the club's number: the player app, around every screen. */
export function DeskHelpProvider({ contact, children }: { contact: DeskContact; children: ReactNode }) {
  return <DeskContactContext value={contact}>{children}</DeskContactContext>;
}

/**
 * The way to reach the front desk (8 Nov audit, F-184; WCAG 3.2.6): Call the desk and WhatsApp the desk, side by side, in
 * the same place on every screen that has it, at its foot. `StepScreen` draws it under the step's action, and Profile under
 * Sign out. Nothing without a `DeskHelpProvider`, so the console's steps show none.
 */
export function DeskHelp() {
  const contact = use(DeskContactContext);
  if (contact === null) return null;
  return (
    <div role="group" aria-label={t('ui.deskHelp.label')} className="flex flex-wrap items-center justify-center gap-x-4">
      <Button variant="text" href={`tel:${contact.phone}`}>{t('ui.deskHelp.call')}</Button>
      <Button variant="text" href={`https://wa.me/${contact.whatsapp}`} opensNewTab>{t('ui.deskHelp.whatsapp')}</Button>
    </div>
  );
}
