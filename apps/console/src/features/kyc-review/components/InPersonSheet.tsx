import { t } from '@rivr/i18n';
import { Button, Sheet } from '@rivr/ui';
import { useState } from 'react';
import { InPersonSection } from './InPersonSection.tsx';

/**
 * Check in person (console v3): the screen's one gold button, which opens the check in person in a side sheet, from the
 * foot on a phone: find the member, take their photo with the live camera, enter the details from the originals, and ask
 * their consent. Closing it drops a check half done. With `initialSearch` (the waitlist's Check ID, decision 0503) it opens
 * at once, with that member searched.
 */
export function InPersonSheet({ venueId, initialSearch }: { venueId: string; initialSearch?: string | undefined }) {
  const [isOpen, setOpen] = useState(initialSearch !== undefined);
  return (
    <>
      <Button variant="primary" size="compact" onClick={() => setOpen(true)}>{t('console.kycInPerson.title')}</Button>
      <Sheet place="console" isOpen={isOpen} onClose={() => setOpen(false)} title={t('console.kycInPerson.title')} subtitle={t('console.kycInPerson.hint')}>
        {isOpen ? <InPersonSection venueId={venueId} hasHeading={false} initialSearch={initialSearch} /> : null}
      </Sheet>
    </>
  );
}
