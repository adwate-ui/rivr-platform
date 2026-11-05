import { shrinkPhoto, useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { SelfieCamera } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

interface SelfieStepProps {
  onBack: () => void;
  onSent: () => void;
  /** For the club (decision 0502): kept as the sign-up photo with no vendor call, and the desk checks the rest. */
  isForTheClub?: boolean;
}

/**
 * The first step of the identity check (decision 0320): a selfie, taken there and then with the device's front camera and
 * never a file (K-07), full-bleed with its oval and live guidance; it takes itself once a face holds still in the oval,
 * where the browser can see faces. The vendor checks it is a live person, and it is kept as the KYC photo. Once it is in,
 * the record moves the screen on to DigiLocker (`onSent`). For the club, it lets the member in to be checked at the desk.
 */
export function SelfieStep({ onBack, onSent, isForTheClub = false }: SelfieStepProps) {
  const { sendSelfie, sendClubSelfie } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  // Busy from the tap, while the photo is made small, not only once it is sent: a second tap would send it twice.
  const [isSending, setIsSending] = useState(false);

  const send = async (photo: Blob) => {
    if (isSending) return;
    setIsSending(true);
    setFailure(null);
    try {
      // A photo the browser cannot read gets the same advice as a selfie that failed.
      const jpeg = await shrinkPhoto(photo).catch(() => null);
      const sent = jpeg ? await (isForTheClub ? sendClubSelfie : sendSelfie).mutateAsync(jpeg) : null;
      // For the club, false is the switch gone off meanwhile: the screen goes back to the app's own check.
      if (sent?.ok && sent.value !== false) onSent();
      else if (!sent?.ok) setFailure(sent ? sent.error : 'not_live');
    } finally {
      setIsSending(false);
    }
  };
  return (
    <SelfieCamera isSending={isSending} phoneUrl={`${window.location.origin}/kyc`} onBack={onBack} onPhoto={(photo) => void send(photo)}
      error={failure ? t(FAILURE_COPY[failure]) : undefined} />
  );
}
